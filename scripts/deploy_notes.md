# SocialFUX — VPS Deployment Notes

## Target
- Domain: `social.tuningfux.de`
- Backend runs internally on `127.0.0.1:7090`
- Frontend built with `yarn build` (in this Emergent template) or `npm run build`
- MongoDB database — Emergent template uses Mongo (DB_NAME `socialfux`). If you migrate
  the codebase to MariaDB later, use DB name `socialfux`, user `socialfux`,
  password `CHANGE_ME` (do not commit real credentials).

## Backend (systemd example)
```
[Unit]
Description=SocialFUX API
After=network.target

[Service]
User=socialfux
WorkingDirectory=/home/socialfux/htdocs/social.tuningfux.de/backend
Environment="MONGO_URL=mongodb://localhost:27017"
Environment="DB_NAME=socialfux"
Environment="JWT_SECRET=CHANGE_ME"
Environment="EMERGENT_LLM_KEY=CHANGE_ME"
ExecStart=/home/socialfux/.venvs/socialfux/bin/uvicorn server:app --host 127.0.0.1 --port 7090
Restart=always

[Install]
WantedBy=multi-user.target
```

## Nginx

```
server {
    server_name social.tuningfux.de;
    root /home/socialfux/htdocs/social.tuningfux.de/frontend/build;
    index index.html;

    location /api/ {
        proxy_pass http://127.0.0.1:7090/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;
    }

    location /uploads/ {
        alias /home/socialfux/htdocs/social.tuningfux.de/uploads/;
        expires 30d;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

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
