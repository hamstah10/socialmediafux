"""SocialFUX FastAPI server."""
import logging
import os
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from starlette.responses import FileResponse

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

# Import after env loaded
from db import client, init_db  # noqa: E402
from routers.auth_router import router as auth_router  # noqa: E402
from routers.approvals_router import router as approvals_router  # noqa: E402
from routers.customers_router import router as customers_router  # noqa: E402
from routers.dashboard_router import router as dashboard_router  # noqa: E402
from routers.creatives_router import router as creatives_router  # noqa: E402
from routers.generator_router import router as generator_router  # noqa: E402
from routers.media_router import router as media_router  # noqa: E402
from routers.news_items_router import router as news_items_router  # noqa: E402
from routers.news_sources_router import router as news_sources_router  # noqa: E402
from routers.templates_router import router as templates_router  # noqa: E402
from routers.layout_templates_router import router as layout_templates_router  # noqa: E402
from seed import run_seed  # noqa: E402


app = FastAPI(title="SocialFUX API", version="0.1.0")


@app.on_event("startup")
async def on_start() -> None:
    logger.info("SocialFUX starting up")
    await init_db()
    try:
        await run_seed()
    except Exception as e:
        logger.exception("Seed failed: %s", e)


@app.on_event("shutdown")
async def on_shutdown() -> None:
    client.close()


# --- /api routes -------------------------------------------------------------
from fastapi import APIRouter  # noqa: E402

api_router = APIRouter(prefix="/api")


@api_router.get("/")
async def api_root() -> dict:
    return {"app": "SocialFUX", "status": "ok", "version": "0.1.0"}


@api_router.get("/health")
async def health() -> dict:
    return {"ok": True}


@api_router.get("/settings")
async def settings() -> dict:
    return {
        "app": "SocialFUX",
        "version": "0.1.0",
        "domain": os.environ.get("DOMAIN", "social.tuningfux.de"),
        "upload_dir": os.environ.get("UPLOAD_DIR", "/app/uploads"),
        "llm_configured": bool(os.environ.get("EMERGENT_LLM_KEY")),
    }


api_router.include_router(auth_router)
api_router.include_router(dashboard_router)
api_router.include_router(customers_router)
api_router.include_router(news_sources_router)
api_router.include_router(news_items_router)
api_router.include_router(generator_router)
api_router.include_router(creatives_router)
api_router.include_router(templates_router)
api_router.include_router(layout_templates_router)
api_router.include_router(approvals_router)
api_router.include_router(media_router)

app.include_router(api_router)


# --- Static uploads ----------------------------------------------------------
UPLOAD_DIR = Path(os.environ.get("UPLOAD_DIR", "/app/uploads"))
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
(UPLOAD_DIR / "logos").mkdir(parents=True, exist_ok=True)
(UPLOAD_DIR / "creatives").mkdir(parents=True, exist_ok=True)
(UPLOAD_DIR / "news-images").mkdir(parents=True, exist_ok=True)
(UPLOAD_DIR / "media").mkdir(parents=True, exist_ok=True)
# Mount under both paths:
#  - /api/uploads   → served via Kubernetes ingress (Emergent)
#  - /uploads       → served directly on VPS by Nginx (see scripts/deploy_notes.md)
app.mount("/api/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads_api")
app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")


# --- CORS --------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- Frontend SPA --------------------------------------------------------------
# On the VPS, Nginx (CloudPanel reverse-proxy) forwards everything to this
# process, so it also serves the built React app. Mounted last so it never
# shadows /api or /uploads.
FRONTEND_BUILD_DIR = Path(os.environ.get("FRONTEND_BUILD_DIR", str(ROOT_DIR.parent / "frontend" / "build")))
if FRONTEND_BUILD_DIR.is_dir():
    app.mount("/static", StaticFiles(directory=str(FRONTEND_BUILD_DIR / "static")), name="frontend_static")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        candidate = FRONTEND_BUILD_DIR / full_path
        if full_path and candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(FRONTEND_BUILD_DIR / "index.html")
