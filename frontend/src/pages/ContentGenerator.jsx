import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { AlertTriangle, CheckCircle2, Hash, Save, ShieldAlert, ShieldCheck, Sparkles, Wand2, Layers, Lightbulb, Wrench } from "lucide-react";
import { toast } from "sonner";

const PLATFORMS = ["instagram","facebook","linkedin","google_business","blog","newsletter","whatsapp"];
const TONES = ["technisch","seriös","sportlich","premium","verkaufsstark","kurz","b2b","lokal"];

const MANUAL_TOPICS = [
  "BMW 330d Chiptuning — Leistungssteigerung Erfahrungsbericht",
  "AdBlue-Fehler Diagnose — Was Werkstätten wissen sollten",
  "DPF-Probleme frühzeitig erkennen",
  "KESS3 Bench-Tuning — Ablauf für Chiptuner",
  "Remote Coding — was ist möglich?",
  "Tuningfiles für andere Chiptuner — B2B-Service",
];

const QuickModes = ({ currentCustomer, onManual, onService }) => {
  const services = currentCustomer?.services || [];
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3" data-testid="quick-modes">
      <div className="fux-card">
        <div className="flex items-center gap-2 mb-2">
          <Lightbulb size={16} className="text-primary" />
          <div className="fux-heading text-lg">Manual Post (aus Idee)</div>
        </div>
        <p className="fux-label mb-3">Ohne News — Thema direkt vorgeben.</p>
        <div className="flex flex-wrap gap-1.5">
          {MANUAL_TOPICS.map((t) => (
            <button
              key={t}
              onClick={() => onManual(t)}
              className="fux-badge hover:border-primary hover:text-primary text-left"
              data-testid={`manual-${t.slice(0, 12)}`}
            >
              {t.slice(0, 60)}
            </button>
          ))}
        </div>
      </div>
      <div className="fux-card">
        <div className="flex items-center gap-2 mb-2">
          <Wrench size={16} className="text-primary" />
          <div className="fux-heading text-lg">Service Post</div>
        </div>
        <p className="fux-label mb-3">Lokaler Werkstatt-Post pro Service {currentCustomer ? `· ${currentCustomer.name}` : ""}.</p>
        {services.length === 0 ? (
          <p className="text-sm text-muted-foreground">Kunde auswählen um Services anzuzeigen.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {services.map((s) => (
              <button
                key={s}
                onClick={() => onService(s)}
                className="fux-badge fux-badge-accent hover:brightness-110"
                data-testid={`service-${s}`}
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const useQuery = () => new URLSearchParams(useLocation().search);

export default function ContentGenerator() {
  const q = useQuery();
  const preselectNews = q.get("news");
  const preselectCustomer = q.get("customer");
  const navigate = useNavigate();

  const [customers, setCustomers] = useState([]);
  const [news, setNews] = useState([]);
  const [customerId, setCustomerId] = useState("");
  const [newsId, setNewsId] = useState("");
  const [platform, setPlatform] = useState("instagram");
  const [tone, setTone] = useState("technisch");
  const [cta, setCta] = useState("Jetzt Termin anfragen");
  const [targetLink, setTargetLink] = useState("");
  const [customPrompt, setCustomPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState(null);
  const [variants, setVariants] = useState(null);
  const [compliance, setCompliance] = useState(null);
  const [saving, setSaving] = useState(false);
  const [rewriting, setRewriting] = useState(false);

  useEffect(() => {
    api.get("/customers").then((r) => {
      setCustomers(r.data);
      setCustomerId(preselectCustomer || r.data[0]?.id || "");
    });
    api.get("/news-items?status=new").then((r) => {
      setNews(r.data);
      setNewsId(preselectNews || "");
    });
  }, []);

  const currentCustomer = useMemo(() => customers.find((c) => c.id === customerId), [customers, customerId]);
  useEffect(() => { if (currentCustomer) setTone(currentCustomer.tone_of_voice || "technisch"); }, [currentCustomer]);

  const generate = async () => {
    if (!customerId) return toast.error("Kunde wählen");
    setGenerating(true);
    setResult(null);
    setVariants(null);
    setCompliance(null);
    try {
      const r = await api.post("/generator/content", {
        customer_id: customerId,
        news_item_id: newsId || null,
        platform, tone, cta,
        target_link: targetLink,
        custom_prompt: customPrompt,
      });
      setResult(r.data);
      // Auto compliance check
      const cc = await api.post("/generator/compliance-check", { text: `${r.data.title}\n${r.data.body}` });
      setCompliance(cc.data);
      toast.success("Content generiert");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Generierung fehlgeschlagen");
    } finally { setGenerating(false); }
  };

  const generate3 = async () => {
    if (!customerId) return toast.error("Kunde wählen");
    setGenerating(true);
    setResult(null);
    setVariants(null);
    setCompliance(null);
    try {
      const r = await api.post("/generator/variants", {
        customer_id: customerId,
        news_item_id: newsId || null,
        platform, tone, cta,
        target_link: targetLink,
        custom_prompt: customPrompt,
      });
      setVariants(r.data.variants);
      toast.success("3 Varianten erstellt");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Generierung fehlgeschlagen");
    } finally { setGenerating(false); }
  };

  const rewriteSafe = async () => {
    if (!result) return;
    setRewriting(true);
    try {
      const r = await api.post("/generator/safe-rewrite", {
        text: result.body, customer_id: customerId,
      });
      setResult({ ...result, body: r.data.rewritten });
      const cc = await api.post("/generator/compliance-check", { text: `${result.title}\n${r.data.rewritten}` });
      setCompliance(cc.data);
      toast.success("Text sicherer formuliert");
    } catch { toast.error("Umschreiben fehlgeschlagen"); } finally { setRewriting(false); }
  };

  const regenerateHashtags = async () => {
    if (!result) return;
    const r = await api.post("/generator/hashtags", {
      text: `${result.title} ${result.body}`,
      customer_id: customerId,
      platform,
      count: 12,
    });
    setResult({ ...result, hashtags: r.data.hashtags });
  };

  const runCompliance = async () => {
    if (!result) return;
    const r = await api.post("/generator/compliance-check", { text: `${result.title}\n${result.body}` });
    setCompliance(r.data);
  };

  const save = async () => {
    if (!result) return;
    setSaving(true);
    try {
      await api.put(`/generator/contents/${result.id}`, {
        title: result.title, body: result.body, hashtags: result.hashtags,
        cta: result.cta, target_link: result.target_link, tone: result.tone,
        status: "review",
      });
      toast.success("Content zur Freigabe markiert");
      navigate("/approvals");
    } catch { toast.error("Speichern fehlgeschlagen"); } finally { setSaving(false); }
  };

  return (
    <div className="space-y-6" data-testid="content-generator-page">
      <header>
        <div className="fux-label">/ content-generator</div>
        <h1 className="fux-heading text-4xl mt-1">Content-Generator</h1>
      </header>

      <QuickModes
        currentCustomer={currentCustomer}
        onManual={(t) => {
          setNewsId("");
          setPlatform("instagram");
          setCustomPrompt(t);
          setCta("Jetzt anfragen");
          toast.success("Manual-Vorlage geladen — direkt auf Generieren klicken");
        }}
        onService={(service) => {
          setNewsId("");
          setPlatform("google_business");
          setTone("lokal");
          setCustomPrompt(
            `Erstelle einen Service-Post für den Service "${service}". Beschreibe kurz, was der Kunde erwarten kann, welchen Nutzen der Service bringt, und fordere zur Kontaktaufnahme auf. Fahrzeugbezogen wenn sinnvoll.`,
          );
          setCta(`${service} anfragen`);
          toast.success(`Service-Vorlage "${service}" geladen`);
        }}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: Form */}
        <div className="fux-card space-y-4 lg:col-span-1">
          <div>
            <label className="fux-label block mb-1.5">Kunde</label>
            <select className="fux-input" value={customerId} onChange={(e) => setCustomerId(e.target.value)} data-testid="gen-customer">
              <option value="">— wählen —</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="fux-label block mb-1.5">News-Item (optional)</label>
            <select className="fux-input" value={newsId} onChange={(e) => setNewsId(e.target.value)} data-testid="gen-news">
              <option value="">— keine, frei generieren —</option>
              {news.map((n) => <option key={n.id} value={n.id}>{n.title.slice(0, 80)}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="fux-label block mb-1.5">Plattform</label>
              <select className="fux-input" value={platform} onChange={(e) => setPlatform(e.target.value)} data-testid="gen-platform">
                {PLATFORMS.map((p) => <option key={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="fux-label block mb-1.5">Tonalität</label>
              <select className="fux-input" value={tone} onChange={(e) => setTone(e.target.value)} data-testid="gen-tone">
                {TONES.map((p) => <option key={p}>{p}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="fux-label block mb-1.5">CTA</label>
            <input className="fux-input" value={cta} onChange={(e) => setCta(e.target.value)} data-testid="gen-cta" />
          </div>
          <div>
            <label className="fux-label block mb-1.5">Ziel-Link</label>
            <input className="fux-input" placeholder="https://…" value={targetLink} onChange={(e) => setTargetLink(e.target.value)} data-testid="gen-link" />
          </div>
          <div>
            <label className="fux-label block mb-1.5">Zusatzanweisung (optional)</label>
            <textarea className="fux-input min-h-20" value={customPrompt} onChange={(e) => setCustomPrompt(e.target.value)} data-testid="gen-prompt" />
          </div>
          <button
            className="fux-btn-primary w-full justify-center py-3"
            onClick={generate}
            disabled={generating || !customerId}
            data-testid="gen-submit"
          >
            <Wand2 size={16} /> {generating ? "Generiere…" : "Content generieren"}
          </button>
          <button
            className="fux-btn-ghost w-full justify-center py-2"
            onClick={generate3}
            disabled={generating || !customerId}
            data-testid="gen-variants"
          >
            <Layers size={14} /> 3 Varianten generieren
          </button>
        </div>

        {/* Right: Result */}
        <div className="lg:col-span-2 space-y-4">
          {!result && !variants && (
            <div className="fux-card min-h-64 flex flex-col items-center justify-center text-muted-foreground">
              <Sparkles size={32} className="opacity-40 mb-3" />
              <div className="fux-label">Bereit zum Generieren</div>
              <p className="text-sm mt-2 max-w-md text-center">
                Wähle einen Kunden, optional ein News-Item, dann Plattform und Tonalität — anschließend Generieren oder 3 Varianten klicken.
              </p>
            </div>
          )}

          {variants && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3" data-testid="variants-grid">
              {variants.map((v) => (
                <div key={v.id} className="fux-card" data-testid={`variant-${v.tone}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="fux-badge fux-badge-accent">{v.tone}</span>
                    <span className="fux-badge">{v.platform}</span>
                  </div>
                  <h3 className="font-semibold text-sm line-clamp-2">{v.title}</h3>
                  <p className="text-xs text-muted-foreground line-clamp-4 mt-2 whitespace-pre-line">{v.body}</p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {(v.hashtags || []).slice(0, 5).map((h) => <span key={h} className="fux-badge">{h}</span>)}
                  </div>
                  <button
                    className="fux-btn-ghost w-full mt-3 justify-center"
                    onClick={() => { setResult(v); setVariants(null); }}
                    data-testid={`variant-open-${v.tone}`}
                  >
                    Öffnen & bearbeiten
                  </button>
                </div>
              ))}
            </div>
          )}

          {result && (
            <>
              <div className="fux-card" data-testid="generated-result">
                <div className="flex items-center justify-between mb-3">
                  <div className="fux-label">// generiert</div>
                  <div className="flex gap-2">
                    <span className="fux-badge">{result.platform}</span>
                    <span className="fux-badge">{result.tone}</span>
                  </div>
                </div>
                <input
                  className="fux-input font-semibold text-base"
                  value={result.title}
                  onChange={(e) => setResult({ ...result, title: e.target.value })}
                  data-testid="gen-result-title"
                />
                <textarea
                  className="fux-input mt-3 min-h-40"
                  value={result.body}
                  onChange={(e) => setResult({ ...result, body: e.target.value })}
                  data-testid="gen-result-body"
                />
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {(result.hashtags || []).map((h) => (
                    <span key={h} className="fux-badge fux-badge-accent">{h}</span>
                  ))}
                </div>
                <div className="flex items-center gap-3 mt-4 flex-wrap">
                  <button className="fux-btn-ghost" onClick={regenerateHashtags} data-testid="regen-hashtags">
                    <Hash size={14} /> Hashtags neu
                  </button>
                  <button className="fux-btn-ghost" onClick={runCompliance} data-testid="run-compliance">
                    <ShieldAlert size={14} /> Compliance prüfen
                  </button>
                  <button className="fux-btn-ghost" onClick={rewriteSafe} disabled={rewriting} data-testid="safe-rewrite">
                    <ShieldCheck size={14} /> {rewriting ? "Umschreiben…" : "Sicherer formulieren"}
                  </button>
                  <button className="fux-btn-primary ml-auto" onClick={save} disabled={saving} data-testid="save-content">
                    <Save size={14} /> {saving ? "Speichere…" : "Speichern & zur Freigabe"}
                  </button>
                </div>
              </div>

              {compliance && (
                <div className={`fux-card ${compliance.ok ? "" : ""}`} data-testid="compliance-panel">
                  <div className="flex items-center gap-2 mb-3">
                    {compliance.ok ? (
                      <><CheckCircle2 size={18} className="text-primary" /> <span className="fux-heading text-lg">Compliance OK</span></>
                    ) : (
                      <><AlertTriangle size={18} style={{ color: "#FFB020" }} /> <span className="fux-heading text-lg" style={{ color: "#FFB020" }}>Compliance-Warnungen</span></>
                    )}
                  </div>
                  {compliance.warnings.length > 0 && (
                    <ul className="space-y-2">
                      {compliance.warnings.map((w, i) => (
                        <li key={i} className="text-sm border border-border p-3" style={{ borderColor: "#FFB020" }}>
                          <div className="font-medium" style={{ color: "#FFB020" }}>{w}</div>
                          {compliance.suggestions[i] && (
                            <div className="text-muted-foreground text-xs mt-1">→ {compliance.suggestions[i]}</div>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                  {compliance.ok && (
                    <p className="text-sm text-muted-foreground">Keine riskanten Aussagen erkannt.</p>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
