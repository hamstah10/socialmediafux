"""AI content generation + hashtags + compliance + approval workflow."""
from fastapi import APIRouter, Depends, HTTPException, status

from auth import get_current_user
from db import base_fields, db, find_many, find_one, insert_one, update_one
from models import (
    ComplianceRequest,
    GenerateContentRequest,
    GeneratedContentUpdate,
    HashtagRequest,
    TransitionRequest,
)
from services.ai_service import generate_content
from services.compliance import check_compliance
from services.hashtag import generate_hashtags

router = APIRouter(prefix="/generator", tags=["generator"])


# --- Allowed status transitions ---------------------------------------------
ALLOWED_TRANSITIONS: dict[str, set[str]] = {
    "draft": {"review", "archived"},
    "review": {"approved", "draft", "archived"},          # approve / request-changes
    "approved": {"scheduled", "published", "review", "archived"},
    "scheduled": {"published", "approved", "archived"},
    "published": {"archived"},
    "archived": {"draft"},                                # un-archive
}


@router.post("/content", status_code=status.HTTP_201_CREATED)
async def generate(payload: GenerateContentRequest, _=Depends(get_current_user)):
    customer = await find_one("customers", {"id": payload.customer_id})
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    news = None
    if payload.news_item_id:
        news = await find_one("news_items", {"id": payload.news_item_id})
        if not news:
            raise HTTPException(status_code=404, detail="News item not found")

    tone = payload.tone or customer.get("tone_of_voice") or "technisch"
    result = await generate_content(
        customer=customer, news=news, platform=payload.platform,
        tone=tone, cta=payload.cta, target_link=payload.target_link,
        custom_prompt=payload.custom_prompt,
    )

    doc = {
        **base_fields(),
        "customer_id": payload.customer_id,
        "news_item_id": payload.news_item_id,
        "platform": payload.platform,
        "content_type": payload.content_type,
        "title": result.get("title", ""),
        "body": result.get("body", ""),
        "hashtags": result.get("hashtags", []),
        "cta": result.get("cta") or payload.cta or "",
        "target_link": payload.target_link or result.get("target_link") or "",
        "tone": tone,
        "meta_title": result.get("meta_title", ""),
        "meta_description": result.get("meta_description", ""),
        "status": "draft",
    }
    await insert_one("generated_contents", doc)

    if news:
        await update_one("news_items", {"id": news["id"]}, {"status": "used"})

    return doc


@router.post("/hashtags")
async def hashtags(payload: HashtagRequest, _=Depends(get_current_user)):
    services: list[str] = []
    if payload.customer_id:
        customer = await find_one("customers", {"id": payload.customer_id})
        if customer:
            services = customer.get("services", []) or []
    tags = generate_hashtags(payload.text, services=services, platform=payload.platform, count=payload.count)
    return {"hashtags": tags}


@router.post("/compliance-check")
async def compliance(payload: ComplianceRequest, _=Depends(get_current_user)):
    return check_compliance(payload.text)


@router.get("/contents")
async def list_generated(customer_id: str | None = None, platform: str | None = None,
                         status_filter: str | None = None, _=Depends(get_current_user)):
    q: dict = {}
    if customer_id:
        q["customer_id"] = customer_id
    if platform:
        q["platform"] = platform
    if status_filter:
        q["status"] = status_filter
    return await find_many("generated_contents", q, sort_field="created_at", sort_dir=-1)


@router.get("/contents/{content_id}")
async def get_generated(content_id: str, _=Depends(get_current_user)):
    c = await find_one("generated_contents", {"id": content_id})
    if not c:
        raise HTTPException(status_code=404, detail="Not found")
    return c


@router.put("/contents/{content_id}")
async def update_generated(content_id: str, payload: GeneratedContentUpdate,
                            _=Depends(get_current_user)):
    update = {k: v for k, v in payload.model_dump().items() if v is not None}
    updated = await update_one("generated_contents", {"id": content_id}, update)
    if not updated:
        raise HTTPException(status_code=404, detail="Not found")
    return updated


# --- Approval workflow ------------------------------------------------------
@router.post("/contents/{content_id}/transition")
async def transition(content_id: str, payload: TransitionRequest,
                      current=Depends(get_current_user)):
    """Move a content item to a new status if the transition is allowed."""
    content = await find_one("generated_contents", {"id": content_id})
    if not content:
        raise HTTPException(status_code=404, detail="Not found")

    current_status = content.get("status", "draft")
    target = payload.status

    allowed = ALLOWED_TRANSITIONS.get(current_status, set())
    if target not in allowed:
        raise HTTPException(
            status_code=400,
            detail=f"Transition {current_status} → {target} not allowed. "
                   f"Allowed: {sorted(allowed) or '(none)'}",
        )

    updated = await update_one("generated_contents", {"id": content_id}, {"status": target})

    event = {
        **base_fields(),
        "content_id": content_id,
        "from_status": current_status,
        "to_status": target,
        "note": payload.note or "",
        "by_user_id": current.get("id"),
        "by_user_email": current.get("email"),
    }
    await db["approval_events"].insert_one(event.copy())
    event.pop("_id", None)

    return {"content": updated, "event": event}


@router.get("/contents/{content_id}/events")
async def content_events(content_id: str, _=Depends(get_current_user)):
    content = await find_one("generated_contents", {"id": content_id})
    if not content:
        raise HTTPException(status_code=404, detail="Not found")
    events = await find_many(
        "approval_events", {"content_id": content_id},
        sort_field="created_at", sort_dir=-1,
    )
    return {"events": events, "allowed_transitions": sorted(ALLOWED_TRANSITIONS.get(content.get("status", "draft"), set()))}
