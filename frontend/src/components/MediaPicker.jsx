import { useEffect, useMemo, useState } from "react";
import { api, resolveUpload } from "../lib/api";
import { ImageOff, Search, X } from "lucide-react";

/**
 * Modal picker for media library assets.
 * Props:
 *   open, onClose, onPick(asset)
 *   customerId       optional — filter to customer + globals
 *   defaultCategory  optional — preselect a category filter
 */
export default function MediaPicker({ open, onClose, onPick, customerId, defaultCategory = "" }) {
  const [assets, setAssets] = useState([]);
  const [categories, setCategories] = useState([]);
  const [category, setCategory] = useState(defaultCategory);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    api.get("/media/categories").then((r) => setCategories(r.data.categories));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    const params = new URLSearchParams();
    if (category) params.append("category", category);
    // Show globals + customer specifics; client-side second query for globals if needed
    api.get(`/media?${params.toString()}`)
      .then((r) => {
        const filtered = customerId
          ? r.data.filter((a) => !a.customer_id || a.customer_id === customerId)
          : r.data;
        setAssets(filtered);
      })
      .finally(() => setLoading(false));
  }, [open, category, customerId]);

  const filtered = useMemo(() => {
    if (!q) return assets;
    const s = q.toLowerCase();
    return assets.filter((a) =>
      (a.original_name || "").toLowerCase().includes(s) ||
      (a.tags || []).some((t) => t.toLowerCase().includes(s)),
    );
  }, [assets, q]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-background/85 flex items-center justify-center z-50 p-6 overflow-y-auto" data-testid="media-picker">
      <div className="fux-card w-full max-w-4xl">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="fux-label">// media library</div>
            <h2 className="fux-heading text-2xl mt-1">Asset auswählen</h2>
          </div>
          <button onClick={onClose} data-testid="mp-close"><X size={18} /></button>
        </div>

        <div className="flex items-center gap-3 mb-4">
          <select className="fux-input max-w-xs" value={category} onChange={(e) => setCategory(e.target.value)} data-testid="mp-category">
            <option value="">All categories</option>
            {categories.map((c) => <option key={c}>{c}</option>)}
          </select>
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              className="fux-input pl-9"
              placeholder="Nach Name oder Tag suchen…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              data-testid="mp-search"
            />
          </div>
          <div className="fux-label">{filtered.length}</div>
        </div>

        {loading ? (
          <div className="fux-label text-center py-8">Lade…</div>
        ) : filtered.length === 0 ? (
          <div className="text-center text-muted-foreground py-8" data-testid="mp-empty">
            Keine Assets in dieser Kategorie. Uploade zuerst über <span className="mono">/media-library</span>.
          </div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3 max-h-[60vh] overflow-y-auto">
            {filtered.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => onPick(a)}
                className="text-left focus:outline-none focus:ring-1 focus:ring-primary group"
                data-testid={`mp-asset-${a.id}`}
              >
                <MediaThumb asset={a} />
                <div className="fux-label mt-1 truncate" title={a.original_name}>
                  {a.category}
                </div>
                <div className="text-[10px] truncate">{a.original_name || "asset"}</div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const MediaThumb = ({ asset }) => {
  const [failed, setFailed] = useState(false);
  const src = resolveUpload(asset.file_path);
  if (failed || !src) {
    return (
      <div className="w-full aspect-square border border-border bg-secondary flex items-center justify-center text-muted-foreground">
        <ImageOff size={16} />
      </div>
    );
  }
  return (
    <img
      src={src}
      alt=""
      className="w-full aspect-square object-cover border border-border bg-secondary group-hover:border-primary transition-colors"
      onError={() => setFailed(true)}
    />
  );
};
