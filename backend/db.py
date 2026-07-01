"""MongoDB connection and helper utilities for SocialFUX."""
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone
from typing import Any
import os
import uuid

_mongo_url = os.environ['MONGO_URL']
_db_name = os.environ['DB_NAME']

client = AsyncIOMotorClient(_mongo_url)
db = client[_db_name]


def new_id() -> str:
    """Generate a new UUID4-based string id."""
    return str(uuid.uuid4())


def utcnow_iso() -> str:
    """Return current UTC time as ISO string (ready to store in Mongo)."""
    return datetime.now(timezone.utc).isoformat()


def strip_mongo_id(doc: dict | None) -> dict | None:
    """Remove Mongo internal _id from a document (we use our own `id`)."""
    if doc is None:
        return None
    doc.pop("_id", None)
    return doc


async def find_one(collection: str, query: dict) -> dict | None:
    doc = await db[collection].find_one(query)
    return strip_mongo_id(doc)


async def find_many(collection: str, query: dict | None = None, sort_field: str = "created_at",
                    sort_dir: int = -1, limit: int = 500) -> list[dict]:
    cursor = db[collection].find(query or {}, {"_id": 0}).sort(sort_field, sort_dir).limit(limit)
    return await cursor.to_list(length=limit)


async def insert_one(collection: str, doc: dict) -> dict:
    await db[collection].insert_one(doc.copy())
    return strip_mongo_id(doc)


async def update_one(collection: str, query: dict, update: dict) -> dict | None:
    update["updated_at"] = utcnow_iso()
    await db[collection].update_one(query, {"$set": update})
    return await find_one(collection, query)


async def delete_one(collection: str, query: dict) -> bool:
    r = await db[collection].delete_one(query)
    return r.deleted_count > 0


def base_fields(**extra: Any) -> dict:
    """Return base fields for a new document (id, created_at, updated_at)."""
    now = utcnow_iso()
    return {"id": new_id(), "created_at": now, "updated_at": now, **extra}
