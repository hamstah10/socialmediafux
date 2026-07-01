import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { toast } from "sonner";
import { CheckCircle2, Send, ArrowRight, MessageSquare, X, RotateCcw, Archive as ArchiveIcon, Copy, Link as LinkIcon, Trash2 } from "lucide-react";

// Active approval workflow only — finished posts (published/archived) live
// in the separate Archive page instead.
const WORKFLOW_STATUSES = ["draft", "review", "approved", "scheduled"];
const STATUSES = ["all", ...WORKFLOW_STATUSES];
const PLATFORMS = ["all","instagram","facebook","linkedin","google_business","blog","newsletter","whatsapp"];

// Icons + label for the "primary" action of each source status.
// The backend enforces which transitions are allowed; the UI just surfaces them.
const ACTION_LABELS = {
  review:    { icon: Send,        label: "Zur Freigabe senden", cls: "fux-btn-primary" },
  approved:  { icon: CheckCircle2, label: "Freigeben",           cls: "fux-btn-primary" },
  draft:     { icon: RotateCcw,   label: "Zurück zum Entwurf", cls: "fux-btn-ghost" },
  published: { icon: Send,        label: "Als veröffentlicht markieren",     cls: "fux-btn-primary" },
  scheduled: { icon: ArrowRight,  label: "Planen",           cls: "fux-btn-ghost" },
  archived:  { icon: ArchiveIcon, label: "Archivieren",            cls: "fux-btn-ghost" },
};

export default function Approvals() {
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
  const [creative, setCreative] = useState(null);

  const load = () => {
    if (status === "all") {
      // "all" here means all active-workflow statuses, never published/archived —
      // those live in the Archive page. Fetch each and merge client-side since
      // the API only supports a single status_filter value.
      Promise.all(
        WORKFLOW_STATUSES.map((s) => {
          const q = new URLSearchParams();
          if (customerId) q.append("customer_id", customerId);
          if (platform !== "all") q.append("platform", platform);
          q.append("status_filter", s);
          return api.get(`/generator/contents?${q.toString()}`).then((r) => r.data);
        }),
      ).then((results) => {
        const merged = results.flat();
        merged.sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
        setItems(merged);
      });
      return;
    }
    const q = new URLSearchParams();
    if (customerId) q.append("customer_id", customerId);
    if (platform !== "all") q.append("platform", platform);
    q.append("status_filter", status);
    api.get(`/generator/contents?${q.toString()}`).then((r) => setItems(r.data));
  };

  useEffect(() => { api.get("/customers").then((r) => setCustomers(r.data)); }, []);
  useEffect(() => { load(); }, [customerId, platform, status]);

  const openDetail = async (c) => {
    setDetail(c);
    setNote("");
    setCreative(null);
    try {
      const [ev, lk, cr] = await Promise.all([
        api.get(`/generator/contents/${c.id}/events`),
        api.get(`/approvals?content_id=${c.id}`),
        api.get(`/creatives?generated_content_id=${c.id}`),
      ]);
      setEvents(ev.data.events || []);
      setAllowed(ev.data.allowed_transitions || []);
      setLinks(lk.data || []);
      setCreative(cr.data?.[0] || null);
    } catch {
      setEvents([]); setAllowed([]); setLinks([]); setCreative(null);
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

  const removeContent = async () => {
    if (!detail) return;
    if (!window.confirm(`"${detail.title || "(ohne Titel)"}" endgültig löschen?`)) return;
    setBusy(true);
    try {
      await api.delete(`/generator/contents/${detail.id}`);
      toast.success("Gelöscht");
      setDetail(null);
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Löschen fehlgeschlagen");
    } finally { setBusy(false); }
  };

  const transition = async (target) => {
    if (!detail) return;
    setBusy(true);
    try {
      const r = await api.post(`/generator/contents/${detail.id}/transition`, {
        status: target, note: note || null,
      });
      toast.success(`Verschoben zu ${target}`);
      if (target === "published" || target === "archived") {
        // Item leaves the active workflow — close and refresh the list.
        setDetail(null);
      } else {
        setDetail(r.data.content);
        const ev = await api.get(`/generator/contents/${detail.id}/events`);
        setEvents(ev.data.events || []);
        setAllowed(ev.data.allowed_transitions || []);
      }
      setNote("");
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Statuswechsel fehlgeschlagen");
    } finally { setBusy(false); }
  };

  return (
    <div className="space-y-6" data-testid="approvals-page">
      <header>
        <div className="fux-label">/ freigabe</div>
        <h1 className="fux-heading text-4xl mt-1">Freigabe-Workflow</h1>
        <p className="text-muted-foreground text-sm mt-2">
          Entwürfe, in Prüfung befindliche und freigegebene Inhalte. Veröffentlichte und
          archivierte Posts findest du im Archiv.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <select className="fux-input max-w-xs" value={customerId} onChange={(e) => setCustomerId(e.target.value)} data-testid="appr-customer">
          <option value="">Alle Kunden</option>
          {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select className="fux-input max-w-xs" value={platform} onChange={(e) => setPlatform(e.target.value)} data-testid="appr-platform">
          {PLATFORMS.map((p) => <option key={p} value={p}>{p === "all" ? "alle" : p}</option>)}
        </select>
        <select className="fux-input max-w-xs" value={status} onChange={(e) => setStatus(e.target.value)} data-testid="appr-status">
          {STATUSES.map((p) => <option key={p} value={p}>{p === "all" ? "alle" : p}</option>)}
        </select>
        <div className="fux-label ml-auto">{items.length} Einträge</div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {items.map((c) => (
          <button
            key={c.id}
            onClick={() => openDetail(c)}
            className="fux-card text-left hover:border-primary transition-colors"
            data-testid={`appr-item-${c.id}`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="fux-badge">{c.platform}</span>
              <span className="fux-badge fux-badge-accent">{c.status}</span>
            </div>
            <h3 className="font-semibold text-base line-clamp-2">{c.title || "(ohne Titel)"}</h3>
            <p className="text-sm text-muted-foreground line-clamp-3 mt-2 whitespace-pre-line">{c.body}</p>
            <div className="flex flex-wrap gap-1 mt-3">
              {(c.hashtags || []).slice(0, 6).map((h) => <span key={h} className="fux-badge">{h}</span>)}
            </div>
            <div className="fux-label mt-3">{c.tone} · {c.created_at?.slice(0, 10)}</div>
          </button>
        ))}
        {items.length === 0 && (
          <div className="fux-card col-span-full text-center text-muted-foreground">Keine Inhalte im Freigabe-Workflow.</div>
        )}
      </div>

      {detail && (
        <div className="fixed inset-0 bg-background/85 flex items-center justify-center z-50 p-6 overflow-y-auto" data-testid="content-detail-modal">
          <div className="fux-card w-full max-w-3xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="fux-label">// {detail.platform} · {detail.tone}</div>
                <h2 className="fux-heading text-2xl mt-1">{detail.title || "(ohne Titel)"}</h2>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={removeContent}
                  disabled={busy}
                  className="fux-label hover:text-destructive inline-flex items-center gap-1"
                  data-testid="delete-content"
                >
                  <Trash2 size={14} /> löschen
                </button>
                <button onClick={() => setDetail(null)} data-testid="close-detail"><X size={18} /></button>
              </div>
            </div>

            <div className="flex items-center gap-2 mb-4">
              <span className="fux-label">Status</span>
              <span className="fux-badge fux-badge-accent" data-testid="detail-status">{detail.status}</span>
            </div>

            <div className="fux-label mb-2">Fertige Post-Vorschau</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                {creative?.preview_html ? (
                  <div
                    className="border border-border overflow-hidden"
                    data-testid="post-preview-creative"
                    dangerouslySetInnerHTML={{ __html: creative.preview_html }}
                  />
                ) : (
                  <div className="border border-border p-4 text-sm text-muted-foreground flex items-center justify-center min-h-40 text-center">
                    Kein Creative verknüpft — im Creative Editor eins für diesen Content erstellen.
                  </div>
                )}
              </div>
              <div>
                <div className="fux-label mb-1">Text</div>
                <p className="text-sm whitespace-pre-line border border-border p-3 mb-3">{detail.body}</p>
                {(detail.hashtags || []).length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {detail.hashtags.map((h) => <span key={h} className="fux-badge fux-badge-accent">{h}</span>)}
                  </div>
                )}
              </div>
            </div>

            {/* Approval link */}
            <div className="border-t border-border pt-4">
              <div className="fux-label mb-2">Freigabe-Link</div>
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
                          <Copy size={12} /> kopieren
                        </button>
                        {l.customer_comment && (
                          <span className="fux-label italic" title={l.customer_comment}>&quot;…{l.customer_comment.slice(0, 30)}&quot;</span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {/* Approval actions */}
            <div className="border-t border-border pt-4 mt-4">
              <div className="fux-label mb-2">Freigabe-Aktionen</div>
              {allowed.length === 0 ? (
                <div className="text-sm text-muted-foreground">Keine Statuswechsel möglich aus Status &quot;{detail.status}&quot;.</div>
              ) : (
                <>
                  <div className="mb-3">
                    <label className="fux-label block mb-1.5 flex items-center gap-1">
                      <MessageSquare size={12} /> Notiz (optional — sichtbar in Historie)
                    </label>
                    <textarea
                      className="fux-input min-h-16"
                      placeholder="z.B. 'Bitte Headline kürzen und CTA anpassen'"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      data-testid="transition-note"
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {allowed.map((s) => {
                      const meta = ACTION_LABELS[s] || { icon: ArrowRight, label: `Zu ${s}`, cls: "fux-btn-ghost" };
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
              <div className="fux-label mb-2">Historie ({events.length})</div>
              {events.length === 0 ? (
                <div className="text-sm text-muted-foreground">Noch keine Statuswechsel.</div>
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
                      {e.note && <div className="mt-2 text-muted-foreground italic">&quot;{e.note}&quot;</div>}
                      <div className="fux-label mt-1">von {e.by_user_email || "?"}</div>
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
