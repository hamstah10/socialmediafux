import { useEffect, useRef, useState } from "react";
import { api, resolveUpload } from "../lib/api";
import { toast } from "sonner";
import { Copy, Filter, ImageOff, Trash2, Upload, X } from "lucide-react";

const CATEGORY_COLORS = {
  Logo: "#B4E600",
  Background: "#8A94A6",
  ECU: "#FFB020",
  Werkstatt: "#F5F7FA",
  Auto: "#FF3B30",
  Tool: "#B4E600",
  Icon: "#8A94A6",
  "Creative Export": "#FFB020",
  "News Image": "#8A94A6",
};

const AssetImage = ({ asset }) => {
  const [failed, setFailed] = useState(false);
  const src = resolveUpload(asset.file_path);
  if (failed || !src) {
    return (
      <div className="w-full aspect-square border border-border bg-secondary flex items-center justify-center text-muted-foreground">
        <ImageOff size={20} />
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={asset.original_name || ""}
      className="w-full aspect-square object-cover border border-border bg-secondary"
      onError={() => setFailed(true)}
    />
  );
};

export default function MediaLibrary() {
  const [assets, setAssets] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [filterCategory, setFilterCategory] = useState("");
  const [filterCustomer, setFilterCustomer] = useState("");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [form, setForm] = useState({ category: "Background", customer_id: "", tags: "", source: "", license_note: "" });
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  const load = () => {
    const q = new URLSearchParams();
    if (filterCategory) q.append("category", filterCategory);
    if (filterCustomer) q.append("customer_id", filterCustomer);
    api.get(`/media?${q.toString()}`).then((r) => setAssets(r.data));
  };

  useEffect(() => {
    api.get("/customers").then((r) => setCustomers(r.data));
    api.get("/media/categories").then((r) => setCategories(r.data.categories));
  }, []);
  useEffect(() => { load(); }, [filterCategory, filterCustomer]);

  const upload = async (file) => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) return toast.error("Max 10 MB");
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("category", form.category);
    if (form.customer_id) fd.append("customer_id", form.customer_id);
    fd.append("tags", form.tags);
    fd.append("source", form.source);
    fd.append("license_note", form.license_note);
    try {
      await api.post("/media/upload", fd);
      toast.success("Asset uploaded");
      setUploadOpen(false);
      setForm({ category: "Background", customer_id: "", tags: "", source: "", license_note: "" });
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Upload failed");
    } finally { setUploading(false); }
  };

  const remove = async (a) => {
    if (!window.confirm(`Delete ${a.original_name || "asset"}?`)) return;
    try {
      await api.delete(`/media/${a.id}`);
      toast.success("Deleted");
      load();
    } catch { toast.error("Delete failed"); }
  };

  const copyUrl = async (a) => {
    const url = `${process.env.REACT_APP_BACKEND_URL}${a.file_path}`;
    await navigator.clipboard?.writeText(url).catch(() => {});
    toast.success("URL kopiert");
  };

  return (
    <div className="space-y-6" data-testid="media-library-page">
      <header className="flex items-end justify-between">
        <div>
          <div className="fux-label">/ media-library</div>
          <h1 className="fux-heading text-4xl mt-1">Media Library</h1>
          <p className="text-muted-foreground text-sm mt-2">
            Wiederverwendbare Assets — Logos, Hintergründe, ECU-/Tool-Fotos. Max 10 MB, png/jpg/webp/svg/gif.
          </p>
        </div>
        <button className="fux-btn-primary" onClick={() => setUploadOpen(true)} data-testid="upload-btn">
          <Upload size={14} /> Upload
        </button>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <Filter size={14} className="text-muted-foreground" />
        <select className="fux-input max-w-xs" value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} data-testid="filter-category">
          <option value="">All categories</option>
          {categories.map((c) => <option key={c}>{c}</option>)}
        </select>
        <select className="fux-input max-w-xs" value={filterCustomer} onChange={(e) => setFilterCustomer(e.target.value)} data-testid="filter-customer">
          <option value="">All customers</option>
          {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <div className="fux-label ml-auto">{assets.length} assets</div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
        {assets.map((a) => (
          <div key={a.id} className="fux-card p-3" data-testid={`asset-${a.id}`}>
            <AssetImage asset={a} />
            <div className="mt-2 flex items-center gap-1 flex-wrap">
              <span
                className="fux-badge"
                style={{ borderColor: CATEGORY_COLORS[a.category] || "#8A94A6",
                         color: CATEGORY_COLORS[a.category] || "#8A94A6" }}
              >
                {a.category}
              </span>
              <span className="fux-badge">{a.file_type}</span>
            </div>
            <div className="text-xs truncate mt-1" title={a.original_name}>{a.original_name || "asset"}</div>
            <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border">
              <button onClick={() => copyUrl(a)} className="fux-label hover:text-primary inline-flex items-center gap-1" data-testid={`copy-${a.id}`}>
                <Copy size={11} /> url
              </button>
              <button onClick={() => remove(a)} className="fux-label hover:text-destructive inline-flex items-center gap-1 ml-auto" data-testid={`delete-${a.id}`}>
                <Trash2 size={11} />
              </button>
            </div>
          </div>
        ))}
        {assets.length === 0 && (
          <div className="fux-card col-span-full text-center text-muted-foreground py-10">
            Noch keine Assets. Klicke oben rechts auf Upload.
          </div>
        )}
      </div>

      {uploadOpen && (
        <div className="fixed inset-0 bg-background/85 flex items-center justify-center z-50 p-6" data-testid="upload-modal">
          <div className="fux-card w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h2 className="fux-heading text-2xl">Asset hochladen</h2>
              <button onClick={() => setUploadOpen(false)}><X size={18} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="fux-label block mb-1.5">Kategorie</label>
                <select className="fux-input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} data-testid="up-category">
                  {categories.map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="fux-label block mb-1.5">Kunde (optional)</label>
                <select className="fux-input" value={form.customer_id} onChange={(e) => setForm({ ...form, customer_id: e.target.value })} data-testid="up-customer">
                  <option value="">Global (alle Kunden)</option>
                  {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="fux-label block mb-1.5">Tags (Komma-separiert)</label>
                <input className="fux-input" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} data-testid="up-tags" />
              </div>
              <div>
                <label className="fux-label block mb-1.5">Quelle</label>
                <input className="fux-input" placeholder="z.B. eigenes Foto, unsplash.com" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} data-testid="up-source" />
              </div>
              <div>
                <label className="fux-label block mb-1.5">Lizenz-Notiz</label>
                <input className="fux-input" value={form.license_note} onChange={(e) => setForm({ ...form, license_note: e.target.value })} data-testid="up-license" />
              </div>
              <div className="border-t border-border pt-3">
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => upload(e.target.files?.[0])} data-testid="up-file" />
                <button className="fux-btn-primary w-full justify-center" disabled={uploading} onClick={() => fileRef.current?.click()} data-testid="up-select-file">
                  <Upload size={14} /> {uploading ? "Uploading…" : "Datei auswählen & hochladen"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
