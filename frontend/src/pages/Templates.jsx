import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { Plus, X, Save, Trash2, Copy } from "lucide-react";
import { toast } from "sonner";
import CreativePreview, { BACKGROUND_TYPES, FORMAT_SIZES } from "../components/CreativePreview";

const STYLE_KEYS = ["ecu_update", "motorsport_dark", "clean_workshop", "premium_dark", "workshop_local"];

const demoCustomer = {
  name: "TuningFux Demo",
  website: "https://tuningfux.de",
  accent_color: "#B4E600",
  primary_color: "#080D1A",
  tone_of_voice: "Update",
};

const emptyForm = () => ({
  name: "",
  format: "instagram_square",
  style_key: "ecu_update",
  background_type: "grid",
  is_global: true,
  config: { badge: "NEUES ECU-UPDATE", accent: "#B4E600", background_color: "" },
});

export default function Templates() {
  const [items, setItems] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [previewCustomerId, setPreviewCustomerId] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [busy, setBusy] = useState(false);

  const load = () => api.get("/templates").then((r) => setItems(r.data));
  useEffect(() => { load(); }, []);
  useEffect(() => { api.get("/customers").then((r) => setCustomers(r.data)); }, []);

  const previewCustomer = customers.find((c) => c.id === previewCustomerId) || demoCustomer;

  const openNew = () => { setEditing(null); setForm(emptyForm()); setOpen(true); };
  const openEdit = (t) => {
    setEditing(t);
    setForm({
      name: t.name,
      format: t.format,
      style_key: t.style_key,
      background_type: t.background_type,
      is_global: t.is_global,
      config: { badge: t.config?.badge || "", accent: t.config?.accent || "#B4E600", background_color: t.config?.background_color || "" },
    });
    setOpen(true);
  };
  const duplicate = async (t) => {
    setEditing(null);
    setForm({
      name: `${t.name} (Kopie)`,
      format: t.format,
      style_key: t.style_key,
      background_type: t.background_type,
      is_global: t.is_global,
      config: { ...(t.config || {}), badge: t.config?.badge || "", accent: t.config?.accent || "#B4E600", background_color: t.config?.background_color || "" },
    });
    setOpen(true);
  };

  const remove = async (t) => {
    if (!window.confirm(`Template "${t.name}" löschen?`)) return;
    try {
      await api.delete(`/templates/${t.id}`);
      toast.success("Template gelöscht");
      load();
    } catch { toast.error("Löschen fehlgeschlagen"); }
  };

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const size = FORMAT_SIZES[form.format];
      const payload = { ...form, width: size.w, height: size.h };
      if (editing) {
        await api.put(`/templates/${editing.id}`, payload);
        toast.success("Template aktualisiert");
      } else {
        await api.post("/templates", payload);
        toast.success("Template erstellt");
      }
      setOpen(false);
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Speichern fehlgeschlagen");
    } finally { setBusy(false); }
  };

  const templatePreview = {
    background_type: form.background_type,
    config: form.config,
  };

  return (
    <div className="space-y-6" data-testid="templates-page">
      <header className="flex items-end justify-between">
        <div>
          <div className="fux-label">/ vorlagen</div>
          <h1 className="fux-heading text-4xl mt-1">Design-Vorlagen</h1>
          <p className="text-muted-foreground text-sm mt-2">
            Wiederverwendbare Layouts für Creatives. Erstelle, dupliziere und passe globale Templates an.
          </p>
        </div>
        <button className="fux-btn-primary" onClick={openNew} data-testid="new-template-btn">
          <Plus size={14} /> Neue Vorlage
        </button>
      </header>

      <div className="flex items-center gap-3">
        <label className="fux-label">Vorschau mit Kunde</label>
        <select
          className="fux-input max-w-xs"
          value={previewCustomerId}
          onChange={(e) => setPreviewCustomerId(e.target.value)}
          data-testid="preview-customer-select"
        >
          <option value="">Demo-Branding</option>
          {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((t) => (
          <div key={t.id} className="fux-card" data-testid={`template-${t.id}`}>
            <div className="mb-3">
              <CreativePreview
                customer={previewCustomer}
                template={{ background_type: t.background_type, config: t.config }}
                format={t.format}
                headline={t.config?.badge || t.name}
                subline=""
                cta="CTA"
                maxWidth={400}
                testid={`template-preview-${t.id}`}
              />
            </div>
            <div className="fux-label">{t.style_key}</div>
            <h3 className="fux-heading text-lg mt-1">{t.name}</h3>
            <div className="flex flex-wrap gap-2 mt-3">
              <span className="fux-badge">{t.format}</span>
              <span className="fux-badge">{t.width}×{t.height}</span>
              <span className="fux-badge">{t.background_type}</span>
              {t.is_global && <span className="fux-badge fux-badge-accent">global</span>}
            </div>
            <div className="flex items-center gap-3 mt-4 border-t border-border pt-3">
              <button className="fux-label hover:text-primary" onClick={() => openEdit(t)} data-testid={`template-edit-${t.id}`}>bearbeiten</button>
              <button className="fux-label hover:text-primary inline-flex items-center gap-1" onClick={() => duplicate(t)} data-testid={`template-duplicate-${t.id}`}>
                <Copy size={12} /> duplizieren
              </button>
              <button className="fux-label hover:text-destructive inline-flex items-center gap-1 ml-auto" onClick={() => remove(t)} data-testid={`template-delete-${t.id}`}>
                <Trash2 size={12} /> löschen
              </button>
            </div>
          </div>
        ))}
        {items.length === 0 && (
          <div className="fux-card col-span-full text-muted-foreground">Keine Vorlagen. Klicke oben rechts auf &quot;Neue Vorlage&quot;.</div>
        )}
      </div>

      {open && (
        <div className="fixed inset-0 bg-background/85 flex items-center justify-center z-50 p-6 overflow-y-auto" data-testid="template-modal">
          <div className="fux-card w-full max-w-5xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="fux-label">// {editing ? "Vorlage bearbeiten" : "neue Vorlage"}</div>
                <h2 className="fux-heading text-2xl mt-1">{editing ? editing.name : "Visueller Template-Builder"}</h2>
              </div>
              <button onClick={() => setOpen(false)}><X size={18} /></button>
            </div>

            <div className="grid grid-cols-12 gap-6">
              <form onSubmit={save} className="col-span-12 md:col-span-5 space-y-3" data-testid="template-form">
                <div>
                  <label className="fux-label block mb-1.5">Name *</label>
                  <input required className="fux-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="tf-name" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="fux-label block mb-1.5">Format</label>
                    <select className="fux-input" value={form.format} onChange={(e) => setForm({ ...form, format: e.target.value })} data-testid="tf-format">
                      {Object.entries(FORMAT_SIZES).map(([k, v]) => <option key={k} value={k}>{v.label} ({v.w}×{v.h})</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="fux-label block mb-1.5">Stil-Schlüssel</label>
                    <select className="fux-input" value={form.style_key} onChange={(e) => setForm({ ...form, style_key: e.target.value })} data-testid="tf-style">
                      {STYLE_KEYS.map((s) => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="fux-label block mb-1.5">Hintergrund</label>
                  <div className="grid grid-cols-4 gap-2" data-testid="tf-bg-group">
                    {BACKGROUND_TYPES.map((b) => (
                      <button
                        key={b}
                        type="button"
                        data-testid={`tf-bg-${b}`}
                        onClick={() => setForm({ ...form, background_type: b })}
                        className={`px-3 py-2 uppercase tracking-widest text-[10px] border ${
                          form.background_type === b ? "border-primary text-primary" : "border-border text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {b}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="fux-label block mb-1.5">Badge-Text</label>
                  <input className="fux-input" value={form.config.badge} onChange={(e) => setForm({ ...form, config: { ...form.config, badge: e.target.value } })} data-testid="tf-badge" />
                </div>
                <div>
                  <label className="fux-label block mb-1.5">Akzentfarbe</label>
                  <div className="flex gap-2">
                    <input type="color" className="fux-input w-20 h-10 p-1" value={form.config.accent} onChange={(e) => setForm({ ...form, config: { ...form.config, accent: e.target.value } })} data-testid="tf-accent-color" />
                    <input className="fux-input" value={form.config.accent} onChange={(e) => setForm({ ...form, config: { ...form.config, accent: e.target.value } })} data-testid="tf-accent-hex" />
                  </div>
                </div>
                <div>
                  <label className="fux-label block mb-1.5">Hintergrundfarbe</label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      className="fux-input w-20 h-10 p-1"
                      value={form.config.background_color || previewCustomer.primary_color || "#080D1A"}
                      onChange={(e) => setForm({ ...form, config: { ...form.config, background_color: e.target.value } })}
                      data-testid="tf-bgcolor-color"
                    />
                    <input
                      className="fux-input"
                      placeholder={`Kunde: ${previewCustomer.primary_color || "#080D1A"}`}
                      value={form.config.background_color || ""}
                      onChange={(e) => setForm({ ...form, config: { ...form.config, background_color: e.target.value } })}
                      data-testid="tf-bgcolor-hex"
                    />
                    {form.config.background_color && (
                      <button
                        type="button"
                        className="fux-label hover:text-primary whitespace-nowrap"
                        onClick={() => setForm({ ...form, config: { ...form.config, background_color: "" } })}
                        data-testid="tf-bgcolor-reset"
                      >
                        zurücksetzen
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Leer lassen, um die Primärfarbe des ausgewählten Kunden zu übernehmen.
                  </p>
                </div>
                <label className="flex items-center gap-2 fux-label pt-2">
                  <input type="checkbox" checked={form.is_global} onChange={(e) => setForm({ ...form, is_global: e.target.checked })} data-testid="tf-global" />
                  Global (für alle Kunden verfügbar)
                </label>
                <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                  <button type="button" className="fux-btn-ghost" onClick={() => setOpen(false)}>Abbrechen</button>
                  <button type="submit" className="fux-btn-primary" disabled={busy} data-testid="tf-submit">
                    <Save size={14} /> {busy ? "Speichere…" : editing ? "Aktualisieren" : "Anlegen"}
                  </button>
                </div>
              </form>

              <div className="col-span-12 md:col-span-7">
                <div className="fux-label mb-2">// Live-Vorschau · {FORMAT_SIZES[form.format]?.w}×{FORMAT_SIZES[form.format]?.h}</div>
                <CreativePreview
                  customer={previewCustomer}
                  template={templatePreview}
                  format={form.format}
                  headline={form.config.badge || form.name || "Beispiel-Headline"}
                  subline="Live-Vorschau deiner Template-Konfiguration."
                  cta="Handlungsaufruf"
                  maxWidth={520}
                  testid="template-live-preview"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
