"""Creatives endpoints."""
import io
import json
import os
import zipfile
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse

from auth import get_current_user, require_customer_access, scoped_customer_id
from db import base_fields, find_many, find_one, insert_one, update_one, delete_one
from models import CreativeCreate, CreativeUpdate, BulkFromNewsRequest
from services.ai_service import generate_content
from services.creative import build_preview_html

router = APIRouter(prefix="/creatives", tags=["creatives"])

UPLOAD_DIR = Path(os.environ.get("UPLOAD_DIR", "/app/uploads"))


@router.get("")
async def list_creatives(customer_id: str | None = None, generated_content_id: str | None = None,
                          current=Depends(get_current_user)):
    q: dict = {}
    effective_customer_id = scoped_customer_id(current, customer_id)
    if effective_customer_id:
        q["customer_id"] = effective_customer_id
    if generated_content_id:
        q["generated_content_id"] = generated_content_id
    return await find_many("creatives", q)


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_creative(payload: CreativeCreate, current=Depends(get_current_user)):
    require_customer_access(current, payload.customer_id)
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
        layers=payload.layers,
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
        "layers": payload.layers or [],
        "groups": payload.groups or [],
        "status": "draft",
    }
    await insert_one("creatives", doc)
    return doc


@router.get("/{creative_id}")
async def get_creative(creative_id: str, current=Depends(get_current_user)):
    c = await find_one("creatives", {"id": creative_id})
    if not c:
        raise HTTPException(status_code=404, detail="Not found")
    require_customer_access(current, c.get("customer_id"))
    return c


@router.put("/{creative_id}")
async def update_creative(creative_id: str, payload: CreativeUpdate, current=Depends(get_current_user)):
    existing = await find_one("creatives", {"id": creative_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Not found")
    require_customer_access(current, existing.get("customer_id"))
    update = {k: v for k, v in payload.model_dump().items() if v is not None}
    merged = {**existing, **update}
    # Rebuild preview if visible fields changed
    if any(k in update for k in ("headline", "subline", "cta", "format", "design_template_id",
                                    "background_image_path", "logo_override_path", "layers")):
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
                layers=merged.get("layers"),
            )
            update["preview_html"] = merged["preview_html"]
    return await update_one("creatives", {"id": creative_id}, update)


@router.delete("/{creative_id}")
async def remove_creative(creative_id: str, current=Depends(get_current_user)):
    existing = await find_one("creatives", {"id": creative_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Not found")
    require_customer_access(current, existing.get("customer_id"))
    ok = await delete_one("creatives", {"id": creative_id})
    if not ok:
        raise HTTPException(status_code=404, detail="Not found")
    return {"ok": True}


@router.post("/{creative_id}/export-png")
async def export_png(creative_id: str, current=Depends(get_current_user)):
    c = await find_one("creatives", {"id": creative_id})
    if not c:
        raise HTTPException(status_code=404, detail="Not found")
    require_customer_access(current, c.get("customer_id"))
    if not c.get("preview_html"):
        raise HTTPException(status_code=400, detail="Creative has no preview to render")

    from services.png_export import render_creative_png

    try:
        png_bytes = await render_creative_png(preview_html=c["preview_html"], format=c.get("format", "instagram_square"))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"PNG render failed: {e}")

    creatives_dir = UPLOAD_DIR / "creatives"
    creatives_dir.mkdir(parents=True, exist_ok=True)
    filename = f"{creative_id}.png"
    (creatives_dir / filename).write_bytes(png_bytes)

    image_path = f"/uploads/creatives/{filename}"
    await update_one("creatives", {"id": creative_id}, {"image_path": image_path})
    return {"image_path": image_path}


@router.post("/{creative_id}/export-zip")
async def export_zip(creative_id: str, current=Depends(get_current_user)):
    """Return a ZIP with preview.html, caption.txt, hashtags.txt, post.json, readme."""
    creative = await find_one("creatives", {"id": creative_id})
    if not creative:
        raise HTTPException(status_code=404, detail="Not found")
    require_customer_access(current, creative.get("customer_id"))

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


# ── Bulk generation from a Layout Template + list of News Items ─────────────
def _apply_template_substitutions(layers: list[dict], *, headline: str, body: str,
                                    cta: str, website: str, logo_url: str,
                                    news_image: str) -> list[dict]:
    """Return a fresh copy of layers with role-based text/image substitutions.

    Supported roles:
      - text roles:  headline | subline | cta | website_slot
      - image roles: image_slot (news image) | logo_slot (customer logo)
    """
    subline = (body or "").strip().split("\n\n", 1)[0][:220]
    out: list[dict] = []
    for src in layers or []:
        layer = dict(src)  # shallow copy — layers are flat
        role = layer.get("role") or "static"
        if layer.get("type") == "text":
            if role == "headline" and headline:
                layer["text"] = headline
            elif role == "subline" and subline:
                layer["text"] = subline
            elif role == "cta" and cta:
                layer["text"] = cta
            elif role == "website_slot" and website:
                layer["text"] = website
        elif layer.get("type") == "image":
            if role == "image_slot" and news_image:
                layer["src"] = news_image
            elif role == "logo_slot" and logo_url:
                layer["src"] = logo_url
        out.append(layer)
    return out


@router.post("/bulk-from-news", status_code=status.HTTP_201_CREATED)
async def bulk_from_news(payload: BulkFromNewsRequest, current=Depends(get_current_user)):
    """Generate AI content + a creative for every selected news item, using a
    saved Layout Template as design. AI calls run in parallel for speed.

    Returns: {"created": [{content_id, creative_id, news_item_id, headline}, ...]}
    """
    import asyncio

    require_customer_access(current, payload.customer_id)
    customer = await find_one("customers", {"id": payload.customer_id})
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    template = await find_one("layout_templates", {"id": payload.layout_template_id})
    if not template:
        raise HTTPException(status_code=404, detail="Layout template not found")
    if not payload.news_item_ids:
        raise HTTPException(status_code=400, detail="No news items selected")

    tone = payload.tone or customer.get("tone_of_voice") or "technisch"
    logo_url = customer.get("logo_path") or ""
    website = customer.get("website") or ""

    # Fetch all news items in parallel
    news_docs = await asyncio.gather(*[
        find_one("news_items", {"id": nid}) for nid in payload.news_item_ids
    ])

    # Run AI generation for all valid news items in parallel
    valid_pairs = [(nid, n) for nid, n in zip(payload.news_item_ids, news_docs) if n]
    ai_tasks = [
        generate_content(
            customer=customer, news=n, platform=payload.platform,
            tone=tone, cta=payload.cta, target_link=payload.target_link,
            custom_prompt=payload.custom_prompt,
        )
        for _, n in valid_pairs
    ]
    ai_results = await asyncio.gather(*ai_tasks, return_exceptions=True)

    created: list[dict] = []
    errors: list[dict] = []

    for nid, n in zip(payload.news_item_ids, news_docs):
        if not n:
            errors.append({"news_item_id": nid, "error": "not found"})

    for (nid, news), result in zip(valid_pairs, ai_results):
        if isinstance(result, Exception):
            errors.append({"news_item_id": nid, "error": f"gen: {result}"})
            continue

        content_doc = {
            **base_fields(),
            "customer_id": payload.customer_id,
            "news_item_id": nid,
            "platform": payload.platform,
            "content_type": payload.content_type,
            "title": result.get("title", "")[:200],
            "body": result.get("body", ""),
            "hashtags": result.get("hashtags", []),
            "cta": result.get("cta") or payload.cta or "",
            "target_link": payload.target_link or result.get("target_link") or "",
            "tone": tone,
            "meta_title": result.get("meta_title", ""),
            "meta_description": result.get("meta_description", ""),
            "status": "draft",
        }
        await insert_one("generated_contents", content_doc)
        await update_one("news_items", {"id": nid}, {"status": "used"})

        subst_layers = _apply_template_substitutions(
            template.get("layers") or [],
            headline=content_doc["title"],
            body=content_doc["body"],
            cta=content_doc["cta"] or "Jetzt anfragen",
            website=website,
            logo_url=logo_url,
            news_image=news.get("image_url") or "",
        )

        preview = build_preview_html(
            customer=customer, format=template.get("format", "instagram_square"),
            headline=content_doc["title"], subline="",
            cta="", logo_url=logo_url,
            background_image_url="",
            template=None,
            layers=subst_layers,
        )

        creative_doc = {
            **base_fields(),
            "customer_id": payload.customer_id,
            "generated_content_id": content_doc["id"],
            "design_template_id": None,
            "format": template.get("format", "instagram_square"),
            "headline": content_doc["title"],
            "subline": "",
            "cta": content_doc["cta"],
            "logo_path": logo_url,
            "background_image_path": None,
            "logo_override_path": None,
            "image_path": None,
            "preview_html": preview,
            "layers": subst_layers,
            "groups": template.get("groups") or [],
            "layout_template_id": template.get("id"),
            "status": "draft",
        }
        await insert_one("creatives", creative_doc)

        created.append({
            "news_item_id": nid,
            "content_id": content_doc["id"],
            "creative_id": creative_doc["id"],
            "headline": content_doc["title"],
        })

    return {"created": created, "errors": errors, "count": len(created)}
