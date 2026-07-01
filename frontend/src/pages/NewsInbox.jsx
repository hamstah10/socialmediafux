import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { Archive as ArchiveIcon, CircleSlash, ExternalLink, Eye, ImageOff, Link2, Radar, Wand2, X } from "lucide-react";
import { toast } from "sonner";

const STATUSES = ["all", "new", "reviewed", "used", "ignored", "archived"];
const STATUS_LABEL = { all: "alle", new: "neu", reviewed: "gesichtet", used: "verwendet", ignored: "ignoriert", archived: "archiviert" };

// Displays the image if the URL loads, falls back to a placeholder card
// with the source name so users always see WHERE a news item came from.
const NewsImage = ({ src, sourceName }) => {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div
        className="w-32 h-32 border border-border shrink-0 flex flex-col items-center justify-center bg-secondary text-muted-foreground gap-1"
        data-testid="news-image-fallback"
      >
        <ImageOff size={20} strokeWidth={1.5} />
        <span className="fux-label text-[9px] text-center px-1 leading-tight">
          {sourceName || "kein Bild"}
        </span>
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={sourceName || ""}
      referrerPolicy="no-referrer"
      loading="lazy"
      className="w-32 h-32 object-cover border border-border shrink-0 bg-secondary"
      onError={() => setFailed(true)}
    />
  );
};

// Full-width hero image for the preview modal.
const NewsImageLarge = ({ src, label }) => {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return null;
  return (
    <img
      src={src}
      alt={label || ""}
      referrerPolicy="no-referrer"
      className="w-full max-h-96 object-cover border border-border bg-secondary"
      onError={() => setFailed(true)}
      data-testid="preview-image"
    />
  );
};

export default function NewsInbox() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [sources, setSources] = useState([]);
  const [status, setStatus] = useState("all");
  const [sourceId, setSourceId] = useState("");
  const [importUrl, setImportUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(null);

  const sourceMap = useMemo(() => {
    const m = {};
    for (const s of sources) m[s.id] = s;
    return m;
  }, [sources]);

  const load = () => {
    const q = new URLSearchParams();
    if (status !== "all") q.append("status", status);
    if (sourceId) q.append("news_source_id", sourceId);
    api.get(`/news-items?${q.toString()}`).then((r) => setItems(r.data));
  };

  useEffect(() => { api.get("/news-sources").then((r) => setSources(r.data)); }, []);
  useEffect(() => { load(); }, [status, sourceId]);

  const importByUrl = async (e) => {
    e.preventDefault();
    if (!importUrl) return;
    setBusy(true);
    try {
      await api.post("/news-items/import-url", { url: importUrl });
      toast.success("URL importiert");
      setImportUrl("");
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Import fehlgeschlagen");
    } finally { setBusy(false); }
  };

  const setItemStatus = async (id, s) => {
    await api.put(`/news-items/${id}/status`, { status: s });
    if (preview && preview.id === id) setPreview({ ...preview, status: s });
    load();
  };

  const openInGenerator = (id) => {
    navigate(`/content-generator?news=${id}`);
  };

  const openPreview = async (item) => {
    // Fetch fresh detail to get full content_clean (list endpoint returns same fields, but re-fetch keeps it consistent)
    try {
      const r = await api.get(`/news-items/${item.id}`);
      setPreview(r.data);
    } catch {
      setPreview(item);
    }
    if (item.status === "new") {
      // Auto-mark as reviewed on first preview so the "new" queue stays clean
      api.put(`/news-items/${item.id}/status`, { status: "reviewed" }).then(load).catch(() => {});
    }
  };

  // Derive a readable domain from an item URL as last-resort source hint.
  const domainOf = (url) => {
    try { return new URL(url).hostname.replace(/^www\./, ""); }
    catch { return null; }
  };

  return (
    <div className="space-y-6" data-testid="news-inbox-page">
      <header className="flex items-end justify-between">
        <div>
          <div className="fux-label">/ news</div>
          <h1 className="fux-heading text-4xl mt-1">News-Eingang</h1>
        </div>
      </header>

      <form onSubmit={importByUrl} className="fux-card flex items-center gap-3">
        <Link2 size={18} className="text-primary shrink-0" />
        <input
          className="fux-input"
          placeholder="Artikel-URL einfügen und als News importieren…"
          value={importUrl}
          onChange={(e) => setImportUrl(e.target.value)}
          data-testid="import-url-input"
        />
        <button className="fux-btn-primary shrink-0" disabled={busy} data-testid="import-url-btn">
          {busy ? "Importiere…" : "URL importieren"}
        </button>
      </form>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1" data-testid="status-filter">
          {STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`px-3 py-1 text-xs uppercase tracking-widest border ${
                status === s ? "border-primary text-primary" : "border-border text-muted-foreground hover:text-foreground"
              }`}
              data-testid={`status-tab-${s}`}
            >
              {STATUS_LABEL[s] || s}
            </button>
          ))}
        </div>
        <select className="fux-input max-w-xs" value={sourceId} onChange={(e) => setSourceId(e.target.value)} data-testid="source-filter">
          <option value="">Alle Quellen</option>
          {sources.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {items.length === 0 && (
          <div className="fux-card col-span-2 text-center text-muted-foreground">
            Keine News. Quelle abrufen oder oben URL importieren.
          </div>
        )}
        {items.map((n) => {
          const source = n.news_source_id ? sourceMap[n.news_source_id] : null;
          const sourceLabel = source?.name || domainOf(n.url) || "Manueller Import";
          return (
            <article key={n.id} className="fux-card flex gap-4" data-testid={`news-item-${n.id}`}>
              <button
                type="button"
                onClick={() => openPreview(n)}
                className="shrink-0 focus:outline-none focus:ring-1 focus:ring-primary"
                data-testid={`news-thumb-${n.id}`}
              >
                <NewsImage src={n.image_url} sourceName={sourceLabel} />
              </button>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                  <span
                    className="fux-badge fux-badge-accent inline-flex items-center gap-1"
                    data-testid={`news-source-${n.id}`}
                    title={source?.url || n.url || ""}
                  >
                    <Radar size={10} /> {sourceLabel}
                  </span>
                  <span className="fux-badge">{n.status}</span>
                  <span className="fux-label">{n.published_at?.slice(0, 10) || "—"}</span>
                </div>
                <h3 className="font-semibold text-base leading-snug line-clamp-2">
                  <button
                    type="button"
                    onClick={() => openPreview(n)}
                    className="text-left hover:text-primary"
                    data-testid={`news-title-${n.id}`}
                  >
                    {n.title}
                  </button>
                </h3>
                <p className="text-sm text-muted-foreground line-clamp-2 mt-2">{n.summary}</p>
                <div className="flex flex-wrap items-center gap-3 mt-3">
                  <button onClick={() => openPreview(n)} className="fux-btn-ghost" data-testid={`preview-news-${n.id}`}>
                    <Eye size={12} /> Vorschau
                  </button>
                  <button onClick={() => openInGenerator(n.id)} className="fux-btn-primary" data-testid={`use-news-${n.id}`}>
                    <Wand2 size={12} /> Verwenden
                  </button>
                  <button onClick={() => setItemStatus(n.id, "ignored")} className="fux-label hover:text-destructive inline-flex items-center gap-1">
                    <CircleSlash size={12} /> ignorieren
                  </button>
                  <button onClick={() => setItemStatus(n.id, "archived")} className="fux-label hover:text-foreground inline-flex items-center gap-1">
                    <ArchiveIcon size={12} /> archivieren
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {preview && (() => {
        const src = preview.news_source_id ? sourceMap[preview.news_source_id] : null;
        const label = src?.name || domainOf(preview.url) || "Manueller Import";
        return (
          <div className="fixed inset-0 bg-background/85 flex items-center justify-center z-50 p-6 overflow-y-auto" data-testid="news-preview-modal">
            <div className="fux-card w-full max-w-3xl">
              <div className="flex items-start justify-between mb-4 gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className="fux-badge fux-badge-accent inline-flex items-center gap-1">
                      <Radar size={10} /> {label}
                    </span>
                    <span className="fux-badge">{preview.status}</span>
                    <span className="fux-label">{preview.published_at?.slice(0, 10) || "—"}</span>
                  </div>
                  <h2 className="fux-heading text-2xl leading-tight" data-testid="preview-title">{preview.title}</h2>
                </div>
                <button onClick={() => setPreview(null)} className="text-muted-foreground hover:text-foreground shrink-0" data-testid="close-preview">
                  <X size={20} />
                </button>
              </div>

              {preview.image_url && (
                <NewsImageLarge src={preview.image_url} label={label} />
              )}

              {preview.summary && (
                <>
                  <div className="fux-label mt-4 mb-1">Zusammenfassung</div>
                  <p className="text-sm text-foreground/90 whitespace-pre-line border border-border p-3" data-testid="preview-summary">
                    {preview.summary}
                  </p>
                </>
              )}

              {preview.content_clean && preview.content_clean !== preview.summary && (
                <>
                  <div className="fux-label mt-4 mb-1">Volltext</div>
                  <div
                    className="text-sm text-muted-foreground whitespace-pre-line max-h-72 overflow-y-auto border border-border p-3"
                    data-testid="preview-content"
                  >
                    {preview.content_clean}
                  </div>
                </>
              )}

              <div className="flex flex-wrap items-center gap-3 mt-6 pt-4 border-t border-border">
                <button onClick={() => openInGenerator(preview.id)} className="fux-btn-primary" data-testid="preview-use">
                  <Wand2 size={14} /> Für Content verwenden
                </button>
                <a
                  href={preview.url}
                  target="_blank"
                  rel="noreferrer"
                  className="fux-btn-ghost"
                  data-testid="preview-open-source"
                >
                  <ExternalLink size={14} /> Original öffnen
                </a>
                <button onClick={() => { setItemStatus(preview.id, "ignored"); setPreview(null); }} className="fux-label hover:text-destructive inline-flex items-center gap-1 ml-auto">
                  <CircleSlash size={12} /> ignorieren
                </button>
                <button onClick={() => { setItemStatus(preview.id, "archived"); setPreview(null); }} className="fux-label hover:text-foreground inline-flex items-center gap-1">
                  <ArchiveIcon size={12} /> archivieren
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
