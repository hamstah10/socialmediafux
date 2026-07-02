"""Auth endpoints."""
from fastapi import APIRouter, Depends, HTTPException, status

from auth import create_access_token, get_current_user, verify_password
from db import get_user_by_email
from models import LoginRequest, LoginResponse

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=LoginResponse)
async def login(payload: LoginRequest):
    user = await get_user_by_email(payload.email.lower())
    if not user or not verify_password(payload.password, user.get("password_hash", "")):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    if not user.get("is_active", True):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account inactive")

    token = create_access_token(subject=user["id"], extra={"role": user.get("role", "user")})
    user.pop("password_hash", None)
    return {"access_token": token, "token_type": "bearer", "user": user}


@router.get("/me")
async def me(current=Depends(get_current_user)):
    return current


@router.post("/logout")
async def logout(_=Depends(get_current_user)):
    # Stateless JWT: client should discard token.
    return {"ok": True}
