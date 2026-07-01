"""Renders a creative's preview_html to PNG via headless Chromium (Playwright).

The rendered HTML references images with relative paths (e.g. /uploads/...).
`page.set_content` has no base-URL concept, so we rewrite those to absolute
URLs against the backend's own address before rendering — it serves those
paths directly regardless of the public domain.
"""
import os
import re

from playwright.async_api import async_playwright

from services.creative import FORMAT_SIZES

_BASE_URL = f"http://127.0.0.1:{os.environ.get('INTERNAL_PORT', '7090')}"


def _absolutize_uploads(html: str) -> str:
    return re.sub(r'(["\'(])/uploads/', rf'\1{_BASE_URL}/uploads/', html)


async def render_creative_png(*, preview_html: str, format: str) -> bytes:
    w, h = FORMAT_SIZES.get(format, (1080, 1080))
    body = _absolutize_uploads(preview_html)
    html = f"""<!doctype html>
<html><head><meta charset="utf-8">
<style>*{{margin:0;padding:0;box-sizing:border-box;}} body{{width:{w}px;height:{h}px;overflow:hidden;}}</style>
</head><body>{body}</body></html>"""

    async with async_playwright() as p:
        browser = await p.chromium.launch(args=["--no-sandbox"])
        try:
            page = await browser.new_page(viewport={"width": w, "height": h})
            await page.set_content(html, wait_until="networkidle")
            return await page.screenshot(type="png")
        finally:
            await browser.close()
