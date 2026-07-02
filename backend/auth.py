"""JWT authentication utilities."""
import os
from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from db import get_user_by_id

JWT_SECRET = os.environ.get("JWT_SECRET", "change_me")
JWT_ALGORITHM = os.environ.get("JWT_ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.environ.get("ACCESS_TOKEN_EXPIRE_MINUTES", "1440"))

bearer_scheme = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def create_access_token(subject: str, extra: Optional[dict] = None) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": subject,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)).timestamp()),
    }
    if extra:
        payload.update(extra)
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> dict:
    if not credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    payload = decode_token(credentials.credentials)
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload")
    user = await get_user_by_id(user_id)
    if not user or not user.get("is_active", True):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found or inactive")
    user.pop("password_hash", None)
    return user


def is_customer_scoped(user: dict) -> bool:
    """True if `user` is restricted to a single customer's data (role
    'customer'). Admins/superadmins/editors are unrestricted."""
    return user.get("role") == "customer"


def require_customer_access(user: dict, customer_id: str | None) -> None:
    """Raise 403 if a customer-scoped user tries to access a different
    customer's data. No-op for unrestricted roles or when customer_id is
    unknown/unset on the resource (nothing to check against)."""
    if not is_customer_scoped(user):
        return
    if customer_id and customer_id != user.get("customer_id"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized for this customer")


def scoped_customer_id(user: dict, requested_customer_id: str | None = None) -> str | None:
    """Resolve the customer_id a list endpoint should filter by.

    Customer-scoped users are always pinned to their own customer_id
    (ignoring/overriding whatever was requested). Unrestricted roles use
    whatever was requested (may be None for "all customers").
    """
    if is_customer_scoped(user):
        return user.get("customer_id")
    return requested_customer_id
