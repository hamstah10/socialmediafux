"""Public approval links for external customer sign-off (no auth required)."""
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status

from auth import get_current_user, require_customer_access, scoped_customer_id
from db import base_fields, db, find_many, find_one, insert_one, update_one, utcnow_iso
from models import ApprovalCreateRequest, ApprovalDecision

router = APIRouter(prefix="/approvals", tags=["approvals"])


def _token() -> str:
    return secrets.token_urlsafe(24)


@router.post("/create", status_code=status.HTTP_201_CREATED)
async def create_link(payload: ApprovalCreateRequest, current=Depends(get_current_user)):
    if not payload.generated_content_id and not payload.generated_creative_id:
        raise HTTPException(status_code=400, detail="content or creative id required")

    content = None
    creative = None
    customer_id = None
    if payload.generated_content_id:
        content = await find_one("generated_contents", {"id": payload.generated_content_id})
        if not content:
            raise HTTPException(status_code=404, detail="Content not found")
        customer_id = content.get("customer_id")
    if payload.generated_creative_id:
        creative = await find_one("creatives", {"id": payload.generated_creative_id})
        if not creative:
            raise HTTPException(status_code=404, detail="Creative not found")
        customer_id = customer_id or creative.get("customer_id")

    require_customer_access(current, customer_id)

    expires_at = (
        datetime.now(timezone.utc) + timedelta(days=max(1, payload.expires_in_days))
    ).isoformat()

    doc = {
        **base_fields(),
        "customer_id": customer_id,
        "generated_content_id": payload.generated_content_id,
        "generated_creative_id": payload.generated_creative_id,
        "token": _token(),
        "expires_at": expires_at,
        "status": "pending",
        "customer_comment": None,
        "created_by_user_id": current.get("id"),
        "created_by_user_email": current.get("email"),
    }
    return await insert_one("approval_links", doc)


# --- Public endpoints (no auth) ---
@router.get("/public/{token}")
async def get_public(token: str):
    link = await find_one("approval_links", {"token": token})
    if not link:
        raise HTTPException(status_code=404, detail="Approval link not found")
    if link.get("expires_at") and link["expires_at"] < utcnow_iso():
        await update_one("approval_links", {"id": link["id"]}, {"status": "expired"})
        link["status"] = "expired"

    content = None
    creative = None
    customer = None
    if link.get("generated_content_id"):
        content = await find_one("generated_contents", {"id": link["generated_content_id"]})
    if link.get("generated_creative_id"):
        creative = await find_one("creatives", {"id": link["generated_creative_id"]})
    if link.get("customer_id"):
        customer = await find_one("customers", {"id": link["customer_id"]})
        if customer:
            customer = {k: customer.get(k) for k in
                       ["id", "name", "logo_path", "accent_color", "primary_color", "website"]}

    return {"link": link, "content": content, "creative": creative, "customer": customer}


async def _decide(token: str, decision: str, comment: str | None) -> dict:
    link = await find_one("approval_links", {"token": token})
    if not link:
        raise HTTPException(status_code=404, detail="Approval link not found")
    if link["status"] in ("approved", "rejected", "expired"):
        raise HTTPException(status_code=400, detail=f"Link already {link['status']}")
    if link.get("expires_at") and link["expires_at"] < utcnow_iso():
        await update_one("approval_links", {"id": link["id"]}, {"status": "expired"})
        raise HTTPException(status_code=400, detail="Link expired")

    updated = await update_one("approval_links", {"id": link["id"]},
                                {"status": decision, "customer_comment": comment or ""})

    # Mirror to the underlying content status where sensible
    if link.get("generated_content_id"):
        new_status = {"approved": "approved", "changes_requested": "review",
                       "rejected": "archived"}.get(decision)
        if new_status:
            await update_one("generated_contents", {"id": link["generated_content_id"]},
                              {"status": new_status})
        # Log event for audit trail
        event = {
            **base_fields(),
            "content_id": link["generated_content_id"],
            "from_status": "review",
            "to_status": new_status or decision,
            "note": f"[public] {comment or ''}",
            "by_user_email": "customer@public",
        }
        await db["approval_events"].insert_one(event.copy())
    return updated


@router.post("/public/{token}/approve")
async def approve(token: str, payload: ApprovalDecision):
    return await _decide(token, "approved", payload.comment)


@router.post("/public/{token}/request-changes")
async def request_changes(token: str, payload: ApprovalDecision):
    return await _decide(token, "changes_requested", payload.comment)


@router.post("/public/{token}/reject")
async def reject(token: str, payload: ApprovalDecision):
    return await _decide(token, "rejected", payload.comment)


# --- Admin listing ---
@router.get("")
async def list_links(content_id: str | None = None, current=Depends(get_current_user)):
    q: dict = {}
    if content_id:
        q["generated_content_id"] = content_id
    effective_customer_id = scoped_customer_id(current)
    if effective_customer_id:
        q["customer_id"] = effective_customer_id
    return await find_many("approval_links", q, sort_field="created_at", sort_dir=-1)
