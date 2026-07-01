"""News items endpoints."""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status

from auth import get_current_user
from db import base_fields, db, find_many, find_one, insert_one, update_one
from models import ImportUrlRequest, NewsItemStatusUpdate
from services.scraper import fetch_url

router = APIRouter(prefix="/news-items", tags=["news-items"])


@router.get("")
async def list_items(status: Optional[str] = Query(None), news_source_id: Optional[str] = Query(None),
                     limit: int = Query(200, le=1000), _=Depends(get_current_user)):
    q: dict = {}
    if status:
        q["status"] = status
    if news_source_id:
        q["news_source_id"] = news_source_id
    return await find_many("news_items", q, sort_field="published_at", sort_dir=-1, limit=limit)


@router.get("/{item_id}")
async def get_item(item_id: str, _=Depends(get_current_user)):
    item = await find_one("news_items", {"id": item_id})
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    return item


@router.put("/{item_id}/status")
async def set_status(item_id: str, payload: NewsItemStatusUpdate, _=Depends(get_current_user)):
    if payload.status not in {"new", "reviewed", "used", "ignored", "archived"}:
        raise HTTPException(status_code=400, detail="Invalid status")
    updated = await update_one("news_items", {"id": item_id}, {"status": payload.status})
    if not updated:
        raise HTTPException(status_code=404, detail="Item not found")
    return updated


@router.post("/import-url", status_code=status.HTTP_201_CREATED)
async def import_url(payload: ImportUrlRequest, _=Depends(get_current_user)):
    existing = await find_one("news_items", {"url": payload.url})
    if existing:
        return existing
    scraped = await fetch_url(payload.url)
    if not scraped:
        raise HTTPException(status_code=422, detail="Could not fetch or parse URL")
    doc = {
        **base_fields(),
        "news_source_id": payload.news_source_id,
        "title": scraped.get("title", "")[:500],
        "url": scraped.get("url") or payload.url,
        "summary": scraped.get("summary") or "",
        "content_raw": scraped.get("content_raw") or "",
        "content_clean": scraped.get("content_clean") or "",
        "image_url": scraped.get("image_url"),
        "published_at": scraped.get("published_at"),
        "category": scraped.get("category"),
        "status": "new",
    }
    await db["news_items"].insert_one(doc.copy())
    doc.pop("_id", None)
    return doc
