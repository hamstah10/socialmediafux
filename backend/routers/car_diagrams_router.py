"""Motorraum-Schaubild-Generator: Fahrzeuge, Basisbilder, generierte Schaubilder.

Generierte Bilder werden als normale `media_assets` (Kategorie "Motorraum")
gespeichert, damit sie sofort in der Media Library und im Creative Editor
als Bildebene verfügbar sind.
"""
import os
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status

from auth import get_current_user, is_customer_scoped, require_customer_access
from db import base_fields, delete_one, find_many, find_one, insert_one, new_id, update_one
from models import CarDiagramCreate, CarDiagramGenerateRequest, CarDiagramUpdate
from services.car_diagram import build_base_prompt, build_diagram_prompt, generate_image

router = APIRouter(prefix="/car-diagrams", tags=["car-diagrams"])

UPLOAD_DIR = Path(os.environ.get("UPLOAD_DIR", "/app/uploads"))
MEDIA_DIR = UPLOAD_DIR / "media"
MEDIA_DIR.mkdir(parents=True, exist_ok=True)

ALLOWED_EXT = {".png", ".jpg", ".jpeg", ".webp"}
MAX_SIZE = 10 * 1024 * 1024  # 10 MB


async def _get_owned(diagram_id: str, current: dict) -> dict:
    doc = await find_one("car_diagrams", {"id": diagram_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Fahrzeug nicht gefunden")
    require_customer_access(current, doc.get("customer_id"))
    return doc


async def _store_media_asset(content: bytes, ext: str, customer_id: Optional[str],
                             category: str, tags: list[str]) -> dict:
    filename = f"{new_id()}{ext}"
    (MEDIA_DIR / filename).write_bytes(content)
    doc = {
        **base_fields(),
        "customer_id": customer_id,
        "file_path": f"/uploads/media/{filename}",
        "original_name": filename,
        "file_type": ext.lstrip("."),
        "file_size": len(content),
        "category": category,
        "tags": tags,
        "source": "car_diagram_generator",
        "license_note": "",
    }
    return await insert_one("media_assets", doc)


@router.get("")
async def list_diagrams(customer_id: Optional[str] = None, current=Depends(get_current_user)):
    q: dict = {}
    if not is_customer_scoped(current) and customer_id:
        q["customer_id"] = customer_id
    docs = await find_many("car_diagrams", q, sort_field="updated_at", sort_dir=-1)
    if is_customer_scoped(current):
        own_id = current.get("customer_id")
        docs = [d for d in docs if d.get("customer_id") in (None, own_id)]
    return docs


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_diagram(payload: CarDiagramCreate, current=Depends(get_current_user)):
    require_customer_access(current, payload.customer_id)
    doc = {
        **base_fields(),
        "customer_id": payload.customer_id,
        "vehicle": payload.vehicle,
        "year": payload.year or "",
        "engine": payload.engine,
        "motorroom_media_asset_id": None,
        "trunk_media_asset_id": None,
        "base_prompt": "",
        "trunk_prompt": "",
        "prompt_templates": [],
    }
    return await insert_one("car_diagrams", doc)


@router.put("/{diagram_id}")
async def update_diagram(diagram_id: str, payload: CarDiagramUpdate, current=Depends(get_current_user)):
    await _get_owned(diagram_id, current)
    updates = {k: v for k, v in payload.model_dump(exclude_unset=True).items()}
    updated = await update_one("car_diagrams", {"id": diagram_id}, updates)
    if not updated:
        raise HTTPException(status_code=404, detail="Fahrzeug nicht gefunden")
    return updated


@router.delete("/{diagram_id}")
async def delete_diagram(diagram_id: str, current=Depends(get_current_user)):
    await _get_owned(diagram_id, current)
    await delete_one("car_diagrams", {"id": diagram_id})
    return {"ok": True}


@router.post("/{diagram_id}/upload-base")
async def upload_base(diagram_id: str, image_area: str = "motorroom",
                      file: UploadFile = File(...), current=Depends(get_current_user)):
    doc = await _get_owned(diagram_id, current)
    ext = (Path(file.filename or "image.png").suffix or ".png").lower()
    if ext not in ALLOWED_EXT:
        raise HTTPException(status_code=400, detail=f"Extension {ext} not allowed")
    content = await file.read()
    if len(content) > MAX_SIZE:
        raise HTTPException(status_code=413, detail="File exceeds 10 MB")

    category_tag = "Kofferraum" if image_area == "trunk" else "Motorraum"
    asset = await _store_media_asset(content, ext, doc.get("customer_id"), "Motorraum",
                                     [doc["vehicle"], category_tag])
    field = "trunk_media_asset_id" if image_area == "trunk" else "motorroom_media_asset_id"
    updated = await update_one("car_diagrams", {"id": diagram_id}, {field: asset["id"]})
    return updated


@router.post("/{diagram_id}/generate-base")
async def generate_base(diagram_id: str, image_area: str = "motorroom", current=Depends(get_current_user)):
    doc = await _get_owned(diagram_id, current)
    if not os.environ.get("OPENAI_API_KEY"):
        raise HTTPException(status_code=400, detail="OPENAI_API_KEY fehlt")

    prompt = build_base_prompt(doc["vehicle"], doc.get("year", ""), doc["engine"], image_area=image_area)
    try:
        content, _mode = generate_image(prompt)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Basisbild fehlgeschlagen: {exc}")

    category_tag = "Kofferraum" if image_area == "trunk" else "Motorraum"
    asset = await _store_media_asset(content, ".png", doc.get("customer_id"), "Motorraum",
                                     [doc["vehicle"], category_tag])
    field = "trunk_media_asset_id" if image_area == "trunk" else "motorroom_media_asset_id"
    prompt_field = "trunk_prompt" if image_area == "trunk" else "base_prompt"
    updated = await update_one("car_diagrams", {"id": diagram_id},
                               {field: asset["id"], prompt_field: prompt})
    return updated


@router.post("/{diagram_id}/generate")
async def generate_diagram(diagram_id: str, payload: CarDiagramGenerateRequest, current=Depends(get_current_user)):
    doc = await _get_owned(diagram_id, current)
    if not os.environ.get("OPENAI_API_KEY"):
        raise HTTPException(status_code=400, detail="OPENAI_API_KEY fehlt")

    base_bytes = None
    if payload.use_saved_base:
        field = "trunk_media_asset_id" if payload.image_area == "trunk" else "motorroom_media_asset_id"
        asset_id = doc.get(field)
        if asset_id:
            asset = await find_one("media_assets", {"id": asset_id})
            if asset:
                rel = asset["file_path"].replace("/uploads/", "")
                base_path = UPLOAD_DIR / rel
                if base_path.exists():
                    base_bytes = base_path.read_bytes()

    prompt = build_diagram_prompt(
        vehicle=doc["vehicle"], year=doc.get("year", ""), engine=doc["engine"],
        diagram_title=payload.diagram_title, markings=payload.markings,
        perspective=payload.perspective, language=payload.language,
        detail_view=payload.detail_view, realistic=payload.realistic,
        notes=payload.notes, reuse_base=bool(base_bytes),
    )
    try:
        content, mode = generate_image(prompt, base_bytes)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Bildgenerierung fehlgeschlagen: {exc}")

    asset = await _store_media_asset(content, ".png", doc.get("customer_id"), "Motorraum",
                                     [doc["vehicle"], payload.diagram_title])

    if payload.save_prompt_name:
        templates = doc.get("prompt_templates") or []
        templates.append({
            "name": payload.save_prompt_name,
            "diagram_title": payload.diagram_title,
            "markings": payload.markings,
            "perspective": payload.perspective,
            "language": payload.language,
            "notes": payload.notes or "",
            "detail_view": payload.detail_view,
            "realistic": payload.realistic,
        })
        await update_one("car_diagrams", {"id": diagram_id}, {"prompt_templates": templates})

    return {"media_asset": asset, "prompt": prompt, "mode": mode}
