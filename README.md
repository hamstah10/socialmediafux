# SocialFUX

Multi-tenant social media content platform for automotive, chiptuning and
tuningfiles customers. Manage customers with own branding, import industry
news via RSS/URL, generate on-brand social content with Claude Sonnet 4.5,
run compliance checks on risky tuning claims, and produce visual creatives.

## Tech Stack
- **Backend**: FastAPI, Motor (MongoDB async), JWT, bcrypt, feedparser,
  BeautifulSoup, readability-lxml, emergentintegrations (Claude Sonnet 4.5)
- **Frontend**: React 19 (CRA + Craco), Tailwind CSS, shadcn/ui, sonner,
  lucide-react, react-router-dom v7
- **Database**: MongoDB (this template). MariaDB migration blueprint in
  `scripts/deploy_notes.md`.

## Repository Layout (Emergent template)
```
/app
├── backend/
│   ├── server.py             # FastAPI entry, mounts /api and /uploads
│   ├── auth.py               # JWT + bcrypt helpers
│   ├── db.py                 # Mongo access + helpers
│   ├── models.py             # Pydantic schemas
│   ├── seed.py               # Idempotent default data
│   ├── routers/              # auth, customers, news-sources, news-items,
│   │                         # generator, creatives, templates, dashboard
│   ├── services/             # ai_service, compliance, hashtag, scraper, creative
│   └── scrapers/             # (reserved for vendor-specific scrapers)
├── frontend/src/
│   ├── App.js                # routes
│   ├── layouts/AppLayout.jsx # sidebar
│   ├── lib/                  # api, auth
│   └── pages/                # Login, Dashboard, Customers, ...
└── uploads/                  # logos, creatives, news-images (static-served)
```

## Local development in Emergent
Backend is auto-managed by supervisor on `0.0.0.0:8001`, exposed under
`REACT_APP_BACKEND_URL/api`. Frontend is served on `:3000`.

Login: `admin@socialfux.local` / `admin123456` (seeded on first boot).

## VPS deployment
See `scripts/deploy_notes.md` for the target VPS setup (`social.tuningfux.de`,
uvicorn on 127.0.0.1:7090, Nginx reverse proxy, systemd unit, Playwright PNG
export activation instructions).

## API overview
All routes are prefixed with `/api`.

- `POST /auth/login` · `GET /auth/me` · `POST /auth/logout`
- `GET /dashboard/stats`
- `GET/POST /customers` · `GET/PUT/DELETE /customers/{id}` · `POST /customers/{id}/logo`
- `GET/POST /news-sources` · `GET/PUT/DELETE /news-sources/{id}` · `POST /news-sources/{id}/fetch`
- `GET /news-items` · `GET /news-items/{id}` · `PUT /news-items/{id}/status` · `POST /news-items/import-url`
- `POST /generator/content` · `POST /generator/hashtags` · `POST /generator/compliance-check`
- `GET/PUT /generator/contents/{id}` · `GET /generator/contents`
- `GET/POST /creatives` · `GET/PUT/DELETE /creatives/{id}` · `POST /creatives/{id}/export-png`
- `GET/POST /templates` · `GET/PUT/DELETE /templates/{id}`
- `GET /settings` · `GET /health`

## AI content service
`services/ai_service.py` calls Claude Sonnet 4.5 via
`emergentintegrations`. If `EMERGENT_LLM_KEY` is missing or the LLM call
fails, a deterministic mock generator produces usable copy from the
customer + news + platform + tone inputs — the app never hangs.

## Compliance
`services/compliance.py` scans generated text for risky tuning claims
(`100% legal`, `TÜV garantiert`, `DPF off legal`, `AdBlue deaktivieren`,
`garantiert mehr Leistung`, …) and returns warnings + safer wording
suggestions. Wired into the Content Generator UI.
