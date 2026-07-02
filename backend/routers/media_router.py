"""Media library: reusable assets (logos, backgrounds, ECU shots, tool photos)."""
import os
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status

from auth import get_current_user, is_customer_scoped, require_customer_access
from db import base_fields, db, delete_one, find_many, find_one, insert_one, update_one

router = APIRouter(prefix="/media", tags=["media"])

UPLOAD_DIR = Path(os.environ.get("UPLOAD_DIR", "/app/uploads"))
MEDIA_DIR = UPLOAD_DIR / "media"
MEDIA_DIR.mkdir(parents=True, exist_ok=True)

ALLOWED_EXT = {".png", ".jpg", ".jpeg", ".webp", ".svg", ".gif"}
MAX_SIZE = 10 * 1024 * 1024  # 10 MB

CATEGORIES = ["Logo", "Background", "ECU", "Werkstatt", "Auto", "Tool",
              "Icon", "Creative Export", "News Image"]


@router.get("")
async def list_assets(customer_id: Optional[str] = None, category: Optional[str] = None,
                      current=Depends(get_current_user)):
    q: dict = {}
    if not is_customer_scoped(current) and customer_id:
        q["customer_id"] = customer_id
    if category:
        q["category"] = category
    assets = await find_many("media_assets", q, sort_field="created_at", sort_dir=-1)
    if is_customer_scoped(current):
        own_id = current.get("customer_id")
        assets = [a for a in assets if a.get("customer_id") in (None, own_id)]
    return assets


@router.get("/categories")
async def list_categories(_=Depends(get_current_user)):
    return {"categories": CATEGORIES}


@router.post("/upload", status_code=status.HTTP_201_CREATED)
async def upload_asset(
    file: UploadFile = File(...),
    category: str = Form("Background"),
    customer_id: Optional[str] = Form(None),
    tags: str = Form(""),
    source: str = Form(""),
    license_note: str = Form(""),
    current=Depends(get_current_user),
):
    require_customer_access(current, customer_id)
    ext = (Path(file.filename or "asset.png").suffix or ".png").lower()
    if ext not in ALLOWED_EXT:
        raise HTTPException(status_code=400, detail=f"Extension {ext} not allowed")

    content = await file.read()
    if len(content) > MAX_SIZE:
        raise HTTPException(status_code=413, detail="File exceeds 10 MB")

    from db import new_id
    filename = f"{new_id()}{ext}"
    dest = MEDIA_DIR / filename
    dest.write_bytes(content)

    doc = {
        **base_fields(),
        "customer_id": customer_id,
        "file_path": f"/uploads/media/{filename}",
        "original_name": file.filename,
        "file_type": ext.lstrip("."),
        "file_size": len(content),
        "category": category if category in CATEGORIES else "Background",
        "tags": [t.strip() for t in tags.split(",") if t.strip()],
        "source": source,
        "license_note": license_note,
    }
    return await insert_one("media_assets", doc)


@router.put("/{asset_id}")
async def update_asset(asset_id: str, payload: dict, current=Depends(get_current_user)):
    existing = await find_one("media_assets", {"id": asset_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Not found")
    require_customer_access(current, existing.get("customer_id"))
    allowed = {k: v for k, v in payload.items() if k in {"category", "tags", "source",
                                                          "license_note", "customer_id"}}
    if "customer_id" in allowed:
        require_customer_access(current, allowed["customer_id"])
    updated = await update_one("media_assets", {"id": asset_id}, allowed)
    if not updated:
        raise HTTPException(status_code=404, detail="Not found")
    return updated


@router.delete("/{asset_id}")
async def remove_asset(asset_id: str, current=Depends(get_current_user)):
    asset = await find_one("media_assets", {"id": asset_id})
    if not asset:
        raise HTTPException(status_code=404, detail="Not found")
    require_customer_access(current, asset.get("customer_id"))
    # Try to unlink physical file
    try:
        rel = asset["file_path"].replace("/uploads/", "")
        (UPLOAD_DIR / rel).unlink(missing_ok=True)
    except Exception:
        pass
    await delete_one("media_assets", {"id": asset_id})
    return {"ok": True}
