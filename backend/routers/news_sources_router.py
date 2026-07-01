"""News sources & manual fetch."""
from fastapi import APIRouter, Depends, HTTPException, status

from auth import get_current_user
from db import base_fields, db, delete_one, find_many, find_one, insert_one, update_one, utcnow_iso
from models import NewsSourceCreate, NewsSourceUpdate
from services.scraper import get_scraper

router = APIRouter(prefix="/news-sources", tags=["news-sources"])


@router.get("")
async def list_sources(_=Depends(get_current_user)):
    return await find_many("news_sources")


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_source(payload: NewsSourceCreate, _=Depends(get_current_user)):
    doc = {**base_fields(), **payload.model_dump(), "last_checked_at": None}
    return await insert_one("news_sources", doc)


@router.get("/{source_id}")
async def get_source(source_id: str, _=Depends(get_current_user)):
    s = await find_one("news_sources", {"id": source_id})
    if not s:
        raise HTTPException(status_code=404, detail="Source not found")
    return s


@router.put("/{source_id}")
async def update_source(source_id: str, payload: NewsSourceUpdate, _=Depends(get_current_user)):
    update = {k: v for k, v in payload.model_dump().items() if v is not None}
    updated = await update_one("news_sources", {"id": source_id}, update)
    if not updated:
        raise HTTPException(status_code=404, detail="Source not found")
    return updated


@router.delete("/{source_id}")
async def remove_source(source_id: str, _=Depends(get_current_user)):
    source = await find_one("news_sources", {"id": source_id})
    if not source:
        raise HTTPException(status_code=404, detail="Source not found")
    # Cascade: remove all news items belonging to this source
    items_result = await db["news_items"].delete_many({"news_source_id": source_id})
    ok = await delete_one("news_sources", {"id": source_id})
    return {"ok": ok, "deleted_news_items": items_result.deleted_count}


@router.post("/{source_id}/fetch")
async def fetch_source(source_id: str, _=Depends(get_current_user)):
    source = await find_one("news_sources", {"id": source_id})
    if not source:
        raise HTTPException(status_code=404, detail="Source not found")

    scraper = get_scraper(source.get("scraper_key", "generic_rss"))
    items = await scraper.fetch(source)

    imported = 0
    for item in items:
        if not item or not item.get("url"):
            continue
        existing = await find_one("news_items", {"url": item["url"]})
        if existing:
            continue
        doc = {
            **base_fields(),
            "news_source_id": source_id,
            "title": item.get("title", "")[:500],
            "url": item.get("url"),
            "summary": item.get("summary") or "",
            "content_raw": item.get("content_raw") or "",
            "content_clean": item.get("content_clean") or "",
            "image_url": item.get("image_url"),
            "published_at": item.get("published_at"),
            "category": item.get("category"),
            "status": "new",
        }
        await db["news_items"].insert_one(doc.copy())
        imported += 1

    await update_one("news_sources", {"id": source_id}, {"last_checked_at": utcnow_iso()})
    return {"imported": imported, "checked": len(items)}
