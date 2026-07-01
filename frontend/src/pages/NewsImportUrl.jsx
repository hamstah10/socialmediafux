import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { AlertCircle, ImageOff, Link2, Save, Search } from "lucide-react";
import { toast } from "sonner";

export default function NewsImportUrl() {
  const navigate = useNavigate();
  const [url, setUrl] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [item, setItem] = useState(null);
  const [existing, setExisting] = useState(null);
  const [error, setError] = useState("");
  const [imgFailed, setImgFailed] = useState(false);

  const analyze = async (e) => {
    e.preventDefault();
    setError(""); setItem(null); setExisting(null); setImgFailed(false);
    if (!url) return;
    setAnalyzing(true);
    try {
      const r = await api.post("/news-items/preview-url", { url });
      if (r.data.existing) {
        setExisting(r.data.item);
        toast.info("Diese URL wurde bereits importiert.");
      } else {
        setItem({ ...r.data.item, news_source_id: null });
      }
    } catch (err) {
      setError(err?.response?.data?.detail || "URL konnte nicht analysiert werden.");
    } finally { setAnalyzing(false); }
  };

  const save = async () => {
    if (!item) return;
    setSaving(true);
    try {
      const saved = await api.post("/news-items", {
        title: item.title || "(kein Titel)",
        url: item.url,
        summary: item.summary || "",
        content_clean: item.content_clean || "",
        image_url: item.image_url || null,
        published_at: item.published_at || null,
        category: item.category || null,
        news_source_id: null,
      });
      toast.success("News gespeichert");
      navigate(`/content-generator?news=${saved.data.id}`);
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Speichern fehlgeschlagen");
    } finally { setSaving(false); }
  };

  const set = (k, v) => setItem({ ...item, [k]: v });

  return (
    <div className="space-y-6 max-w-4xl" data-testid="news-import-page">
      <header>
        <div className="fux-label">/ news / import-url</div>
        <h1 className="fux-heading text-4xl mt-1">URL Import mit Vorschau</h1>
        <p className="text-muted-foreground text-sm mt-2">
          URL einfügen, Metadaten prüfen, editieren, speichern — dann direkt in den Generator.
        </p>
      </header>

      <form onSubmit={analyze} className="fux-card flex items-center gap-3">
        <Link2 size={18} className="text-primary shrink-0" />
        <input
          className="fux-input"
          placeholder="https://www.autotuner.com/de/blogs/neuigkeiten/…"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          data-testid="import-url-input"
        />
        <button className="fux-btn-primary shrink-0" disabled={analyzing} data-testid="analyze-btn">
          <Search size={14} /> {analyzing ? "Lade…" : "Analysieren"}
        </button>
      </form>

      {error && (
        <div className="fux-card border-destructive text-destructive text-sm flex items-center gap-2" data-testid="import-error">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {existing && (
        <div className="fux-card" data-testid="existing-notice">
          <div className="fux-label mb-2">Bereits im System</div>
          <h3 className="fux-heading text-lg">{existing.title}</h3>
          <p className="text-sm text-muted-foreground mt-2 line-clamp-3">{existing.summary}</p>
          <button className="fux-btn-ghost mt-3" onClick={() => navigate(`/content-generator?news=${existing.id}`)}>
            Zum Generator öffnen →
          </button>
        </div>
      )}

      {item && (
        <div className="fux-card space-y-4" data-testid="preview-form">
          <div className="fux-label">// vorschau · editierbar</div>

          {item.image_url && !imgFailed ? (
            <img
              src={item.image_url}
              alt=""
              referrerPolicy="no-referrer"
              className="w-full max-h-72 object-cover border border-border bg-secondary"
              onError={() => setImgFailed(true)}
              data-testid="preview-image"
            />
          ) : (
            <div className="w-full h-48 border border-border bg-secondary flex items-center justify-center text-muted-foreground gap-2">
              <ImageOff size={18} /> Kein Bild gefunden
            </div>
          )}

          <div>
            <label className="fux-label block mb-1.5">Titel</label>
            <input className="fux-input" value={item.title || ""} onChange={(e) => set("title", e.target.value)} data-testid="pv-title" />
          </div>
          <div>
            <label className="fux-label block mb-1.5">URL (canonical)</label>
            <input className="fux-input" value={item.url || ""} onChange={(e) => set("url", e.target.value)} data-testid="pv-url" />
          </div>
          <div>
            <label className="fux-label block mb-1.5">Bild-URL</label>
            <input className="fux-input" value={item.image_url || ""} onChange={(e) => { set("image_url", e.target.value); setImgFailed(false); }} data-testid="pv-image" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="fux-label block mb-1.5">Veröffentlicht</label>
              <input className="fux-input" value={item.published_at || ""} onChange={(e) => set("published_at", e.target.value)} data-testid="pv-published" />
            </div>
            <div>
              <label className="fux-label block mb-1.5">Kategorie</label>
              <input className="fux-input" value={item.category || ""} onChange={(e) => set("category", e.target.value)} data-testid="pv-category" />
            </div>
          </div>
          <div>
            <label className="fux-label block mb-1.5">Zusammenfassung</label>
            <textarea className="fux-input min-h-24" value={item.summary || ""} onChange={(e) => set("summary", e.target.value)} data-testid="pv-summary" />
          </div>
          <div>
            <label className="fux-label block mb-1.5">Volltext</label>
            <textarea className="fux-input min-h-40" value={item.content_clean || ""} onChange={(e) => set("content_clean", e.target.value)} data-testid="pv-content" />
          </div>

          <div className="flex items-center gap-3 border-t border-border pt-4">
            <button className="fux-btn-primary" onClick={save} disabled={saving} data-testid="pv-save">
              <Save size={14} /> {saving ? "Speichern…" : "Speichern & zum Generator"}
            </button>
            <button className="fux-btn-ghost" onClick={() => setItem(null)}>Verwerfen</button>
          </div>
        </div>
      )}
    </div>
  );
}
