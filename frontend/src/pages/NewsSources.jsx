import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { Plus, Radar, RefreshCw, X } from "lucide-react";
import { toast } from "sonner";

const empty = {
  name: "",
  url: "",
  rss_url: "",
  source_type: "rss",
  scraper_key: "generic_rss",
  active: true,
};

export default function NewsSources() {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [fetching, setFetching] = useState(null);

  const load = () => api.get("/news-sources").then((r) => setItems(r.data));
  useEffect(() => { load(); }, []);

  const submit = async (e) => {
    e.preventDefault();
    try {
      await api.post("/news-sources", form);
      toast.success("Source created");
      setOpen(false);
      setForm(empty);
      load();
    } catch (err) { toast.error(err?.response?.data?.detail || "Failed"); }
  };

  const runFetch = async (s) => {
    setFetching(s.id);
    try {
      const r = await api.post(`/news-sources/${s.id}/fetch`);
      toast.success(`${r.data.imported} items imported (${r.data.checked} checked)`);
      load();
    } catch (err) {
      toast.error("Fetch failed. Check RSS URL.");
    } finally { setFetching(null); }
  };

  const toggle = async (s) => {
    await api.put(`/news-sources/${s.id}`, { active: !s.active });
    load();
  };

  const remove = async (s) => {
    if (!window.confirm(`Delete ${s.name}?`)) return;
    await api.delete(`/news-sources/${s.id}`);
    load();
  };

  return (
    <div className="space-y-6" data-testid="news-sources-page">
      <header className="flex items-end justify-between">
        <div>
          <div className="fux-label">/ news-sources</div>
          <h1 className="fux-heading text-4xl mt-1">News Sources</h1>
          <p className="text-muted-foreground text-sm mt-2">
            Configure RSS feeds and websites of tuning-industry sources. Add an RSS URL to fetch items automatically.
          </p>
        </div>
        <button className="fux-btn-primary" onClick={() => setOpen(true)} data-testid="new-source-btn">
          <Plus size={14} /> New source
        </button>
      </header>

      <div className="fux-card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-border">
            <tr>
              <th className="fux-label px-6 py-3 text-left">Name</th>
              <th className="fux-label px-6 py-3 text-left">Type</th>
              <th className="fux-label px-6 py-3 text-left">RSS / URL</th>
              <th className="fux-label px-6 py-3 text-left">Scraper</th>
              <th className="fux-label px-6 py-3 text-left">Last checked</th>
              <th className="fux-label px-6 py-3 text-left">Status</th>
              <th className="fux-label px-6 py-3 text-right"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((s) => (
              <tr key={s.id} className="border-b border-border hover:bg-secondary" data-testid={`source-row-${s.id}`}>
                <td className="px-6 py-3 font-medium">
                  <div className="flex items-center gap-2">
                    <Radar size={14} className="text-primary" /> {s.name}
                  </div>
                </td>
                <td className="px-6 py-3"><span className="fux-badge">{s.source_type}</span></td>
                <td className="px-6 py-3 text-muted-foreground text-xs truncate max-w-xs mono">{s.rss_url || s.url}</td>
                <td className="px-6 py-3 mono text-xs">{s.scraper_key}</td>
                <td className="px-6 py-3 text-muted-foreground text-xs">{s.last_checked_at?.slice(0, 16).replace("T"," ") || "—"}</td>
                <td className="px-6 py-3">
                  <button className={`fux-badge ${s.active ? "fux-badge-accent" : ""}`} onClick={() => toggle(s)} data-testid={`toggle-source-${s.id}`}>
                    {s.active ? "active" : "paused"}
                  </button>
                </td>
                <td className="px-6 py-3 text-right space-x-3">
                  <button onClick={() => runFetch(s)} disabled={fetching === s.id} className="fux-label hover:text-primary inline-flex items-center gap-1" data-testid={`fetch-source-${s.id}`}>
                    <RefreshCw size={12} className={fetching === s.id ? "animate-spin" : ""} /> fetch
                  </button>
                  <button onClick={() => remove(s)} className="fux-label hover:text-destructive">delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {open && (
        <div className="fixed inset-0 bg-background/80 flex items-center justify-center z-50 p-6" data-testid="new-source-modal">
          <div className="fux-card w-full max-w-lg">
            <div className="flex items-center justify-between mb-4">
              <h2 className="fux-heading text-2xl">New source</h2>
              <button onClick={() => setOpen(false)}><X size={18} /></button>
            </div>
            <form onSubmit={submit} className="space-y-3">
              <div><label className="fux-label block mb-1.5">Name *</label>
                <input required className="fux-input" data-testid="sf-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div><label className="fux-label block mb-1.5">Website URL</label>
                <input className="fux-input" data-testid="sf-url" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} /></div>
              <div><label className="fux-label block mb-1.5">RSS URL</label>
                <input className="fux-input" data-testid="sf-rss" value={form.rss_url} onChange={(e) => setForm({ ...form, rss_url: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="fux-label block mb-1.5">Type</label>
                  <select className="fux-input" data-testid="sf-type" value={form.source_type} onChange={(e) => setForm({ ...form, source_type: e.target.value })}>
                    <option value="rss">rss</option><option value="website">website</option><option value="manual">manual</option>
                  </select></div>
                <div><label className="fux-label block mb-1.5">Scraper</label>
                  <select className="fux-input" data-testid="sf-scraper" value={form.scraper_key} onChange={(e) => setForm({ ...form, scraper_key: e.target.value })}>
                    {["generic_rss","autotuner","magicmotorsport","alientech","manual"].map((k) => <option key={k}>{k}</option>)}
                  </select></div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" className="fux-btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
                <button className="fux-btn-primary" data-testid="sf-submit">Create</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
