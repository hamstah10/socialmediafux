"""Idempotent seed: default admin, news sources, demo customer, templates.

`seed_sources` upserts by name so real RSS URLs get applied even when the DB
already has older seed data.
"""
import logging
from auth import hash_password
from db import base_fields, db, find_one, insert_one

logger = logging.getLogger(__name__)


# Real / working URLs for tuning-industry news.
# - Autotuner uses Shopify blog (`/blogs/news.atom` provides RSS).
# - Magic Motorsport / Alientech / Dimsport publish news pages without a public
#   RSS feed; we keep them as `website` sources so scrapers can be extended
#   later, and the URL Import still works for individual articles.
# - We add generic tuning-industry RSS feeds (tuningblog.eu, Auto Motor & Sport)
#   so the fetch action works out-of-the-box.
DEFAULT_SOURCES = [
    {"name": "Autotuner", "url": "https://www.autotuner.com/de/blogs/neuigkeiten",
     "rss_url": "https://www.autotuner.com/de/blogs/neuigkeiten.atom",
     "source_type": "rss", "scraper_key": "autotuner"},
    {"name": "Magic Motorsport", "url": "https://www.magicmotorsport.com/en/news",
     "rss_url": None, "source_type": "website", "scraper_key": "magicmotorsport"},
    {"name": "Alientech", "url": "https://www.alientech-tools.com/en/news/",
     "rss_url": None, "source_type": "website", "scraper_key": "alientech"},
    {"name": "Dimsport", "url": "https://www.dimsport.it/en/news/",
     "rss_url": None, "source_type": "website", "scraper_key": "generic_rss"},
    {"name": "CMD Flash / Flashtec", "url": "https://www.flashtec.ch/en/news",
     "rss_url": None, "source_type": "website", "scraper_key": "generic_rss"},
    {"name": "TuningBlog.eu", "url": "https://tuningblog.eu",
     "rss_url": "https://tuningblog.eu/feed/",
     "source_type": "rss", "scraper_key": "generic_rss"},
    {"name": "Auto Motor Sport", "url": "https://www.auto-motor-und-sport.de",
     "rss_url": "https://www.auto-motor-und-sport.de/feed/",
     "source_type": "rss", "scraper_key": "generic_rss"},
    {"name": "Motor1 Aftermarket & Tuning", "url": "https://www.motor1.com",
     "rss_url": "https://www.motor1.com/rss/articles/all/",
     "source_type": "rss", "scraper_key": "generic_rss"},
]

DEFAULT_TEMPLATES = [
    {"name": "ECU Update — Dark Grid", "format": "instagram_square", "width": 1080,
     "height": 1080, "style_key": "ecu_update", "background_type": "grid",
     "is_global": True, "customer_id": None,
     "config": {"badge": "NEW ECU UPDATE", "accent": "#B4E600",
                "logo_position": "top_right"}},
    {"name": "Motorsport Dark — Diagonal", "format": "instagram_square", "width": 1080,
     "height": 1080, "style_key": "motorsport_dark", "background_type": "diagonal",
     "is_global": True, "customer_id": None,
     "config": {"badge": "MOTORSPORT", "accent": "#B4E600",
                "logo_position": "top_right"}},
    {"name": "Clean Local Workshop", "format": "facebook_landscape", "width": 1200,
     "height": 630, "style_key": "clean_workshop", "background_type": "clean",
     "is_global": True, "customer_id": None,
     "config": {"badge": "WORKSHOP", "accent": "#B4E600",
                "logo_position": "top_center"}},
]


async def seed_admin() -> None:
    existing = await find_one("users", {"email": "admin@socialfux.local"})
    if existing:
        return
    doc = {
        **base_fields(),
        "email": "admin@socialfux.local",
        "password_hash": hash_password("admin123456"),
        "full_name": "SocialFUX Admin",
        "role": "superadmin",
        "is_active": True,
    }
    await insert_one("users", doc)
    logger.info("Seeded default admin admin@socialfux.local")


async def seed_sources() -> None:
    """Seed default sources ONCE.

    After the first seed we store a marker so that user-deleted sources
    never come back. This also stops the upsert-by-name loop that used to
    resurrect deleted default sources on every backend restart.
    """
    marker = await find_one("settings", {"key": "news_sources_seeded"})
    if marker:
        return

    # If the DB already has sources (legacy pre-marker installs), just
    # write the marker so we don't touch anything.
    existing_count = await db["news_sources"].count_documents({})
    if existing_count > 0:
        await insert_one("settings", {**base_fields(), "key": "news_sources_seeded",
                                       "value": "legacy"})
        logger.info("News sources already present (%d) — marked as seeded", existing_count)
        return

    for s in DEFAULT_SOURCES:
        await insert_one("news_sources", {**base_fields(), **s, "active": True,
                                          "last_checked_at": None})
    await insert_one("settings", {**base_fields(), "key": "news_sources_seeded",
                                    "value": "initial"})
    logger.info("Seeded %d news sources (first run)", len(DEFAULT_SOURCES))


async def seed_demo_customer() -> None:
    if await db["customers"].count_documents({}) > 0:
        return
    await insert_one("customers", {
        **base_fields(),
        "name": "TuningFux Demo",
        "slug": "tuningfux-demo",
        "logo_path": None,
        "primary_color": "#080D1A",
        "secondary_color": "#0F1526",
        "accent_color": "#B4E600",
        "website": "https://tuningfux.de",
        "email": "info@tuningfux.de",
        "phone": None,
        "language": "de",
        "tone_of_voice": "technisch",
        "services": ["Chiptuning", "Tuningfiles", "Diagnose", "Codierung",
                     "AdBlue", "DPF", "EGR"],
        "social_links": {"instagram": "", "facebook": "", "linkedin": ""},
        "notes": "Automatisch angelegter Demo-Kunde.",
        "is_active": True,
    })
    logger.info("Seeded demo customer TuningFux Demo")


async def seed_templates() -> None:
    if await db["design_templates"].count_documents({}) > 0:
        return
    for t in DEFAULT_TEMPLATES:
        await insert_one("design_templates", {**base_fields(), **t})
    logger.info("Seeded %d templates", len(DEFAULT_TEMPLATES))


async def cleanup_orphan_news_items() -> None:
    """Delete news items whose news_source_id references a deleted source.

    Runs on every startup. Manual URL imports (news_source_id is None)
    are always kept.
    """
    valid_ids = {s["id"] async for s in db["news_sources"].find({}, {"id": 1})}
    r = await db["news_items"].delete_many({
        "news_source_id": {"$nin": list(valid_ids) + [None]},
    })
    if r.deleted_count:
        logger.info("Cleaned up %d orphan news items", r.deleted_count)


async def run_seed() -> None:
    await seed_admin()
    await seed_sources()
    await seed_demo_customer()
    await seed_templates()
    await cleanup_orphan_news_items()
