import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { AlertTriangle, CheckCircle2, Hash, Save, ShieldAlert, Sparkles, Wand2 } from "lucide-react";
import { toast } from "sonner";

const PLATFORMS = ["instagram","facebook","linkedin","google_business","blog","newsletter","whatsapp"];
const TONES = ["technisch","seriös","sportlich","premium","verkaufsstark","kurz","b2b","lokal"];

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
  const [compliance, setCompliance] = useState(null);
  const [saving, setSaving] = useState(false);

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
      toast.success("Content generated");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Generation failed");
    } finally { setGenerating(false); }
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
      toast.success("Content marked for review");
      navigate("/archive");
    } catch { toast.error("Save failed"); } finally { setSaving(false); }
  };

  return (
    <div className="space-y-6" data-testid="content-generator-page">
      <header>
        <div className="fux-label">/ content-generator</div>
        <h1 className="fux-heading text-4xl mt-1">Content Generator</h1>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: Form */}
        <div className="fux-card space-y-4 lg:col-span-1">
          <div>
            <label className="fux-label block mb-1.5">Customer</label>
            <select className="fux-input" value={customerId} onChange={(e) => setCustomerId(e.target.value)} data-testid="gen-customer">
              <option value="">— select —</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="fux-label block mb-1.5">News item (optional)</label>
            <select className="fux-input" value={newsId} onChange={(e) => setNewsId(e.target.value)} data-testid="gen-news">
              <option value="">— none, generate from scratch —</option>
              {news.map((n) => <option key={n.id} value={n.id}>{n.title.slice(0, 80)}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="fux-label block mb-1.5">Platform</label>
              <select className="fux-input" value={platform} onChange={(e) => setPlatform(e.target.value)} data-testid="gen-platform">
                {PLATFORMS.map((p) => <option key={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="fux-label block mb-1.5">Tone</label>
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
            <label className="fux-label block mb-1.5">Target link</label>
            <input className="fux-input" placeholder="https://…" value={targetLink} onChange={(e) => setTargetLink(e.target.value)} data-testid="gen-link" />
          </div>
          <div>
            <label className="fux-label block mb-1.5">Extra instruction (optional)</label>
            <textarea className="fux-input min-h-20" value={customPrompt} onChange={(e) => setCustomPrompt(e.target.value)} data-testid="gen-prompt" />
          </div>
          <button
            className="fux-btn-primary w-full justify-center py-3"
            onClick={generate}
            disabled={generating || !customerId}
            data-testid="gen-submit"
          >
            <Wand2 size={16} /> {generating ? "Generating…" : "Generate content"}
          </button>
        </div>

        {/* Right: Result */}
        <div className="lg:col-span-2 space-y-4">
          {!result && (
            <div className="fux-card min-h-64 flex flex-col items-center justify-center text-muted-foreground">
              <Sparkles size={32} className="opacity-40 mb-3" />
              <div className="fux-label">Awaiting generation</div>
              <p className="text-sm mt-2 max-w-md text-center">
                Pick a customer, optionally a news item, choose platform and tone, then hit Generate.
              </p>
            </div>
          )}

          {result && (
            <>
              <div className="fux-card" data-testid="generated-result">
                <div className="flex items-center justify-between mb-3">
                  <div className="fux-label">// generated</div>
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
                <div className="flex items-center gap-3 mt-4">
                  <button className="fux-btn-ghost" onClick={regenerateHashtags} data-testid="regen-hashtags">
                    <Hash size={14} /> Regenerate hashtags
                  </button>
                  <button className="fux-btn-ghost" onClick={runCompliance} data-testid="run-compliance">
                    <ShieldAlert size={14} /> Compliance check
                  </button>
                  <button className="fux-btn-primary ml-auto" onClick={save} disabled={saving} data-testid="save-content">
                    <Save size={14} /> {saving ? "Saving…" : "Save & submit for review"}
                  </button>
                </div>
              </div>

              {compliance && (
                <div className={`fux-card ${compliance.ok ? "" : ""}`} data-testid="compliance-panel">
                  <div className="flex items-center gap-2 mb-3">
                    {compliance.ok ? (
                      <><CheckCircle2 size={18} className="text-primary" /> <span className="fux-heading text-lg">Compliance OK</span></>
                    ) : (
                      <><AlertTriangle size={18} style={{ color: "#FFB020" }} /> <span className="fux-heading text-lg" style={{ color: "#FFB020" }}>Compliance warnings</span></>
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
