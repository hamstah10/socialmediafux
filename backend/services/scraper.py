"""RSS feed reading and single-URL article extraction for News import.

Modular structure — different vendor scrapers (autotuner, magicmotorsport,
alientech, ...) can override behaviour by inheriting from `BaseScraper`.
Right now they all delegate to the generic RSS/URL implementation, which is
enough for the MVP.
"""
from __future__ import annotations

import logging
from typing import Any, Optional
from datetime import datetime, timezone

import feedparser
import httpx
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)


DEFAULT_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (compatible; SocialFUX/1.0; +https://social.tuningfux.de)"
    ),
    "Accept": "text/html,application/xhtml+xml,application/rss+xml,application/xml;q=0.9,*/*;q=0.8",
}


def _to_iso(dt: Any) -> Optional[str]:
    if not dt:
        return None
    try:
        if isinstance(dt, str):
            return dt
        if hasattr(dt, "tm_year"):
            return datetime(*dt[:6], tzinfo=timezone.utc).isoformat()
    except Exception:
        return None
    return None


def _pick_image_from_entry(entry: Any) -> Optional[str]:
    media = entry.get("media_content") or []
    if media and isinstance(media, list):
        url = media[0].get("url")
        if url:
            return url
    thumbs = entry.get("media_thumbnail") or []
    if thumbs and isinstance(thumbs, list):
        return thumbs[0].get("url")

    # RSS 2.0 <enclosure> tags
    enclosures = entry.get("enclosures") or []
    for enc in enclosures:
        if enc.get("type", "").startswith("image/") and enc.get("href"):
            return enc["href"]
        if enc.get("url", "").lower().endswith((".jpg", ".jpeg", ".png", ".webp", ".gif")):
            return enc["url"]

    for link in entry.get("links", []) or []:
        if link.get("type", "").startswith("image/"):
            return link.get("href")

    # Feedparser puts full HTML content under `content`, and summary is often plain text.
    html_candidates: list[str] = []
    if entry.get("content"):
        for c in entry["content"]:
            if isinstance(c, dict) and c.get("value"):
                html_candidates.append(c["value"])
    if entry.get("summary"):
        html_candidates.append(entry["summary"])
    if entry.get("description"):
        html_candidates.append(entry["description"])

    for html in html_candidates:
        try:
            soup = BeautifulSoup(html, "lxml")
            img = soup.find("img")
            if img:
                src = img.get("src") or img.get("data-src") or img.get("data-lazy-src")
                if src:
                    return src
        except Exception:
            continue
    return None


async def _og_image(url: str, client: httpx.AsyncClient) -> Optional[str]:
    """Lightweight fetch of an article to pull og:image / twitter:image."""
    try:
        r = await client.get(url, timeout=8)
        r.raise_for_status()
        soup = BeautifulSoup(r.text, "lxml")
        for prop in ("og:image", "og:image:secure_url", "twitter:image"):
            tag = soup.find("meta", attrs={"property": prop}) or soup.find("meta", attrs={"name": prop})
            if tag and tag.get("content"):
                return tag["content"].strip()
        img = soup.find("img")
        if img and img.get("src"):
            return img["src"]
    except Exception:
        return None
    return None


async def fetch_rss(rss_url: str, limit: int = 20) -> list[dict]:
    """Fetch and parse an RSS/Atom feed. Returns list of normalised item dicts.

    For items missing an image in the feed, opportunistically fetches the
    article page to extract og:image (limited concurrency, best-effort).
    """
    try:
        async with httpx.AsyncClient(timeout=20, headers=DEFAULT_HEADERS, follow_redirects=True) as c:
            r = await c.get(rss_url)
            r.raise_for_status()
            raw = r.text
    except Exception as e:
        logger.warning("RSS fetch failed for %s: %s", rss_url, e)
        return []

    parsed = feedparser.parse(raw)
    items: list[dict] = []
    for entry in parsed.entries[:limit]:
        summary_html = entry.get("summary") or ""
        summary_text = ""
        if summary_html:
            try:
                summary_text = BeautifulSoup(summary_html, "lxml").get_text(" ", strip=True)[:800]
            except Exception:
                summary_text = summary_html[:800]

        items.append({
            "title": entry.get("title") or "(kein Titel)",
            "url": entry.get("link"),
            "summary": summary_text,
            "content_raw": summary_html,
            "content_clean": summary_text,
            "image_url": _pick_image_from_entry(entry),
            "published_at": _to_iso(entry.get("published_parsed") or entry.get("updated_parsed")),
            "category": (entry.get("tags") or [{}])[0].get("term") if entry.get("tags") else None,
        })

    # Enrich items missing an image_url by scraping their article page (best effort).
    missing = [i for i in items if not i.get("image_url") and i.get("url")]
    if missing:
        async with httpx.AsyncClient(headers=DEFAULT_HEADERS, follow_redirects=True) as c:
            import asyncio
            sem = asyncio.Semaphore(6)

            async def enrich(item: dict) -> None:
                async with sem:
                    item["image_url"] = await _og_image(item["url"], c)

            await asyncio.gather(*(enrich(i) for i in missing))

    return items


async def fetch_url(url: str) -> Optional[dict]:
    """Fetch a single article URL and extract title, summary, image, canonical url."""
    try:
        async with httpx.AsyncClient(timeout=25, headers=DEFAULT_HEADERS, follow_redirects=True) as c:
            r = await c.get(url)
            r.raise_for_status()
            html = r.text
    except Exception as e:
        logger.warning("URL fetch failed for %s: %s", url, e)
        return None

    soup = BeautifulSoup(html, "lxml")

    def meta(name: str) -> Optional[str]:
        tag = soup.find("meta", attrs={"property": name}) or soup.find("meta", attrs={"name": name})
        if tag and tag.get("content"):
            return tag["content"].strip()
        return None

    title = meta("og:title") or (soup.title.string.strip() if soup.title and soup.title.string else url)
    description = meta("og:description") or meta("description") or ""
    image = meta("og:image") or meta("twitter:image")
    canonical = None
    link = soup.find("link", rel="canonical")
    if link and link.get("href"):
        canonical = link["href"]

    # Extract main body text via readability
    content_clean = ""
    try:
        from readability import Document  # type: ignore
        doc = Document(html)
        content_html = doc.summary(html_partial=True)
        content_clean = BeautifulSoup(content_html, "lxml").get_text(" ", strip=True)[:4000]
    except Exception:
        # Fallback: strip tags
        content_clean = soup.get_text(" ", strip=True)[:4000]

    return {
        "title": title[:300],
        "url": canonical or url,
        "summary": description[:800],
        "content_raw": html[:20000],
        "content_clean": content_clean,
        "image_url": image,
        "published_at": meta("article:published_time"),
        "category": meta("article:section"),
    }


# --- Modular vendor scrapers (placeholder — same behaviour as generic for MVP) ---
class BaseScraper:
    key: str = "base"

    async def fetch(self, source: dict) -> list[dict]:
        if source.get("rss_url"):
            return await fetch_rss(source["rss_url"])
        if source.get("url"):
            r = await fetch_url(source["url"])
            return [r] if r else []
        return []


class GenericRssScraper(BaseScraper):
    key = "generic_rss"


class AutotunerScraper(BaseScraper):
    key = "autotuner"


class MagicMotorsportScraper(BaseScraper):
    key = "magicmotorsport"


class AlientechScraper(BaseScraper):
    key = "alientech"


SCRAPERS: dict[str, BaseScraper] = {
    s.key: s() for s in [GenericRssScraper, AutotunerScraper, MagicMotorsportScraper, AlientechScraper]
}


def get_scraper(key: str) -> BaseScraper:
    return SCRAPERS.get(key, GenericRssScraper())
