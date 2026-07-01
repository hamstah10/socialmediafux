import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { toast } from "sonner";
import { CheckCircle2, XCircle, Send, ArrowRight, MessageSquare, X, RotateCcw, Archive as ArchiveIcon, Copy, Download, Link as LinkIcon } from "lucide-react";

const STATUSES = ["all","draft","review","approved","scheduled","published","archived"];
const PLATFORMS = ["all","instagram","facebook","linkedin","google_business","blog","newsletter","whatsapp"];

// Icons + label for the "primary" action of each source status.
// The backend enforces which transitions are allowed; the UI just surfaces them.
const ACTION_LABELS = {
  review:    { icon: Send,        label: "Submit for review", cls: "fux-btn-primary" },
  approved:  { icon: CheckCircle2, label: "Approve",           cls: "fux-btn-primary" },
  draft:     { icon: RotateCcw,   label: "Send back to draft", cls: "fux-btn-ghost" },
  published: { icon: Send,        label: "Mark published",     cls: "fux-btn-primary" },
  scheduled: { icon: ArrowRight,  label: "Schedule",           cls: "fux-btn-ghost" },
  archived:  { icon: ArchiveIcon, label: "Archive",            cls: "fux-btn-ghost" },
};

export default function Archive() {
  const [items, setItems] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [customerId, setCustomerId] = useState("");
  const [platform, setPlatform] = useState("all");
  const [status, setStatus] = useState("all");
  const [detail, setDetail] = useState(null); // selected content
  const [allowed, setAllowed] = useState([]);
  const [events, setEvents] = useState([]);
  const [links, setLinks] = useState([]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const load = () => {
    const q = new URLSearchParams();
    if (customerId) q.append("customer_id", customerId);
    if (platform !== "all") q.append("platform", platform);
    if (status !== "all") q.append("status_filter", status);
    api.get(`/generator/contents?${q.toString()}`).then((r) => setItems(r.data));
  };

  useEffect(() => { api.get("/customers").then((r) => setCustomers(r.data)); }, []);
  useEffect(() => { load(); }, [customerId, platform, status]);

  const openDetail = async (c) => {
    setDetail(c);
    setNote("");
    try {
      const [ev, lk] = await Promise.all([
        api.get(`/generator/contents/${c.id}/events`),
        api.get(`/approvals?content_id=${c.id}`),
      ]);
      setEvents(ev.data.events || []);
      setAllowed(ev.data.allowed_transitions || []);
      setLinks(lk.data || []);
    } catch {
      setEvents([]); setAllowed([]); setLinks([]);
    }
  };

  const createApprovalLink = async () => {
    if (!detail) return;
    setBusy(true);
    try {
      const r = await api.post("/approvals/create", {
        generated_content_id: detail.id, expires_in_days: 14,
      });
      const publicUrl = `${window.location.origin}/approve/${r.data.token}`;
      await navigator.clipboard?.writeText(publicUrl).catch(() => {});
      toast.success("Freigabe-Link kopiert!");
      setLinks([r.data, ...links]);
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Link erstellen fehlgeschlagen");
    } finally { setBusy(false); }
  };

  const copyLink = async (token) => {
    const url = `${window.location.origin}/approve/${token}`;
    await navigator.clipboard?.writeText(url).catch(() => {});
    toast.success("Link kopiert");
  };

  const exportZip = async (creativeId) => {
    try {
      const r = await api.get(`/creatives/${creativeId}/export-zip`, { responseType: "blob" });
      const blob = new Blob([r.data], { type: "application/zip" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `socialfux-${creativeId.slice(0, 8)}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("ZIP heruntergeladen");
    } catch (err) {
      toast.error("Kein zugehöriges Creative — erstelle zuerst eins im Creative Editor.");
    }
  };

  const transition = async (target) => {
    if (!detail) return;
    setBusy(true);
    try {
      const r = await api.post(`/generator/contents/${detail.id}/transition`, {
        status: target, note: note || null,
      });
      toast.success(`Moved to ${target}`);
      setDetail(r.data.content);
      setNote("");
      // Refresh events + allowed
      const ev = await api.get(`/generator/contents/${detail.id}/events`);
      setEvents(ev.data.events || []);
      setAllowed(ev.data.allowed_transitions || []);
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Transition failed");
    } finally { setBusy(false); }
  };

  return (
    <div className="space-y-6" data-testid="archive-page">
      <header>
        <div className="fux-label">/ archive</div>
        <h1 className="fux-heading text-4xl mt-1">Archive & Approvals</h1>
        <p className="text-muted-foreground text-sm mt-2">
          Alle generierten Inhalte. Klick auf einen Eintrag öffnet den Freigabe-Workflow.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <select className="fux-input max-w-xs" value={customerId} onChange={(e) => setCustomerId(e.target.value)} data-testid="arch-customer">
          <option value="">All customers</option>
          {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select className="fux-input max-w-xs" value={platform} onChange={(e) => setPlatform(e.target.value)} data-testid="arch-platform">
          {PLATFORMS.map((p) => <option key={p}>{p}</option>)}
        </select>
        <select className="fux-input max-w-xs" value={status} onChange={(e) => setStatus(e.target.value)} data-testid="arch-status">
          {STATUSES.map((p) => <option key={p}>{p}</option>)}
        </select>
        <div className="fux-label ml-auto">{items.length} items</div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {items.map((c) => (
          <button
            key={c.id}
            onClick={() => openDetail(c)}
            className="fux-card text-left hover:border-primary transition-colors"
            data-testid={`arch-item-${c.id}`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="fux-badge">{c.platform}</span>
              <span className="fux-badge fux-badge-accent">{c.status}</span>
            </div>
            <h3 className="font-semibold text-base line-clamp-2">{c.title || "(untitled)"}</h3>
            <p className="text-sm text-muted-foreground line-clamp-3 mt-2 whitespace-pre-line">{c.body}</p>
            <div className="flex flex-wrap gap-1 mt-3">
              {(c.hashtags || []).slice(0, 6).map((h) => <span key={h} className="fux-badge">{h}</span>)}
            </div>
            <div className="fux-label mt-3">{c.tone} · {c.created_at?.slice(0, 10)}</div>
          </button>
        ))}
        {items.length === 0 && (
          <div className="fux-card col-span-full text-center text-muted-foreground">Keine Inhalte gefunden.</div>
        )}
      </div>

      {detail && (
        <div className="fixed inset-0 bg-background/85 flex items-center justify-center z-50 p-6 overflow-y-auto" data-testid="content-detail-modal">
          <div className="fux-card w-full max-w-3xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="fux-label">// {detail.platform} · {detail.tone}</div>
                <h2 className="fux-heading text-2xl mt-1">{detail.title || "(untitled)"}</h2>
              </div>
              <button onClick={() => setDetail(null)} data-testid="close-detail"><X size={18} /></button>
            </div>

            <div className="flex items-center gap-2 mb-4">
              <span className="fux-label">Status</span>
              <span className="fux-badge fux-badge-accent" data-testid="detail-status">{detail.status}</span>
            </div>

            <div className="fux-label mb-1">Body</div>
            <p className="text-sm whitespace-pre-line border border-border p-3 mb-4">{detail.body}</p>

            {(detail.hashtags || []).length > 0 && (
              <>
                <div className="fux-label mb-1">Hashtags</div>
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {detail.hashtags.map((h) => <span key={h} className="fux-badge fux-badge-accent">{h}</span>)}
                </div>
              </>
            )}

            {/* Approval link + Export */}
            <div className="border-t border-border pt-4">
              <div className="fux-label mb-2">Freigabe-Link & Export</div>
              <div className="flex flex-wrap gap-2 mb-3">
                <button className="fux-btn-primary" onClick={createApprovalLink} disabled={busy} data-testid="create-approval-link">
                  <LinkIcon size={14} /> Freigabe-Link erstellen
                </button>
                <a
                  href={`${window.location.origin}/approve/${links[0]?.token || ''}`}
                  target="_blank"
                  rel="noreferrer"
                  className={`fux-btn-ghost ${links.length === 0 ? 'opacity-50 pointer-events-none' : ''}`}
                  data-testid="open-approval-link"
                >
                  Öffnen
                </a>
              </div>
              {links.length > 0 && (
                <ul className="space-y-1.5" data-testid="approval-links-list">
                  {links.map((l) => {
                    const url = `${window.location.origin}/approve/${l.token}`;
                    return (
                      <li key={l.id} className="flex items-center gap-2 text-xs border border-border p-2" data-testid={`link-${l.id}`}>
                        <span className="fux-badge fux-badge-accent">{l.status}</span>
                        <span className="mono truncate flex-1">{url}</span>
                        <button onClick={() => copyLink(l.token)} className="fux-label hover:text-primary inline-flex items-center gap-1">
                          <Copy size={12} /> copy
                        </button>
                        {l.customer_comment && (
                          <span className="fux-label italic" title={l.customer_comment}>"…{l.customer_comment.slice(0, 30)}"</span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {/* Approval actions */}
            <div className="border-t border-border pt-4 mt-4">
              <div className="fux-label mb-2">Approval actions</div>
              {allowed.length === 0 ? (
                <div className="text-sm text-muted-foreground">No transitions available from status "{detail.status}".</div>
              ) : (
                <>
                  <div className="mb-3">
                    <label className="fux-label block mb-1.5 flex items-center gap-1">
                      <MessageSquare size={12} /> Note (optional — visible in history)
                    </label>
                    <textarea
                      className="fux-input min-h-16"
                      placeholder="e.g. 'Bitte Headline kürzen und CTA anpassen'"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      data-testid="transition-note"
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {allowed.map((s) => {
                      const meta = ACTION_LABELS[s] || { icon: ArrowRight, label: `Move to ${s}`, cls: "fux-btn-ghost" };
                      const Icon = meta.icon;
                      return (
                        <button
                          key={s}
                          disabled={busy}
                          className={meta.cls}
                          onClick={() => transition(s)}
                          data-testid={`transition-${s}`}
                        >
                          <Icon size={14} /> {meta.label}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            {/* History */}
            <div className="border-t border-border pt-4 mt-6">
              <div className="fux-label mb-2">History ({events.length})</div>
              {events.length === 0 ? (
                <div className="text-sm text-muted-foreground">No transitions yet.</div>
              ) : (
                <ul className="space-y-2">
                  {events.map((e) => (
                    <li key={e.id} className="text-sm border border-border p-3" data-testid={`event-${e.id}`}>
                      <div className="flex items-center gap-2">
                        <span className="fux-badge">{e.from_status}</span>
                        <ArrowRight size={12} />
                        <span className="fux-badge fux-badge-accent">{e.to_status}</span>
                        <span className="fux-label ml-auto">{e.created_at?.slice(0, 16).replace("T", " ")}</span>
                      </div>
                      {e.note && <div className="mt-2 text-muted-foreground italic">"{e.note}"</div>}
                      <div className="fux-label mt-1">by {e.by_user_email || "?"}</div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
