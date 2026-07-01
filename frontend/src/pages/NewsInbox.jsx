import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { Archive as ArchiveIcon, CircleSlash, Link2, Wand2 } from "lucide-react";
import { toast } from "sonner";

const STATUSES = ["all", "new", "reviewed", "used", "ignored", "archived"];

export default function NewsInbox() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [sources, setSources] = useState([]);
  const [status, setStatus] = useState("all");
  const [sourceId, setSourceId] = useState("");
  const [importUrl, setImportUrl] = useState("");
  const [busy, setBusy] = useState(false);

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
      toast.success("URL imported");
      setImportUrl("");
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Import failed");
    } finally { setBusy(false); }
  };

  const setItemStatus = async (id, s) => {
    await api.put(`/news-items/${id}/status`, { status: s });
    load();
  };

  const openInGenerator = (id) => {
    navigate(`/content-generator?news=${id}`);
  };

  return (
    <div className="space-y-6" data-testid="news-inbox-page">
      <header className="flex items-end justify-between">
        <div>
          <div className="fux-label">/ news</div>
          <h1 className="fux-heading text-4xl mt-1">News Inbox</h1>
        </div>
      </header>

      <form onSubmit={importByUrl} className="fux-card flex items-center gap-3">
        <Link2 size={18} className="text-primary shrink-0" />
        <input
          className="fux-input"
          placeholder="Paste article URL and import as news item…"
          value={importUrl}
          onChange={(e) => setImportUrl(e.target.value)}
          data-testid="import-url-input"
        />
        <button className="fux-btn-primary shrink-0" disabled={busy} data-testid="import-url-btn">
          {busy ? "Importing…" : "Import URL"}
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
              {s}
            </button>
          ))}
        </div>
        <select className="fux-input max-w-xs" value={sourceId} onChange={(e) => setSourceId(e.target.value)} data-testid="source-filter">
          <option value="">All sources</option>
          {sources.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {items.length === 0 && (
          <div className="fux-card col-span-2 text-center text-muted-foreground">
            No news items. Fetch a source or import a URL above.
          </div>
        )}
        {items.map((n) => (
          <article key={n.id} className="fux-card flex gap-4" data-testid={`news-item-${n.id}`}>
            {n.image_url && (
              <img
                src={n.image_url}
                alt=""
                className="w-32 h-32 object-cover border border-border shrink-0"
                onError={(e) => (e.target.style.display = "none")}
              />
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="fux-badge fux-badge-accent">{n.status}</span>
                <span className="fux-label">{n.published_at?.slice(0, 10) || "—"}</span>
              </div>
              <h3 className="font-semibold text-base leading-snug line-clamp-2">
                <a href={n.url} target="_blank" rel="noreferrer" className="hover:text-primary">{n.title}</a>
              </h3>
              <p className="text-sm text-muted-foreground line-clamp-2 mt-2">{n.summary}</p>
              <div className="flex items-center gap-3 mt-3">
                <button onClick={() => openInGenerator(n.id)} className="fux-btn-primary" data-testid={`use-news-${n.id}`}>
                  <Wand2 size={12} /> Use
                </button>
                <button onClick={() => setItemStatus(n.id, "ignored")} className="fux-label hover:text-destructive inline-flex items-center gap-1">
                  <CircleSlash size={12} /> ignore
                </button>
                <button onClick={() => setItemStatus(n.id, "archived")} className="fux-label hover:text-foreground inline-flex items-center gap-1">
                  <ArchiveIcon size={12} /> archive
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
