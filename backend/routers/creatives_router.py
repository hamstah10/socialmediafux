"""Creatives endpoints."""
from fastapi import APIRouter, Depends, HTTPException, status

from auth import get_current_user
from db import base_fields, find_many, find_one, insert_one, update_one, delete_one
from models import CreativeCreate, CreativeUpdate
from services.creative import build_preview_html

router = APIRouter(prefix="/creatives", tags=["creatives"])


@router.get("")
async def list_creatives(customer_id: str | None = None, _=Depends(get_current_user)):
    q: dict = {}
    if customer_id:
        q["customer_id"] = customer_id
    return await find_many("creatives", q)


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_creative(payload: CreativeCreate, _=Depends(get_current_user)):
    customer = await find_one("customers", {"id": payload.customer_id})
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    preview = build_preview_html(
        customer=customer, format=payload.format,
        headline=payload.headline, subline=payload.subline or "",
        cta=payload.cta or "", logo_url=customer.get("logo_path") or "",
    )
    doc = {
        **base_fields(),
        "customer_id": payload.customer_id,
        "generated_content_id": payload.generated_content_id,
        "design_template_id": payload.design_template_id,
        "format": payload.format,
        "headline": payload.headline,
        "subline": payload.subline or "",
        "cta": payload.cta or "",
        "logo_path": customer.get("logo_path"),
        "image_path": None,
        "preview_html": preview,
        "status": "draft",
    }
    await insert_one("creatives", doc)
    return doc


@router.get("/{creative_id}")
async def get_creative(creative_id: str, _=Depends(get_current_user)):
    c = await find_one("creatives", {"id": creative_id})
    if not c:
        raise HTTPException(status_code=404, detail="Not found")
    return c


@router.put("/{creative_id}")
async def update_creative(creative_id: str, payload: CreativeUpdate, _=Depends(get_current_user)):
    current = await find_one("creatives", {"id": creative_id})
    if not current:
        raise HTTPException(status_code=404, detail="Not found")
    update = {k: v for k, v in payload.model_dump().items() if v is not None}
    merged = {**current, **update}
    # Rebuild preview if visible fields changed
    if any(k in update for k in ("headline", "subline", "cta", "format")):
        customer = await find_one("customers", {"id": merged["customer_id"]})
        if customer:
            merged["preview_html"] = build_preview_html(
                customer=customer, format=merged["format"],
                headline=merged["headline"], subline=merged.get("subline", ""),
                cta=merged.get("cta", ""), logo_url=customer.get("logo_path") or "",
            )
            update["preview_html"] = merged["preview_html"]
    return await update_one("creatives", {"id": creative_id}, update)


@router.delete("/{creative_id}")
async def remove_creative(creative_id: str, _=Depends(get_current_user)):
    ok = await delete_one("creatives", {"id": creative_id})
    if not ok:
        raise HTTPException(status_code=404, detail="Not found")
    return {"ok": True}


@router.post("/{creative_id}/export-png")
async def export_png(creative_id: str, _=Depends(get_current_user)):
    c = await find_one("creatives", {"id": creative_id})
    if not c:
        raise HTTPException(status_code=404, detail="Not found")
    # Playwright not installed in this MVP
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="PNG export not available. Please install Playwright.",
    )
