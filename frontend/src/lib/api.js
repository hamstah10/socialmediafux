import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API_BASE = `${BACKEND_URL}/api`;
export const UPLOADS_BASE = BACKEND_URL;

export const api = axios.create({ baseURL: API_BASE });

api.interceptors.request.use((cfg) => {
  const token = localStorage.getItem("fux_token");
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err?.response?.status === 401) {
      localStorage.removeItem("fux_token");
      localStorage.removeItem("fux_user");
      if (!window.location.pathname.startsWith("/login")) {
        window.location.href = "/login";
      }
    }
    return Promise.reject(err);
  },
);

// Uploaded assets are served through the /api/uploads mount so they pass the
// Kubernetes ingress correctly. Backend stores paths as `/uploads/...` for
// VPS/Nginx compatibility; we rewrite to `/api/uploads/...` on the client.
export const resolveUpload = (p) => {
  if (!p) return "";
  if (p.startsWith("http")) return p;
  const path = p.startsWith("/uploads/") ? `/api${p}` : p;
  return `${UPLOADS_BASE}${path}`;
};
