# SocialFUX — VPS Deployment Notes

## Target
- Domain: `social.tuningfux.de` (CloudPanel-managed host, 72.61.80.207, Linux user `social`)
- Backend runs internally on `127.0.0.1:7090`
- Frontend built with `yarn build` (in this Emergent template) or `npm run build`
- Database: **MySQL 8**, DB name `socialfux`, user `socialfux` (already provisioned in
  CloudPanel — do not commit the real password; it lives only in `backend/.env` on the VPS).
  `backend/db.py` stores each former Mongo "collection" as a MySQL table with a
  `data JSON` column plus a generated/indexed `doc_id` column, so router code is
  unchanged from the Mongo version.

## CloudPanel specifics
- The site was created as a generic reverse-proxy ("Python"/Node-style) CloudPanel site.
  Its Nginx vhost forwards **everything** (`location /`) to `127.0.0.1:7090` — not just
  `/api/`. Because of that, `backend/server.py` also serves the built frontend
  (`frontend/build`) directly as a mounted SPA (see the `FRONTEND_BUILD_DIR` block at the
  bottom of `server.py`), instead of Nginx serving static files itself.
- Process supervision uses `supervisor` (`/etc/supervisor/conf.d/`), not systemd — the
  `social` Linux user has no sudo, so supervisor program files must be added as root.

## Backend (supervisor example — /etc/supervisor/conf.d/social-api.conf)
```
[program:social-api]
user=social
directory=/home/social/htdocs/social.tuningfux.de/backend
environment=MYSQL_HOST="127.0.0.1",MYSQL_PORT="3306",MYSQL_USER="socialfux",MYSQL_PASSWORD="CHANGE_ME",MYSQL_DATABASE="socialfux",JWT_SECRET="CHANGE_ME",EMERGENT_LLM_KEY="CHANGE_ME",UPLOAD_DIR="/home/social/htdocs/social.tuningfux.de/uploads",FRONTEND_BUILD_DIR="/home/social/htdocs/social.tuningfux.de/frontend/build"
command=/home/social/.venvs/socialfux/bin/uvicorn server:app --host 127.0.0.1 --port 7090
autostart=true
autorestart=true
stdout_logfile=/home/social/logs/social-api.out.log
stderr_logfile=/home/social/logs/social-api.err.log
```
Reload with `supervisorctl reread && supervisorctl update` as root.

## Nginx
Already provisioned by CloudPanel — no manual Nginx edits needed. The vhost
proxies all paths to port 7090; `server.py` distinguishes `/api/*`, `/uploads/*`,
and everything else (SPA fallback to `index.html`).

## Uploads
Persistent directory: `/home/socialfux/htdocs/social.tuningfux.de/uploads/`
- `logos/`
- `creatives/`
- `news-images/`

## PNG Export (Playwright)
Currently disabled in MVP. To enable on VPS:
```
pip install playwright
playwright install chromium
```
Then update `/app/backend/routers/creatives_router.py` `export_png` handler
to render `preview_html` through headless Chromium and store the PNG.

## Emergent vs VPS
- **Emergent env**: backend runs on `0.0.0.0:8001` because Kubernetes Ingress
  routes `/api` there. Port 7090 is unused inside Emergent.
- **VPS**: uvicorn should bind `127.0.0.1:7090`, Nginx proxies `/api/` to it.

## First run on VPS
```
sudo -u socialfux git clone <repo> /home/socialfux/htdocs/social.tuningfux.de
cd /home/socialfux/htdocs/social.tuningfux.de/backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # fill secrets
sudo systemctl enable --now socialfux-api

cd ../frontend
yarn install && yarn build
sudo nginx -s reload
```
