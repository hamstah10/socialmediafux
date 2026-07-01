# SocialFUX — Product Requirements (PRD)

## Original brief (excerpt)
Multi-tenant social media content platform for automotive/chiptuning/
tuningfiles customers, target domain `social.tuningfux.de`. See the full
briefing in the initial task message.

## User personas
- **Admin/Agency**: creates customers, manages news sources, triggers
  generation, reviews and approves content.
- **Editor**: creates content per customer, uses the creative editor.
- **Customer**: (later) sees only their own drafts and approved content.

## Core requirements (static)
- Mandantenfähig (multi-tenant customers with own branding)
- News ingestion via RSS + arbitrary URL
- AI content generation (Instagram/FB/LinkedIn/Google Business/Blog/
  Newsletter/WhatsApp; tones technisch/seriös/sportlich/…)
- Compliance checker for risky German tuning claims
- Creative editor with live preview (customer logo + colors)
- Dark automotive/ECU aesthetic (Rajdhani + IBM Plex, #B4E600 accent)

## Architecture (implemented)
- FastAPI + Motor (MongoDB async, DB `socialfux`)
- JWT bearer auth (bcrypt hashed passwords)
- Static uploads via `/uploads` (logos/, creatives/, news-images/)
- Claude Sonnet 4.5 via emergentintegrations, with mock fallback
- React + Tailwind + shadcn/ui + sonner toasts + react-router v7

## Implemented (2026-02)
- [x] Auth (JWT), default admin seed
- [x] Dashboard with stats + latest feeds + quick actions
- [x] Customers CRUD + logo upload + tabs (profile/branding/services/social/content/creatives)
- [x] News sources CRUD, RSS/website fetch action
- [x] News items list with filters, URL import
- [x] Content generator (Claude 4.5 or mock) + hashtag generator + compliance check
- [x] Creative editor (5 formats, live preview, save)
- [x] Archive with filters (customer/platform/status)
- [x] Templates listing (JSON config)
- [x] Settings page
- [x] VPS deploy notes + Nginx example
- [x] Seed: admin, 7 news sources, demo customer, 3 templates

## P0 backlog
- Playwright-based PNG export for creatives (VPS)
- Real RSS URLs for Autotuner/Magic Motorsport/Alientech (currently placeholders)
- Fine-grained roles: customer users seeing only their content
- Scheduled/auto fetch of RSS sources

## P1 backlog
- Visual template builder
- Blog article structure (Meta Title/Meta Description/H1/FAQ) end-to-end save
- Multi-format bulk creative generation
- Integration with Instagram/Facebook publisher APIs
- Customer approval workflow with change requests

## P2 backlog
- MariaDB migration
- SEO analytics per generated blog post
- Multi-language content generation
- White-label customer-facing preview page

## Known limitations
- PNG export endpoint returns 501 in Emergent env (Playwright not installed)
- Default RSS URLs for vendor sources are placeholders — need real feeds
- All news sources use `generic_rss` scraper for MVP; vendor-specific
  scrapers are stubbed and can be extended in `/app/backend/scrapers/`
