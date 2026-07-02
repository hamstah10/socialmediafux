"""Dashboard aggregation."""
from fastapi import APIRouter, Depends

from auth import get_current_user, is_customer_scoped
from db import count_documents, db, find_many

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/stats")
async def stats(current=Depends(get_current_user)):
    if is_customer_scoped(current):
        own_id = current.get("customer_id")
        content_q: dict = {"customer_id": own_id} if own_id else {"id": "__none__"}
        customers_count = 1 if own_id else 0
        drafts_count = await count_documents("generated_contents", {**content_q, "status": "draft"})
        approved_count = await count_documents("generated_contents", {**content_q, "status": "approved"})
        published_count = await count_documents("generated_contents", {**content_q, "status": "published"})
        news_new_count = await db["news_items"].count_documents({"status": "new"})
        latest_news = await find_many(
            "news_items", {"status": {"$nin": ["ignored", "archived"]}},
            sort_field="created_at", sort_dir=-1, limit=6,
        )
        latest_generated_content = await find_many(
            "generated_contents", content_q, sort_field="created_at", sort_dir=-1, limit=6,
        ) if own_id else []
    else:
        customers_count = await db["customers"].count_documents({})
        news_new_count = await db["news_items"].count_documents({"status": "new"})
        drafts_count = await db["generated_contents"].count_documents({"status": "draft"})
        approved_count = await db["generated_contents"].count_documents({"status": "approved"})
        published_count = await db["generated_contents"].count_documents({"status": "published"})

        latest_news = await find_many(
            "news_items", {"status": {"$nin": ["ignored", "archived"]}},
            sort_field="created_at", sort_dir=-1, limit=6,
        )
        latest_generated_content = await find_many(
            "generated_contents", sort_field="created_at", sort_dir=-1, limit=6
        )

    return {
        "customers_count": customers_count,
        "news_new_count": news_new_count,
        "drafts_count": drafts_count,
        "approved_count": approved_count,
        "published_count": published_count,
        "latest_news": latest_news,
        "latest_generated_content": latest_generated_content,
    }
