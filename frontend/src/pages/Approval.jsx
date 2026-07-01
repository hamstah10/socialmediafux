import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import { CheckCircle2, MessageSquareWarning, XCircle, Radar, Clock, AlertCircle } from "lucide-react";
import CreativePreview from "../components/CreativePreview";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const STATUS_META = {
  pending: { label: "Wartet auf Freigabe", cls: "text-primary", icon: Clock },
  approved: { label: "Freigegeben", cls: "text-primary", icon: CheckCircle2 },
  changes_requested: { label: "Änderung gewünscht", cls: "text-[#FFB020]", icon: MessageSquareWarning },
  rejected: { label: "Abgelehnt", cls: "text-destructive", icon: XCircle },
  expired: { label: "Link abgelaufen", cls: "text-muted-foreground", icon: AlertCircle },
};

export default function Approval() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const r = await axios.get(`${API}/approvals/public/${token}`);
      setData(r.data);
    } catch (err) {
      setError(err?.response?.data?.detail || "Link nicht gefunden");
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [token]);

  const decide = async (action) => {
    setBusy(true);
    try {
      await axios.post(`${API}/approvals/public/${token}/${action}`, { comment: comment || null });
      await load();
      setComment("");
    } catch (err) {
      setError(err?.response?.data?.detail || "Aktion fehlgeschlagen");
    } finally { setBusy(false); }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center fux-label">Lade…</div>;
  if (error && !data) return (
    <div className="min-h-screen flex items-center justify-center p-6" data-testid="approval-error">
      <div className="fux-card max-w-md text-center">
        <AlertCircle className="mx-auto text-destructive mb-2" />
        <div className="fux-heading text-xl">Fehler</div>
        <p className="text-sm text-muted-foreground mt-2">{error}</p>
      </div>
    </div>
  );

  const link = data.link;
  const content = data.content;
  const creative = data.creative;
  const customer = data.customer;
  const meta = STATUS_META[link.status] || STATUS_META.pending;
  const StatusIcon = meta.icon;
  const isFinal = ["approved", "rejected", "expired"].includes(link.status);

  return (
    <div className="min-h-screen py-10 px-6" data-testid="approval-page">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <Radar className="text-primary" size={24} />
          <div>
            <div className="fux-heading text-xl leading-none">SocialFUX</div>
            <div className="fux-label mt-1">content approval</div>
          </div>
        </div>

        {customer && (
          <div className="fux-card flex items-center gap-4 mb-6" data-testid="customer-header">
            {customer.logo_path && (
              <img src={`${BACKEND_URL}${customer.logo_path}`} alt="" className="w-14 h-14 object-contain border border-border" />
            )}
            <div>
              <div className="fux-label">Freigabe für</div>
              <h1 className="fux-heading text-2xl">{customer.name}</h1>
            </div>
          </div>
        )}

        <div className={`fux-card mb-6 flex items-center gap-3 ${meta.cls}`} data-testid="approval-status">
          <StatusIcon size={20} />
          <div className="fux-heading text-lg">{meta.label}</div>
          {link.expires_at && <div className="fux-label ml-auto">gültig bis {link.expires_at?.slice(0, 10)}</div>}
        </div>

        {creative && (
          <div className="fux-card mb-6">
            <div className="fux-label mb-3">Creative Preview</div>
            <CreativePreview
              customer={customer}
              format={creative.format}
              headline={creative.headline}
              subline={creative.subline}
              cta={creative.cta}
              logoUrl={customer?.logo_path ? `${BACKEND_URL}${customer.logo_path}` : ""}
              maxWidth={560}
              testid="approval-creative"
            />
          </div>
        )}

        {content && (
          <div className="fux-card mb-6" data-testid="content-block">
            <div className="flex items-center gap-2 mb-2">
              <span className="fux-badge fux-badge-accent">{content.platform}</span>
              <span className="fux-badge">{content.tone}</span>
            </div>
            <h2 className="fux-heading text-2xl mb-3">{content.title}</h2>
            <p className="text-sm whitespace-pre-line border border-border p-3 mb-3">{content.body}</p>
            {(content.hashtags || []).length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {content.hashtags.map((h) => <span key={h} className="fux-badge fux-badge-accent">{h}</span>)}
              </div>
            )}
            {content.cta && <div className="fux-label">CTA: {content.cta}</div>}
          </div>
        )}

        {link.customer_comment && (
          <div className="fux-card mb-6" data-testid="prev-comment">
            <div className="fux-label mb-1">Ihr vorheriger Kommentar</div>
            <div className="text-sm italic">"{link.customer_comment}"</div>
          </div>
        )}

        {!isFinal && (
          <div className="fux-card space-y-4" data-testid="approval-actions">
            <div>
              <label className="fux-label block mb-1.5">Kommentar (optional)</label>
              <textarea
                className="fux-input min-h-20"
                placeholder="Anmerkungen, Änderungswünsche oder Kommentare…"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                data-testid="approval-comment"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <button className="fux-btn-primary" disabled={busy} onClick={() => decide("approve")} data-testid="btn-approve">
                <CheckCircle2 size={14} /> Freigeben
              </button>
              <button className="fux-btn-ghost" disabled={busy} onClick={() => decide("request-changes")} data-testid="btn-request-changes">
                <MessageSquareWarning size={14} /> Änderung wünschen
              </button>
              <button className="fux-btn-ghost hover:text-destructive hover:border-destructive" disabled={busy} onClick={() => decide("reject")} data-testid="btn-reject">
                <XCircle size={14} /> Ablehnen
              </button>
            </div>
          </div>
        )}

        <div className="fux-label text-center mt-8">social.tuningfux.de · secure approval link</div>
      </div>
    </div>
  );
}
