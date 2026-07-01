import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, resolveUpload } from "../lib/api";
import { toast } from "sonner";
import {
  Layers, Zap, CheckSquare, Square, ImageOff, ExternalLink,
  Wand2, ArrowRight, Loader2, FileText,
} from "lucide-react";

const PLATFORMS = [
  { key: "instagram", label: "Instagram" },
  { key: "facebook", label: "Facebook" },
  { key: "linkedin", label: "LinkedIn" },
  { key: "google_business", label: "Google Business" },
  { key: "whatsapp", label: "WhatsApp" },
  { key: "newsletter", label: "Newsletter" },
];
const TONES = ["technisch", "seriös", "sportlich", "premium", "verkaufsstark", "kurz", "b2b", "lokal"];

const NewsThumb = ({ src }) => {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div className="w-20 h-20 border border-border bg-secondary flex items-center justify-center text-muted-foreground shrink-0">
        <ImageOff size={16} />
      </div>
    );
  }
  return (
    <img
      src={src}
      alt=""
      className="w-20 h-20 object-cover border border-border shrink-0 bg-secondary"
      referrerPolicy="no-referrer"
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
};

export default function BulkGenerator() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [customerId, setCustomerId] = useState("");
  const [templates, setTemplates] = useState([]);
  const [templateId, setTemplateId] = useState("");
  const [platform, setPlatform] = useState("instagram");
  const [tone, setTone] = useState("technisch");
  const [cta, setCta] = useState("");
  const [targetLink, setTargetLink] = useState("");
  const [news, setNews] = useState([]);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState(null);

  const customer = useMemo(() => customers.find((c) => c.id === customerId), [customers, customerId]);
  const template = useMemo(() => templates.find((t) => t.id === templateId), [templates, templateId]);

  useEffect(() => {
    api.get("/customers").then((r) => {
      setCustomers(r.data);
      setCustomerId(r.data[0]?.id || "");
    });
  }, []);

  useEffect(() => {
    if (!customerId) return;
    setLoading(true);
    Promise.all([
      api.get("/layout-templates", { params: { customer_id: customerId, include_global: true } }),
      api.get("/news-items", { params: { status: "new" } }),
    ]).then(([tRes, nRes]) => {
      setTemplates(tRes.data);
      setTemplateId(tRes.data[0]?.id || "");
      setNews(nRes.data);
    }).finally(() => setLoading(false));
    setTargetLink(customers.find((c) => c.id === customerId)?.website || "");
  }, [customerId, customers]);

  const toggle = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const selectAll = () => setSelectedIds(new Set(news.map((n) => n.id)));
  const selectNone = () => setSelectedIds(new Set());

  const templateRoleSummary = useMemo(() => {
    if (!template) return null;
    const roles = new Set();
    for (const l of (template.layers || [])) {
      if (l.role && l.role !== "static") roles.add(l.role);
    }
    return [...roles];
  }, [template]);

  const run = async () => {
    if (!customerId) return toast.error("Kunde wählen");
    if (!templateId) return toast.error("Template wählen");
    if (selectedIds.size === 0) return toast.error("Mindestens eine News auswählen");
    setRunning(true);
    setResults(null);
    try {
      const r = await api.post("/creatives/bulk-from-news", {
        customer_id: customerId,
        layout_template_id: templateId,
        news_item_ids: [...selectedIds],
        platform,
        tone,
        cta: cta || null,
        target_link: targetLink || null,
      });
      setResults(r.data);
      toast.success(`${r.data.count} Creatives erstellt`);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Bulk-Generate fehlgeschlagen");
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-4" data-testid="bulk-generator-page">
      <header>
        <div className="fux-label">/ bulk-generator</div>
        <h1 className="fux-heading text-4xl mt-1">Bulk Generator</h1>
        <p className="text-muted-foreground text-sm mt-2 max-w-3xl">
          Wähle ein Layout-Template und mehrere News-Items —
          SocialFUX generiert für jede News einen fertigen Post + Creative
          mit den Farben, dem Logo und dem Design des Kunden.
        </p>
      </header>

      <div className="grid grid-cols-12 gap-4">
        {/* Left: setup */}
        <div className="col-span-12 lg:col-span-4 space-y-3">
          <div className="fux-card space-y-2">
            <div className="fux-label">Kunde</div>
            <select
              className="fux-input"
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              data-testid="bulk-customer"
            >
              {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div className="fux-card space-y-2">
            <div className="fux-label flex items-center gap-1"><Layers size={11} /> Layout Template</div>
            <select
              className="fux-input"
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              data-testid="bulk-template"
            >
              <option value="">— wählen —</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.is_global ? "🌐 " : ""}{t.name} · {t.format}
                </option>
              ))}
            </select>
            {templates.length === 0 && !loading && (
              <div className="fux-label text-[10px] opacity-70">
                Kein Template vorhanden.
                <button
                  onClick={() => navigate("/layout-editor")}
                  className="ml-1 text-primary underline"
                >
                  Im Layout Editor erstellen →
                </button>
              </div>
            )}
            {templateRoleSummary && templateRoleSummary.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-1">
                {templateRoleSummary.map((r) => (
                  <span key={r} className="text-[9px] uppercase border border-primary text-primary px-1 py-0.5">
                    {r.replace("_slot", "")}
                  </span>
                ))}
              </div>
            )}
            {templateRoleSummary && templateRoleSummary.length === 0 && template && (
              <div className="fux-label text-[10px] text-warning">
                ⚠️ Template hat keine Slot-Rollen. Content wird zwar erzeugt, aber
                das Layout ist statisch. Setze im Layout Editor Layer-Rollen.
              </div>
            )}
          </div>

          <div className="fux-card space-y-2">
            <div className="fux-label">Plattform</div>
            <select
              className="fux-input"
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
              data-testid="bulk-platform"
            >
              {PLATFORMS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
            </select>
            <div className="fux-label">Tonalität</div>
            <select
              className="fux-input"
              value={tone}
              onChange={(e) => setTone(e.target.value)}
              data-testid="bulk-tone"
            >
              {TONES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <div className="fux-label">CTA (optional)</div>
            <input
              className="fux-input"
              value={cta}
              onChange={(e) => setCta(e.target.value)}
              placeholder="Jetzt Termin anfragen"
              data-testid="bulk-cta"
            />
            <div className="fux-label">Link (optional)</div>
            <input
              className="fux-input"
              value={targetLink}
              onChange={(e) => setTargetLink(e.target.value)}
              placeholder="https://…"
              data-testid="bulk-link"
            />
          </div>

          <button
            className="fux-btn-primary w-full justify-center"
            onClick={run}
            disabled={running || selectedIds.size === 0 || !templateId}
            data-testid="bulk-run"
          >
            {running ? (
              <><Loader2 size={14} className="animate-spin" /> Generiere {selectedIds.size} Posts…</>
            ) : (
              <><Zap size={14} /> {selectedIds.size} Posts generieren</>
            )}
          </button>

          {results && (
            <div className="fux-card space-y-2" data-testid="bulk-results">
              <div className="fux-label text-primary">Ergebnis</div>
              <div className="text-sm">
                <span className="text-primary font-semibold">{results.count}</span> Creatives erstellt
                {results.errors?.length > 0 && (
                  <span className="text-destructive"> · {results.errors.length} Fehler</span>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  className="fux-btn-ghost flex-1 justify-center"
                  onClick={() => navigate("/approvals")}
                >
                  Freigabe <ArrowRight size={12} />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right: news picker */}
        <div className="col-span-12 lg:col-span-8">
          <div className="fux-card space-y-3">
            <div className="flex items-center justify-between">
              <div className="fux-label flex items-center gap-1">
                <FileText size={11} /> News-Items ({news.length}) · ausgewählt: {selectedIds.size}
              </div>
              <div className="flex gap-2">
                <button onClick={selectAll} className="fux-btn-ghost text-[10px] px-2 py-1" data-testid="bulk-select-all">Alle</button>
                <button onClick={selectNone} className="fux-btn-ghost text-[10px] px-2 py-1" data-testid="bulk-select-none">Keine</button>
              </div>
            </div>

            {loading && (
              <div className="fux-label flex items-center gap-2 py-4">
                <Loader2 size={14} className="animate-spin" /> Lade News…
              </div>
            )}
            {!loading && news.length === 0 && (
              <div className="text-muted-foreground text-sm py-8 text-center">
                Keine News mit Status &quot;new&quot;. Importiere neue Quellen oder URLs, um hier News zu sehen.
              </div>
            )}

            <ul className="space-y-2 max-h-[70vh] overflow-y-auto" data-testid="bulk-news-list">
              {news.map((n) => {
                const checked = selectedIds.has(n.id);
                return (
                  <li key={n.id}>
                    <button
                      onClick={() => toggle(n.id)}
                      className={`w-full flex gap-3 p-2 border text-left ${
                        checked ? "border-primary bg-secondary" : "border-border hover:border-primary/40"
                      }`}
                      data-testid={`bulk-news-${n.id}`}
                    >
                      {checked ? (
                        <CheckSquare size={16} className="text-primary shrink-0 mt-1" />
                      ) : (
                        <Square size={16} className="text-muted-foreground shrink-0 mt-1" />
                      )}
                      <NewsThumb src={resolveUpload(n.image_url)} />
                      <div className="flex-1 min-w-0">
                        <div className={`text-sm font-semibold truncate ${checked ? "text-primary" : ""}`}>
                          {n.title}
                        </div>
                        {n.summary && (
                          <div className="text-xs text-muted-foreground line-clamp-2 mt-1">
                            {n.summary}
                          </div>
                        )}
                        <div className="fux-label mt-1 flex items-center gap-2">
                          {n.published_at && (
                            <span>{new Date(n.published_at).toLocaleDateString("de-DE")}</span>
                          )}
                          {n.url && (
                            <a
                              href={n.url}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="hover:text-primary inline-flex items-center gap-0.5"
                            >
                              <ExternalLink size={10} /> Quelle
                            </a>
                          )}
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
