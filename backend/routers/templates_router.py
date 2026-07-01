"""Design templates endpoints."""
from fastapi import APIRouter, Depends, HTTPException, status

from auth import get_current_user
from db import base_fields, delete_one, find_many, find_one, insert_one, update_one
from models import TemplateCreate, TemplateUpdate

router = APIRouter(prefix="/templates", tags=["templates"])


@router.get("")
async def list_templates(_=Depends(get_current_user)):
    return await find_many("design_templates")


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_template(payload: TemplateCreate, _=Depends(get_current_user)):
    doc = {**base_fields(), **payload.model_dump()}
    return await insert_one("design_templates", doc)


@router.get("/{template_id}")
async def get_template(template_id: str, _=Depends(get_current_user)):
    t = await find_one("design_templates", {"id": template_id})
    if not t:
        raise HTTPException(status_code=404, detail="Not found")
    return t


@router.put("/{template_id}")
async def update_template(template_id: str, payload: TemplateUpdate, _=Depends(get_current_user)):
    update = {k: v for k, v in payload.model_dump().items() if v is not None}
    updated = await update_one("design_templates", {"id": template_id}, update)
    if not updated:
        raise HTTPException(status_code=404, detail="Not found")
    return updated


@router.delete("/{template_id}")
async def remove_template(template_id: str, _=Depends(get_current_user)):
    ok = await delete_one("design_templates", {"id": template_id})
    if not ok:
        raise HTTPException(status_code=404, detail="Not found")
    return {"ok": True}
