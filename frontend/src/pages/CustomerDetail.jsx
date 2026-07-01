import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, resolveUpload } from "../lib/api";
import { ArrowLeft, Upload, Save } from "lucide-react";
import { toast } from "sonner";

const TABS = ["profile", "branding", "services", "social", "content", "creatives"];

export default function CustomerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [customer, setCustomer] = useState(null);
  const [tab, setTab] = useState("profile");
  const [busy, setBusy] = useState(false);
  const [content, setContent] = useState([]);
  const [creatives, setCreatives] = useState([]);
  const fileRef = useRef(null);

  const load = async () => {
    const r = await api.get(`/customers/${id}`);
    setCustomer(r.data);
  };

  useEffect(() => { load(); }, [id]);

  useEffect(() => {
    if (tab === "content") api.get(`/generator/contents?customer_id=${id}`).then((r) => setContent(r.data));
    if (tab === "creatives") api.get(`/creatives?customer_id=${id}`).then((r) => setCreatives(r.data));
  }, [tab, id]);

  const save = async () => {
    setBusy(true);
    try {
      const { id: _id, created_at, updated_at, logo_path, slug, ...rest } = customer;
      await api.put(`/customers/${id}`, rest);
      toast.success("Saved");
    } catch (err) {
      toast.error("Save failed");
    } finally { setBusy(false); }
  };

  const [logoCacheBust, setLogoCacheBust] = useState(0);

  const uploadLogo = async (file) => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) return toast.error("Datei > 10 MB");
    const allowed = ["image/png", "image/jpeg", "image/webp", "image/svg+xml", "image/gif"];
    if (file.type && !allowed.includes(file.type)) {
      return toast.error(`Dateityp ${file.type} nicht erlaubt (nur PNG/JPG/WEBP/SVG)`);
    }
    const fd = new FormData();
    fd.append("file", file);
    setBusy(true);
    try {
      const r = await api.post(`/customers/${id}/logo`, fd);
      setCustomer(r.data);
      setLogoCacheBust(Date.now());
      toast.success(`Logo hochgeladen (${(file.size / 1024).toFixed(1)} KB)`);
    } catch (err) {
      toast.error(err?.response?.data?.detail || `Upload fehlgeschlagen (${err?.response?.status || "?"})`);
    } finally { setBusy(false); }
  };

  if (!customer) return <div className="fux-label">Loading…</div>;

  const set = (k, v) => setCustomer({ ...customer, [k]: v });

  return (
    <div className="space-y-6" data-testid="customer-detail-page">
      <button onClick={() => navigate("/customers")} className="fux-label hover:text-primary flex items-center gap-2">
        <ArrowLeft size={14} /> back
      </button>

      <header className="fux-card flex items-center gap-6">
        <div className="w-20 h-20 border border-border flex items-center justify-center" style={{ background: customer.primary_color }}>
          {customer.logo_path ? (
            <img
              src={`${resolveUpload(customer.logo_path)}${logoCacheBust ? `?t=${logoCacheBust}` : ""}`}
              className="max-w-full max-h-full object-contain"
              alt=""
              data-testid="header-logo-img"
            />
          ) : (
            <div className="fux-heading text-2xl text-white">{customer.name.slice(0, 2).toUpperCase()}</div>
          )}
        </div>
        <div className="flex-1">
          <div className="fux-label">Customer · {customer.slug}</div>
          <h1 className="fux-heading text-3xl mt-1">{customer.name}</h1>
          <div className="flex gap-2 mt-2">
            <span className="fux-badge">{customer.tone_of_voice}</span>
            <span className="fux-badge">{customer.language}</span>
            <span className="fux-badge fux-badge-accent">{customer.is_active ? "active" : "inactive"}</span>
          </div>
        </div>
        <button className="fux-btn-primary" onClick={save} disabled={busy} data-testid="save-customer">
          <Save size={14} /> Save
        </button>
      </header>

      <div className="flex gap-1 border-b border-border" data-testid="customer-tabs">
        {TABS.map((t) => (
          <button
            key={t}
            data-testid={`tab-${t}`}
            className={`px-4 py-2 uppercase tracking-widest text-xs border-b-2 transition-colors ${
              tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "profile" && (
        <div className="fux-card grid grid-cols-2 gap-4" data-testid="tab-profile-content">
          <div><label className="fux-label block mb-1.5">Name</label>
            <input className="fux-input" value={customer.name} onChange={(e) => set("name", e.target.value)} /></div>
          <div><label className="fux-label block mb-1.5">Website</label>
            <input className="fux-input" value={customer.website || ""} onChange={(e) => set("website", e.target.value)} /></div>
          <div><label className="fux-label block mb-1.5">Email</label>
            <input className="fux-input" value={customer.email || ""} onChange={(e) => set("email", e.target.value)} /></div>
          <div><label className="fux-label block mb-1.5">Phone</label>
            <input className="fux-input" value={customer.phone || ""} onChange={(e) => set("phone", e.target.value)} /></div>
          <div><label className="fux-label block mb-1.5">Tone of voice</label>
            <select className="fux-input" value={customer.tone_of_voice} onChange={(e) => set("tone_of_voice", e.target.value)}>
              {["technisch","seriös","sportlich","premium","verkaufsstark","kurz","b2b","lokal"].map((t) => (<option key={t}>{t}</option>))}
            </select></div>
          <div><label className="fux-label block mb-1.5">Language</label>
            <select className="fux-input" value={customer.language} onChange={(e) => set("language", e.target.value)}>
              <option value="de">de</option><option value="en">en</option>
            </select></div>
          <div className="col-span-2"><label className="fux-label block mb-1.5">Notes</label>
            <textarea className="fux-input min-h-24" value={customer.notes || ""} onChange={(e) => set("notes", e.target.value)} /></div>
        </div>
      )}

      {tab === "branding" && (
        <div className="fux-card space-y-5" data-testid="tab-branding-content">
          <div className="grid grid-cols-3 gap-4">
            <div><label className="fux-label block mb-1.5">Primary</label>
              <input className="fux-input h-10" type="color" value={customer.primary_color} onChange={(e) => set("primary_color", e.target.value)} /></div>
            <div><label className="fux-label block mb-1.5">Secondary</label>
              <input className="fux-input h-10" type="color" value={customer.secondary_color} onChange={(e) => set("secondary_color", e.target.value)} /></div>
            <div><label className="fux-label block mb-1.5">Accent</label>
              <input className="fux-input h-10" type="color" value={customer.accent_color} onChange={(e) => set("accent_color", e.target.value)} /></div>
          </div>

          <div className="border-t border-border pt-4">
            <label className="fux-label block mb-2">Logo (PNG/JPG/WEBP/SVG · max 10 MB)</label>
            <div className="flex items-center gap-4">
              <div
                className="w-32 h-32 border border-border flex items-center justify-center bg-secondary shrink-0"
                data-testid="logo-preview-box"
              >
                {customer.logo_path ? (
                  <img
                    src={`${resolveUpload(customer.logo_path)}${logoCacheBust ? `?t=${logoCacheBust}` : ""}`}
                    alt=""
                    className="max-w-full max-h-full object-contain"
                    data-testid="logo-preview-img"
                    onError={(e) => { e.target.style.display = "none"; }}
                  />
                ) : (
                  <div className="fux-label text-center px-2">Kein Logo</div>
                )}
              </div>
              <div className="flex-1">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif"
                  onChange={(e) => e.target.files?.[0] && uploadLogo(e.target.files[0])}
                  className="hidden"
                  data-testid="logo-file-input"
                />
                <button
                  className="fux-btn-primary"
                  onClick={() => fileRef.current?.click()}
                  disabled={busy}
                  data-testid="upload-logo-btn"
                >
                  <Upload size={14} /> {busy ? "Lade hoch…" : (customer.logo_path ? "Logo ersetzen" : "Logo hochladen")}
                </button>
                {customer.logo_path && (
                  <div className="fux-label mt-2 mono text-[10px] break-all">{customer.logo_path}</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === "services" && (
        <div className="fux-card" data-testid="tab-services-content">
          <label className="fux-label block mb-1.5">Services (comma separated)</label>
          <input
            className="fux-input"
            value={(customer.services || []).join(", ")}
            onChange={(e) => set("services", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))}
          />
          <div className="mt-4 flex flex-wrap gap-2">
            {(customer.services || []).map((s) => <span key={s} className="fux-badge fux-badge-accent">{s}</span>)}
          </div>
        </div>
      )}

      {tab === "social" && (
        <div className="fux-card grid grid-cols-2 gap-4" data-testid="tab-social-content">
          {["instagram","facebook","linkedin","tiktok","youtube","google_business"].map((s) => (
            <div key={s}>
              <label className="fux-label block mb-1.5">{s}</label>
              <input
                className="fux-input"
                value={customer.social_links?.[s] || ""}
                onChange={(e) => set("social_links", { ...(customer.social_links || {}), [s]: e.target.value })}
              />
            </div>
          ))}
        </div>
      )}

      {tab === "content" && (
        <div className="fux-card p-0 overflow-hidden" data-testid="tab-content-content">
          {content.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">Noch kein Content generiert.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-border">
                <tr>
                  <th className="fux-label px-6 py-3 text-left">Title</th>
                  <th className="fux-label px-6 py-3 text-left">Platform</th>
                  <th className="fux-label px-6 py-3 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {content.map((c) => (
                  <tr key={c.id} className="border-b border-border">
                    <td className="px-6 py-3">{c.title}</td>
                    <td className="px-6 py-3"><span className="fux-badge">{c.platform}</span></td>
                    <td className="px-6 py-3"><span className="fux-badge">{c.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === "creatives" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4" data-testid="tab-creatives-content">
          {creatives.length === 0 ? (
            <div className="fux-card text-muted-foreground">Noch keine Creatives.</div>
          ) : (
            creatives.map((c) => (
              <div key={c.id} className="fux-card p-0 overflow-hidden">
                <div dangerouslySetInnerHTML={{ __html: c.preview_html || "" }} />
                <div className="p-4 border-t border-border flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold">{c.headline}</div>
                    <div className="fux-label mt-0.5">{c.format} · {c.status}</div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
