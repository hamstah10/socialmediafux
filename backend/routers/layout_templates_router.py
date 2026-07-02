"""Layout Templates — save/load compositions from the Layout Editor."""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status

from auth import get_current_user, is_customer_scoped, require_customer_access
from db import base_fields, find_many, find_one, insert_one, update_one, delete_one
from models import LayoutTemplateCreate, LayoutTemplateUpdate

router = APIRouter(prefix="/layout-templates", tags=["layout-templates"])


@router.get("")
async def list_templates(customer_id: Optional[str] = Query(None),
                          include_global: bool = Query(True),
                          current=Depends(get_current_user)):
    """List layout templates. If customer_id is given, returns that customer's
    templates plus (optionally) global ones."""
    if is_customer_scoped(current):
        customer_id = current.get("customer_id")
        if not customer_id:
            return []
    if customer_id:
        query = {"$or": [{"customer_id": customer_id}]}
        if include_global:
            query["$or"].append({"is_global": True})
        return await find_many("layout_templates", query, sort_field="created_at", sort_dir=-1)
    return await find_many("layout_templates", {}, sort_field="created_at", sort_dir=-1)


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_template(payload: LayoutTemplateCreate, current=Depends(get_current_user)):
    if not payload.is_global and not payload.customer_id:
        raise HTTPException(status_code=400, detail="customer_id required for non-global templates")
    if is_customer_scoped(current) and payload.is_global:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    require_customer_access(current, payload.customer_id)
    if payload.customer_id:
        if not await find_one("customers", {"id": payload.customer_id}):
            raise HTTPException(status_code=404, detail="Customer not found")
    doc = {
        **base_fields(),
        "name": payload.name,
        "customer_id": payload.customer_id,
        "is_global": bool(payload.is_global),
        "format": payload.format,
        "layers": payload.layers or [],
        "groups": payload.groups or [],
        "thumbnail_path": payload.thumbnail_path,
    }
    await insert_one("layout_templates", doc)
    return doc


@router.get("/{tpl_id}")
async def get_template(tpl_id: str, current=Depends(get_current_user)):
    t = await find_one("layout_templates", {"id": tpl_id})
    if not t:
        raise HTTPException(status_code=404, detail="Not found")
    if not t.get("is_global"):
        require_customer_access(current, t.get("customer_id"))
    return t


@router.put("/{tpl_id}")
async def update_template(tpl_id: str, payload: LayoutTemplateUpdate,
                           current=Depends(get_current_user)):
    existing = await find_one("layout_templates", {"id": tpl_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Not found")
    if not existing.get("is_global"):
        require_customer_access(current, existing.get("customer_id"))
    elif is_customer_scoped(current):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    update = {k: v for k, v in payload.model_dump().items() if v is not None}
    updated = await update_one("layout_templates", {"id": tpl_id}, update)
    if not updated:
        raise HTTPException(status_code=404, detail="Not found")
    return updated


@router.delete("/{tpl_id}")
async def remove_template(tpl_id: str, current=Depends(get_current_user)):
    existing = await find_one("layout_templates", {"id": tpl_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Not found")
    if not existing.get("is_global"):
        require_customer_access(current, existing.get("customer_id"))
    elif is_customer_scoped(current):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    ok = await delete_one("layout_templates", {"id": tpl_id})
    if not ok:
        raise HTTPException(status_code=404, detail="Not found")
    return {"ok": True}
