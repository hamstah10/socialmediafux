import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, resolveUpload } from "../lib/api";
import { Plus, Search, X } from "lucide-react";
import { toast } from "sonner";

const emptyForm = {
  name: "",
  website: "",
  email: "",
  phone: "",
  accent_color: "#B4E600",
  primary_color: "#080D1A",
  secondary_color: "#0F1526",
  language: "de",
  tone_of_voice: "technisch",
  services: "Chiptuning, Tuningfiles, Diagnose",
  notes: "",
};

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);

  const load = () => api.get("/customers").then((r) => setCustomers(r.data));
  useEffect(() => { load(); }, []);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const payload = {
        ...form,
        services: form.services.split(",").map((s) => s.trim()).filter(Boolean),
      };
      await api.post("/customers", payload);
      toast.success("Kunde erstellt");
      setOpen(false);
      setForm(emptyForm);
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Anlage fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  };

  const filtered = customers.filter((c) =>
    !q || c.name.toLowerCase().includes(q.toLowerCase()) || c.slug?.includes(q.toLowerCase()),
  );

  return (
    <div className="space-y-8" data-testid="customers-page">
      <header className="flex items-end justify-between">
        <div>
          <div className="fux-label">/ kunden</div>
          <h1 className="fux-heading text-4xl mt-1">Kunden</h1>
        </div>
        <button className="fux-btn-primary" data-testid="new-customer-btn" onClick={() => setOpen(true)}>
          <Plus size={14} /> Neuer Kunde
        </button>
      </header>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
          <input
            data-testid="customer-search"
            className="fux-input pl-9"
            placeholder="Kunden suchen…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="fux-label">{filtered.length} gesamt</div>
      </div>

      <div className="fux-card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-border">
            <tr className="text-left">
              <th className="fux-label px-6 py-3">Logo</th>
              <th className="fux-label px-6 py-3">Name</th>
              <th className="fux-label px-6 py-3">Leistungen</th>
              <th className="fux-label px-6 py-3">Website</th>
              <th className="fux-label px-6 py-3">Akzent</th>
              <th className="fux-label px-6 py-3">Status</th>
              <th className="fux-label px-6 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr key={c.id} className="border-b border-border hover:bg-secondary transition-colors" data-testid={`customer-row-${c.id}`}>
                <td className="px-6 py-3">
                  {c.logo_path ? (
                    <img src={resolveUpload(c.logo_path)} alt="" className="w-10 h-10 object-contain border border-border" />
                  ) : (
                    <div className="w-10 h-10 border border-border flex items-center justify-center fux-label">
                      {c.name.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                </td>
                <td className="px-6 py-3">
                  <Link to={`/customers/${c.id}`} className="hover:text-primary font-medium">{c.name}</Link>
                  <div className="fux-label mt-0.5">{c.slug}</div>
                </td>
                <td className="px-6 py-3 text-muted-foreground max-w-xs truncate">{(c.services || []).join(", ")}</td>
                <td className="px-6 py-3 text-muted-foreground">{c.website || "—"}</td>
                <td className="px-6 py-3">
                  <div className="w-6 h-6 border border-border" style={{ background: c.accent_color }} />
                </td>
                <td className="px-6 py-3">
                  <span className={`fux-badge ${c.is_active ? "fux-badge-accent" : ""}`}>
                    {c.is_active ? "aktiv" : "inaktiv"}
                  </span>
                </td>
                <td className="px-6 py-3 text-right">
                  <Link to={`/customers/${c.id}`} className="fux-label hover:text-primary" data-testid={`customer-open-${c.id}`}>
                    öffnen →
                  </Link>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-6 py-10 text-center text-muted-foreground">
                  Keine Kunden gefunden.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {open && (
        <div className="fixed inset-0 bg-background/80 flex items-center justify-center z-50 p-6" data-testid="new-customer-modal">
          <div className="fux-card w-full max-w-2xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="fux-label">// neuer Eintrag</div>
                <h2 className="fux-heading text-2xl mt-1">Kunde anlegen</h2>
              </div>
              <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground" data-testid="close-modal">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={submit} className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="fux-label block mb-1.5">Name *</label>
                <input required className="fux-input" data-testid="cf-name"
                       value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <label className="fux-label block mb-1.5">Website</label>
                <input className="fux-input" data-testid="cf-website"
                       value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} />
              </div>
              <div>
                <label className="fux-label block mb-1.5">E-Mail</label>
                <input className="fux-input" data-testid="cf-email"
                       value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div>
                <label className="fux-label block mb-1.5">Telefon</label>
                <input className="fux-input" data-testid="cf-phone"
                       value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div>
                <label className="fux-label block mb-1.5">Tonalität</label>
                <select className="fux-input" data-testid="cf-tone"
                        value={form.tone_of_voice} onChange={(e) => setForm({ ...form, tone_of_voice: e.target.value })}>
                  {["technisch","seriös","sportlich","premium","verkaufsstark","kurz","b2b","lokal"].map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div className="col-span-2">
                <label className="fux-label block mb-1.5">Leistungen (Komma-getrennt)</label>
                <input className="fux-input" data-testid="cf-services"
                       value={form.services} onChange={(e) => setForm({ ...form, services: e.target.value })} />
              </div>
              <div>
                <label className="fux-label block mb-1.5">Akzentfarbe</label>
                <input className="fux-input" type="color" data-testid="cf-accent"
                       value={form.accent_color} onChange={(e) => setForm({ ...form, accent_color: e.target.value })} />
              </div>
              <div>
                <label className="fux-label block mb-1.5">Grundfarbe</label>
                <input className="fux-input" type="color" data-testid="cf-primary"
                       value={form.primary_color} onChange={(e) => setForm({ ...form, primary_color: e.target.value })} />
              </div>
              <div className="col-span-2 flex justify-end gap-2 mt-2">
                <button type="button" className="fux-btn-ghost" onClick={() => setOpen(false)}>Abbrechen</button>
                <button type="submit" className="fux-btn-primary" disabled={busy} data-testid="cf-submit">
                  {busy ? "Speichere…" : "Anlegen"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
