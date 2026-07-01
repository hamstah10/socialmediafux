"""Creatives endpoints."""
import io
import json
import zipfile

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse

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

    template = None
    if payload.design_template_id:
        template = await find_one("design_templates", {"id": payload.design_template_id})

    # Resolve logo url — override wins over customer default
    logo_url = payload.logo_override_path or customer.get("logo_path") or ""

    preview = build_preview_html(
        customer=customer, format=payload.format,
        headline=payload.headline, subline=payload.subline or "",
        cta=payload.cta or "", logo_url=logo_url,
        background_image_url=payload.background_image_path or "",
        template=template,
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
        "logo_path": logo_url,
        "background_image_path": payload.background_image_path,
        "logo_override_path": payload.logo_override_path,
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
    if any(k in update for k in ("headline", "subline", "cta", "format", "design_template_id",
                                    "background_image_path", "logo_override_path")):
        customer = await find_one("customers", {"id": merged["customer_id"]})
        template = None
        if merged.get("design_template_id"):
            template = await find_one("design_templates", {"id": merged["design_template_id"]})
        if customer:
            logo_url = merged.get("logo_override_path") or customer.get("logo_path") or ""
            merged["preview_html"] = build_preview_html(
                customer=customer, format=merged["format"],
                headline=merged["headline"], subline=merged.get("subline", ""),
                cta=merged.get("cta", ""), logo_url=logo_url,
                background_image_url=merged.get("background_image_path") or "",
                template=template,
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


@router.post("/{creative_id}/export-zip")
async def export_zip(creative_id: str, _=Depends(get_current_user)):
    """Return a ZIP with preview.html, caption.txt, hashtags.txt, post.json, readme."""
    creative = await find_one("creatives", {"id": creative_id})
    if not creative:
        raise HTTPException(status_code=404, detail="Not found")

    content = None
    if creative.get("generated_content_id"):
        content = await find_one("generated_contents", {"id": creative["generated_content_id"]})
    customer = await find_one("customers", {"id": creative["customer_id"]})

    body = (content or {}).get("body", "")
    title = (content or {}).get("title", creative.get("headline", ""))
    hashtags = (content or {}).get("hashtags", []) or []
    cta = (content or {}).get("cta") or creative.get("cta") or ""

    caption = f"{title}\n\n{body}\n\n{cta}\n\n{' '.join(hashtags)}"

    post_json = {
        "customer": customer.get("name") if customer else None,
        "platform": (content or {}).get("platform"),
        "title": title,
        "body": body,
        "cta": cta,
        "hashtags": hashtags,
        "target_link": (content or {}).get("target_link"),
        "creative": {
            "format": creative.get("format"),
            "headline": creative.get("headline"),
            "subline": creative.get("subline"),
            "cta": creative.get("cta"),
        },
    }

    readme = (
        "SocialFUX Export Paket\n"
        "======================\n\n"
        f"Kunde: {customer.get('name') if customer else '-'}\n"
        f"Format: {creative.get('format')}\n"
        f"Creative-ID: {creative.get('id')}\n\n"
        "Dateien:\n"
        " - preview.html   Vorschau des Creatives (Browser öffnen)\n"
        " - caption.txt    Fertiger Post-Text mit Hashtags\n"
        " - hashtags.txt   Hashtags einzeln\n"
        " - post.json      Alle strukturierten Felder\n\n"
        "Hinweis: PNG-Export wird auf dem VPS via Playwright aktiviert. "
        "Bis dahin kann preview.html per Browser -> Screenshot exportiert werden."
    )

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("preview.html", creative.get("preview_html") or "")
        z.writestr("caption.txt", caption)
        z.writestr("hashtags.txt", "\n".join(hashtags))
        z.writestr("post.json", json.dumps(post_json, indent=2, ensure_ascii=False))
        z.writestr("readme.txt", readme)
    buf.seek(0)

    safe_name = "".join(ch for ch in (customer.get("slug") if customer else "creative") if ch.isalnum() or ch in "-_")
    return StreamingResponse(
        buf,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{safe_name}-{creative_id[:8]}.zip"'},
    )
