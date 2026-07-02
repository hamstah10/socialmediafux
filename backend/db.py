"""MySQL/MariaDB connection and helper utilities for SocialFUX.

Most former Mongo "collections" are stored as a MySQL table with a single
JSON `data` column holding the full document, plus a generated `doc_id`
column (mirroring `data->>'$.id'`) that is indexed so lookups by id stay
fast. This keeps the call signatures identical to the previous Mongo-backed
implementation so routers do not need to change.

The `users` table is the exception: it uses dedicated columns (see
`create_user`/`get_user_by_id`/`get_user_by_email`/`update_user`/`delete_user`)
instead of a JSON blob, since user data has stable known fields and benefits
from real column types/constraints (e.g. a unique index on `email`).
"""
from datetime import datetime, timezone
from typing import Any
import os
import uuid

import aiomysql

_MYSQL_HOST = os.environ.get("MYSQL_HOST", "127.0.0.1")
_MYSQL_PORT = int(os.environ.get("MYSQL_PORT", "3306"))
_MYSQL_USER = os.environ["MYSQL_USER"]
_MYSQL_PASSWORD = os.environ["MYSQL_PASSWORD"]
_MYSQL_DB = os.environ["MYSQL_DATABASE"]

# All collections used across the app. Tables are created lazily on startup.
# NOTE: "users" is handled separately via dedicated columns (see USERS_TABLE
# below and the `create_user`/`get_user_by_*`/`update_user` helpers) instead
# of the generic JSON-blob table used for the collections listed here.
COLLECTIONS = [
    "settings",
    "customers",
    "news_sources",
    "news_items",
    "generated_contents",
    "creatives",
    "design_templates",
    "layout_templates",
    "approval_links",
    "approval_events",
    "media_assets",
]

_pool: aiomysql.Pool | None = None


class _ClientShim:
    """Mimics the subset of the Motor client interface server.py relies on."""

    def close(self) -> None:
        global _pool
        if _pool is not None:
            _pool.close()


client = _ClientShim()


async def get_pool() -> aiomysql.Pool:
    global _pool
    if _pool is None:
        _pool = await aiomysql.create_pool(
            host=_MYSQL_HOST,
            port=_MYSQL_PORT,
            user=_MYSQL_USER,
            password=_MYSQL_PASSWORD,
            db=_MYSQL_DB,
            autocommit=True,
            charset="utf8mb4",
        )
    return _pool


async def _migrate_legacy_users_table(conn) -> None:
    """Convert a pre-existing JSON-blob `users` table (doc_id + data JSON,
    from before dedicated columns were introduced) into the new columnar
    schema, preserving existing rows. No-op if `users` doesn't exist yet or
    is already in the new shape.
    """
    async with conn.cursor() as cur:
        await cur.execute(
            "SELECT COLUMN_NAME FROM information_schema.COLUMNS "
            "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users'"
        )
        columns = {r[0] for r in await cur.fetchall()}
        if not columns or "email" in columns:
            # Table doesn't exist yet, or already migrated.
            return
        await cur.execute("SELECT data FROM `users`")
        legacy_rows = [json_loads(r[0]) for r in await cur.fetchall()]
        await cur.execute("RENAME TABLE `users` TO `users_legacy_json_backup`")

    async with conn.cursor() as cur:
        await cur.execute(
            """
            CREATE TABLE `users` (
                id VARCHAR(36) NOT NULL,
                email VARCHAR(255) NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                full_name VARCHAR(255) NOT NULL,
                role VARCHAR(32) NOT NULL DEFAULT 'user',
                is_active TINYINT(1) NOT NULL DEFAULT 1,
                customer_id VARCHAR(36) NULL,
                created_at DATETIME(6) NOT NULL,
                updated_at DATETIME(6) NOT NULL,
                PRIMARY KEY (id),
                UNIQUE KEY uq_users_email (email),
                KEY ix_users_customer_id (customer_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            """
        )
        for doc in legacy_rows:
            await cur.execute(
                """
                INSERT INTO `users`
                    (id, email, password_hash, full_name, role, is_active, customer_id, created_at, updated_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    doc["id"], doc["email"], doc["password_hash"], doc["full_name"],
                    doc.get("role", "user"), bool(doc.get("is_active", True)),
                    doc.get("customer_id"),
                    doc.get("created_at") or utcnow_iso(),
                    doc.get("updated_at") or utcnow_iso(),
                ),
            )


async def init_db() -> None:
    """Create tables for every known collection if they don't exist yet."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        await _migrate_legacy_users_table(conn)
        async with conn.cursor() as cur:
            for name in COLLECTIONS:
                await cur.execute(
                    f"""
                    CREATE TABLE IF NOT EXISTS `{name}` (
                        doc_id VARCHAR(64) AS (data->>'$.id') STORED,
                        data JSON NOT NULL,
                        PRIMARY KEY (doc_id)
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
                    """
                )
            await cur.execute(
                """
                CREATE TABLE IF NOT EXISTS `users` (
                    id VARCHAR(36) NOT NULL,
                    email VARCHAR(255) NOT NULL,
                    password_hash VARCHAR(255) NOT NULL,
                    full_name VARCHAR(255) NOT NULL,
                    role VARCHAR(32) NOT NULL DEFAULT 'user',
                    is_active TINYINT(1) NOT NULL DEFAULT 1,
                    customer_id VARCHAR(36) NULL,
                    created_at DATETIME(6) NOT NULL,
                    updated_at DATETIME(6) NOT NULL,
                    PRIMARY KEY (id),
                    UNIQUE KEY uq_users_email (email),
                    KEY ix_users_customer_id (customer_id)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
                """
            )
            await cur.execute(
                "SELECT COLUMN_NAME FROM information_schema.COLUMNS "
                "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' "
                "AND COLUMN_NAME = 'customer_id'"
            )
            if not await cur.fetchone():
                await cur.execute(
                    "ALTER TABLE `users` ADD COLUMN customer_id VARCHAR(36) NULL, "
                    "ADD KEY ix_users_customer_id (customer_id)"
                )


def new_id() -> str:
    """Generate a new UUID4-based string id."""
    return str(uuid.uuid4())


def utcnow_iso() -> str:
    """Return current UTC time as ISO string."""
    return datetime.now(timezone.utc).isoformat()


def strip_mongo_id(doc: dict | None) -> dict | None:
    """Kept for API compatibility; MySQL storage never adds a Mongo-style _id."""
    if doc is None:
        return None
    doc.pop("_id", None)
    return doc


def _row_to_doc(row: Any) -> dict | None:
    if row is None:
        return None
    return json_loads(row[0])


import json as _json


def json_loads(raw: Any) -> dict:
    if isinstance(raw, (dict, list)):
        return raw
    return _json.loads(raw)


def _build_where(query: dict) -> tuple[str, list]:
    """Translate a flat Mongo-style equality/$nin/$or filter dict into SQL."""
    if not query:
        return "1=1", []
    clauses = []
    params: list = []
    for field, value in query.items():
        if field == "$or":
            sub_clauses = []
            for sub_query in value:
                sub_where, sub_params = _build_where(sub_query)
                sub_clauses.append(f"({sub_where})")
                params.extend(sub_params)
            clauses.append("(" + " OR ".join(sub_clauses) + ")")
        elif isinstance(value, dict) and "$nin" in value:
            excluded = [v for v in value["$nin"] if v is not None]
            include_null = any(v is None for v in value["$nin"])
            path = f"$.{field}"
            if excluded:
                placeholders = ",".join(["%s"] * len(excluded))
                if include_null:
                    clauses.append(
                        f"(data->>'{path}' IS NULL OR data->>'{path}' NOT IN ({placeholders}))"
                    )
                else:
                    clauses.append(
                        f"(data->>'{path}' IS NOT NULL AND data->>'{path}' NOT IN ({placeholders}))"
                    )
                params.extend(str(v) for v in excluded)
            elif include_null:
                clauses.append(f"data->>'{path}' IS NOT NULL")
        else:
            path = f"$.{field}"
            clauses.append(f"data->>'{path}' = %s")
            params.append(str(value) if not isinstance(value, bool) else ("true" if value else "false"))
    return " AND ".join(clauses), params


async def find_one(collection: str, query: dict) -> dict | None:
    pool = await get_pool()
    where, params = _build_where(query)
    async with pool.acquire() as conn:
        async with conn.cursor() as cur:
            await cur.execute(f"SELECT data FROM `{collection}` WHERE {where} LIMIT 1", params)
            row = await cur.fetchone()
            return strip_mongo_id(_row_to_doc(row))


async def find_many(collection: str, query: dict | None = None, sort_field: str = "created_at",
                    sort_dir: int = -1, limit: int = 500) -> list[dict]:
    pool = await get_pool()
    where, params = _build_where(query or {})
    order = "DESC" if sort_dir == -1 else "ASC"
    sql = (
        f"SELECT data FROM `{collection}` WHERE {where} "
        f"ORDER BY data->>'$.{sort_field}' {order} LIMIT %s"
    )
    params = params + [limit]
    async with pool.acquire() as conn:
        async with conn.cursor() as cur:
            await cur.execute(sql, params)
            rows = await cur.fetchall()
            return [strip_mongo_id(_row_to_doc(r)) for r in rows]


async def insert_one(collection: str, doc: dict) -> dict:
    pool = await get_pool()
    payload = _json.dumps(doc)
    async with pool.acquire() as conn:
        async with conn.cursor() as cur:
            await cur.execute(f"INSERT INTO `{collection}` (data) VALUES (%s)", (payload,))
    return strip_mongo_id(doc)


async def update_one(collection: str, query: dict, update: dict) -> dict | None:
    update["updated_at"] = utcnow_iso()
    existing = await find_one(collection, query)
    if existing is None:
        return None
    merged = {**existing, **update}
    pool = await get_pool()
    payload = _json.dumps(merged)
    doc_id = merged["id"]
    async with pool.acquire() as conn:
        async with conn.cursor() as cur:
            await cur.execute(f"UPDATE `{collection}` SET data = %s WHERE doc_id = %s", (payload, doc_id))
    return await find_one(collection, {"id": doc_id})


async def delete_one(collection: str, query: dict) -> bool:
    pool = await get_pool()
    where, params = _build_where(query)
    async with pool.acquire() as conn:
        async with conn.cursor() as cur:
            await cur.execute(f"DELETE FROM `{collection}` WHERE {where} LIMIT 1", params)
            return cur.rowcount > 0


async def delete_many(collection: str, query: dict) -> int:
    pool = await get_pool()
    where, params = _build_where(query)
    async with pool.acquire() as conn:
        async with conn.cursor() as cur:
            await cur.execute(f"DELETE FROM `{collection}` WHERE {where}", params)
            return cur.rowcount


async def count_documents(collection: str, query: dict | None = None) -> int:
    pool = await get_pool()
    where, params = _build_where(query or {})
    async with pool.acquire() as conn:
        async with conn.cursor() as cur:
            await cur.execute(f"SELECT COUNT(*) FROM `{collection}` WHERE {where}", params)
            row = await cur.fetchone()
            return row[0]


async def distinct_ids(collection: str) -> set[str]:
    """Return the set of `id` values in a collection (replaces the raw
    `.find({}, {"id": 1})` projection query used by seed.py)."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        async with conn.cursor() as cur:
            await cur.execute(f"SELECT doc_id FROM `{collection}`")
            rows = await cur.fetchall()
            return {r[0] for r in rows}


def base_fields(**extra: Any) -> dict:
    """Return base fields for a new document (id, created_at, updated_at)."""
    now = utcnow_iso()
    return {"id": new_id(), "created_at": now, "updated_at": now, **extra}


_USER_COLUMNS = ["id", "email", "password_hash", "full_name", "role", "is_active",
                 "customer_id", "created_at", "updated_at"]


def _user_row_to_doc(row: Any) -> dict | None:
    if row is None:
        return None
    doc = dict(zip(_USER_COLUMNS, row))
    doc["is_active"] = bool(doc["is_active"])
    doc["created_at"] = doc["created_at"].isoformat()
    doc["updated_at"] = doc["updated_at"].isoformat()
    return doc


async def create_user(*, email: str, password_hash: str, full_name: str,
                       role: str = "user", is_active: bool = True,
                       customer_id: str | None = None) -> dict:
    """Insert a new row into the dedicated `users` table."""
    now = datetime.now(timezone.utc)
    user_id = new_id()
    pool = await get_pool()
    async with pool.acquire() as conn:
        async with conn.cursor() as cur:
            await cur.execute(
                """
                INSERT INTO `users`
                    (id, email, password_hash, full_name, role, is_active, customer_id, created_at, updated_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (user_id, email, password_hash, full_name, role, is_active, customer_id, now, now),
            )
    return await get_user_by_id(user_id)


async def get_user_by_id(user_id: str) -> dict | None:
    pool = await get_pool()
    async with pool.acquire() as conn:
        async with conn.cursor() as cur:
            await cur.execute(
                f"SELECT {', '.join(_USER_COLUMNS)} FROM `users` WHERE id = %s LIMIT 1",
                (user_id,),
            )
            return _user_row_to_doc(await cur.fetchone())


async def get_user_by_email(email: str) -> dict | None:
    pool = await get_pool()
    async with pool.acquire() as conn:
        async with conn.cursor() as cur:
            await cur.execute(
                f"SELECT {', '.join(_USER_COLUMNS)} FROM `users` WHERE email = %s LIMIT 1",
                (email,),
            )
            return _user_row_to_doc(await cur.fetchone())


async def update_user(user_id: str, **fields: Any) -> dict | None:
    """Update selected columns of a user row. Returns the updated user, or
    None if no such user exists."""
    allowed = {k: v for k, v in fields.items() if k in _USER_COLUMNS and k not in ("id", "created_at")}
    if not allowed:
        return await get_user_by_id(user_id)
    allowed["updated_at"] = datetime.now(timezone.utc)
    set_clause = ", ".join(f"`{k}` = %s" for k in allowed)
    pool = await get_pool()
    async with pool.acquire() as conn:
        async with conn.cursor() as cur:
            await cur.execute(
                f"UPDATE `users` SET {set_clause} WHERE id = %s",
                (*allowed.values(), user_id),
            )
    return await get_user_by_id(user_id)


async def delete_user(user_id: str) -> bool:
    pool = await get_pool()
    async with pool.acquire() as conn:
        async with conn.cursor() as cur:
            await cur.execute("DELETE FROM `users` WHERE id = %s", (user_id,))
            return cur.rowcount > 0


class _CollectionShim:
    """Drop-in replacement for `db["name"]` raw Motor-collection call sites."""

    def __init__(self, name: str) -> None:
        self._name = name

    async def insert_one(self, doc: dict) -> None:
        await insert_one(self._name, doc)

    async def count_documents(self, query: dict) -> int:
        return await count_documents(self._name, query)

    async def delete_many(self, query: dict) -> Any:
        deleted = await delete_many(self._name, query)
        return _DeleteResult(deleted)

    async def find(self, query: dict | None = None, projection: dict | None = None):
        docs = await find_many(self._name, query or {}, limit=100000)
        for d in docs:
            yield d


class _DeleteResult:
    def __init__(self, deleted_count: int) -> None:
        self.deleted_count = deleted_count


class _DbShim:
    def __getitem__(self, name: str) -> _CollectionShim:
        return _CollectionShim(name)


db = _DbShim()
