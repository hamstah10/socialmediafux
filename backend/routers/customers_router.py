"""Customer / Mandant endpoints."""
import os
import re
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status

from auth import get_current_user, is_customer_scoped, require_customer_access
from db import base_fields, delete_one, find_many, find_one, insert_one, update_one
from models import CustomerCreate, CustomerUpdate

router = APIRouter(prefix="/customers", tags=["customers"])

UPLOAD_DIR = Path(os.environ.get("UPLOAD_DIR", "/app/uploads"))
LOGO_DIR = UPLOAD_DIR / "logos"
LOGO_DIR.mkdir(parents=True, exist_ok=True)


def _slugify(name: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return s or "customer"


@router.get("")
async def list_customers(current=Depends(get_current_user)):
    if is_customer_scoped(current):
        if not current.get("customer_id"):
            return []
        return await find_many("customers", {"id": current["customer_id"]})
    return await find_many("customers", sort_field="created_at", sort_dir=-1)


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_customer(payload: CustomerCreate, current=Depends(get_current_user)):
    if is_customer_scoped(current):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    data = payload.model_dump()
    data["slug"] = data.get("slug") or _slugify(data["name"])
    data["logo_path"] = None
    doc = {**base_fields(), **data}
    return await insert_one("customers", doc)


@router.get("/{customer_id}")
async def get_customer(customer_id: str, current=Depends(get_current_user)):
    require_customer_access(current, customer_id)
    c = await find_one("customers", {"id": customer_id})
    if not c:
        raise HTTPException(status_code=404, detail="Customer not found")
    return c


@router.put("/{customer_id}")
async def update_customer(customer_id: str, payload: CustomerUpdate, current=Depends(get_current_user)):
    require_customer_access(current, customer_id)
    update = {k: v for k, v in payload.model_dump().items() if v is not None}
    if "name" in update and not update.get("slug"):
        update["slug"] = _slugify(update["name"])
    updated = await update_one("customers", {"id": customer_id}, update)
    if not updated:
        raise HTTPException(status_code=404, detail="Customer not found")
    return updated


@router.delete("/{customer_id}")
async def remove_customer(customer_id: str, current=Depends(get_current_user)):
    if is_customer_scoped(current):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    ok = await delete_one("customers", {"id": customer_id})
    if not ok:
        raise HTTPException(status_code=404, detail="Customer not found")
    return {"ok": True}


@router.post("/{customer_id}/logo")
async def upload_logo(customer_id: str, file: UploadFile = File(...), current=Depends(get_current_user)):
    require_customer_access(current, customer_id)
    customer = await find_one("customers", {"id": customer_id})
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    ext = (Path(file.filename or "logo.png").suffix or ".png").lower()
    if ext not in {".png", ".jpg", ".jpeg", ".webp", ".svg"}:
        raise HTTPException(status_code=400, detail="Unsupported image type")

    filename = f"{customer_id}{ext}"
    dest = LOGO_DIR / filename
    content = await file.read()
    dest.write_bytes(content)

    logo_path = f"/uploads/logos/{filename}"
    return await update_one("customers", {"id": customer_id}, {"logo_path": logo_path})
