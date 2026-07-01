import { useEffect, useMemo, useState } from "react";
import { api, resolveUpload } from "../lib/api";
import { toast } from "sonner";
import { Save, Download } from "lucide-react";

const FORMATS = [
  { key: "instagram_square", label: "Instagram Square", w: 1080, h: 1080 },
  { key: "instagram_story", label: "Instagram Story", w: 1080, h: 1920 },
  { key: "facebook_landscape", label: "Facebook Landscape", w: 1200, h: 630 },
  { key: "linkedin_square", label: "LinkedIn Square", w: 1200, h: 1200 },
  { key: "google_business", label: "Google Business", w: 1200, h: 900 },
];

export default function CreativeEditor() {
  const [customers, setCustomers] = useState([]);
  const [contents, setContents] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [customerId, setCustomerId] = useState("");
  const [contentId, setContentId] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [format, setFormat] = useState("instagram_square");
  const [headline, setHeadline] = useState("Neues ECU Update verfügbar");
  const [subline, setSubline] = useState("Mehr Drehmoment. Sauberere Lastwechsel. Kundenspezifisch abgestimmt.");
  const [cta, setCta] = useState("Jetzt Termin anfragen");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get("/customers").then((r) => { setCustomers(r.data); setCustomerId(r.data[0]?.id || ""); });
    api.get("/templates").then((r) => setTemplates(r.data));
  }, []);

  useEffect(() => {
    if (customerId) api.get(`/generator/contents?customer_id=${customerId}`).then((r) => setContents(r.data));
  }, [customerId]);

  const customer = useMemo(() => customers.find((c) => c.id === customerId), [customers, customerId]);

  const fmt = FORMATS.find((f) => f.key === format) || FORMATS[0];

  const applyContent = (id) => {
    setContentId(id);
    const c = contents.find((x) => x.id === id);
    if (c) {
      setHeadline(c.title || headline);
      setSubline((c.body || "").split(/\n{2,}/)[0].slice(0, 200));
      setCta(c.cta || cta);
    }
  };

  const save = async () => {
    if (!customerId) return toast.error("Kunde wählen");
    setSaving(true);
    try {
      await api.post("/creatives", {
        customer_id: customerId,
        generated_content_id: contentId || null,
        design_template_id: templateId || null,
        format, headline, subline, cta,
      });
      toast.success("Creative saved");
    } catch (err) { toast.error("Save failed"); } finally { setSaving(false); }
  };

  const exportPng = async () => {
    toast.info("PNG export benötigt Playwright — wird später auf VPS aktiviert.");
  };

  const accent = customer?.accent_color || "#B4E600";
  const primary = customer?.primary_color || "#080D1A";
  const logo = customer?.logo_path ? resolveUpload(customer.logo_path) : "";

  return (
    <div className="space-y-6" data-testid="creative-editor-page">
      <header>
        <div className="fux-label">/ creative-editor</div>
        <h1 className="fux-heading text-4xl mt-1">Creative Editor</h1>
      </header>

      <div className="grid grid-cols-12 gap-4">
        {/* Left: parameters */}
        <div className="col-span-12 lg:col-span-3 space-y-4">
          <div className="fux-card space-y-3">
            <div className="fux-label">Setup</div>
            <div>
              <label className="fux-label block mb-1.5">Customer</label>
              <select className="fux-input" value={customerId} onChange={(e) => setCustomerId(e.target.value)} data-testid="ce-customer">
                {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="fux-label block mb-1.5">Generated content</label>
              <select className="fux-input" value={contentId} onChange={(e) => applyContent(e.target.value)} data-testid="ce-content">
                <option value="">— none —</option>
                {contents.map((c) => <option key={c.id} value={c.id}>{c.title?.slice(0, 60)}</option>)}
              </select>
            </div>
            <div>
              <label className="fux-label block mb-1.5">Template</label>
              <select className="fux-input" value={templateId} onChange={(e) => setTemplateId(e.target.value)} data-testid="ce-template">
                <option value="">— default grid —</option>
                {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label className="fux-label block mb-1.5">Format</label>
              <select className="fux-input" value={format} onChange={(e) => setFormat(e.target.value)} data-testid="ce-format">
                {FORMATS.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Middle: preview */}
        <div className="col-span-12 lg:col-span-6">
          <div className="fux-card p-6">
            <div className="fux-label mb-3">// live preview · {fmt.w}×{fmt.h}</div>
            <div className="mx-auto" style={{ maxWidth: 640 }}>
              <div
                data-testid="creative-preview"
                style={{
                  width: "100%",
                  aspectRatio: `${fmt.w}/${fmt.h}`,
                  background: primary,
                  color: "#F5F7FA",
                  position: "relative",
                  fontFamily: "'Rajdhani','IBM Plex Sans',sans-serif",
                  backgroundImage:
                    "linear-gradient(#232D42 1px,transparent 1px),linear-gradient(90deg,#232D42 1px,transparent 1px)",
                  backgroundSize: "40px 40px",
                  overflow: "hidden",
                  border: "1px solid #232D42",
                }}
              >
                <div style={{ position: "absolute", inset: 0, padding: "8%", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div style={{ padding: "6px 12px", background: accent, color: "#080D1A", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".15em", fontSize: "0.75rem" }}>
                      {customer?.tone_of_voice || "Update"}
                    </div>
                    {logo ? (
                      <img src={logo} alt="" style={{ maxHeight: 56, maxWidth: 180, objectFit: "contain" }} />
                    ) : (
                      <div style={{ fontWeight: 800, textTransform: "uppercase", letterSpacing: ".1em" }}>
                        {customer?.name || ""}
                      </div>
                    )}
                  </div>
                  <div>
                    <h2 style={{
                      fontSize: "clamp(1.5rem, 3.5vw, 3rem)", lineHeight: 1.05, margin: 0,
                      fontWeight: 800, textTransform: "uppercase", letterSpacing: "-0.02em",
                    }}>
                      {headline}
                    </h2>
                    {subline && (
                      <p style={{ marginTop: "1rem", fontSize: "1.05rem", color: "#F5F7FA", opacity: 0.85, maxWidth: "80%" }}>
                        {subline}
                      </p>
                    )}
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ padding: "12px 20px", background: accent, color: "#080D1A", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".12em", fontSize: "0.9rem" }}>
                      {cta || "Jetzt anfragen"}
                    </div>
                    <div style={{ fontSize: "0.8rem", color: "#8A94A6", textTransform: "uppercase", letterSpacing: ".15em" }}>
                      {customer?.website || ""}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right: text properties */}
        <div className="col-span-12 lg:col-span-3 space-y-4">
          <div className="fux-card space-y-3">
            <div className="fux-label">Text</div>
            <div>
              <label className="fux-label block mb-1.5">Headline</label>
              <textarea className="fux-input min-h-16" value={headline} onChange={(e) => setHeadline(e.target.value)} data-testid="ce-headline" />
            </div>
            <div>
              <label className="fux-label block mb-1.5">Subline</label>
              <textarea className="fux-input min-h-20" value={subline} onChange={(e) => setSubline(e.target.value)} data-testid="ce-subline" />
            </div>
            <div>
              <label className="fux-label block mb-1.5">CTA</label>
              <input className="fux-input" value={cta} onChange={(e) => setCta(e.target.value)} data-testid="ce-cta" />
            </div>
          </div>

          <div className="fux-card space-y-2">
            <div className="fux-label">Export</div>
            <button className="fux-btn-primary w-full justify-center" onClick={save} disabled={saving} data-testid="ce-save">
              <Save size={14} /> {saving ? "Saving…" : "Save creative"}
            </button>
            <button className="fux-btn-ghost w-full justify-center" onClick={exportPng} data-testid="ce-export-png">
              <Download size={14} /> Export PNG
            </button>
            <p className="fux-label text-[10px]">PNG export requires Playwright (VPS).</p>
          </div>
        </div>
      </div>
    </div>
  );
}
