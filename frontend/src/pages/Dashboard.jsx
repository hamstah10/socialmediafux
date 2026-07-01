import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api, resolveUpload } from "../lib/api";
import {
  Users,
  Newspaper,
  FileEdit,
  CheckCircle2,
  Send,
  Plus,
  Rss,
  Wand2,
  Palette,
  ImageOff,
  Radar,
} from "lucide-react";

const Stat = ({ icon: Icon, label, value, testid }) => (
  <div className="fux-card" data-testid={testid}>
    <div className="flex items-center justify-between">
      <div className="fux-label">{label}</div>
      <Icon size={16} className="text-muted-foreground" strokeWidth={1.75} />
    </div>
    <div className="mt-4 fux-heading text-4xl text-white tabular-nums">{value}</div>
  </div>
);

const QuickAction = ({ to, icon: Icon, label, testid }) => (
  <Link
    to={to}
    data-testid={testid}
    className="fux-card hover:border-primary transition-colors flex items-center justify-between group"
  >
    <div>
      <div className="fux-label">Schnellaktion</div>
      <div className="fux-heading text-lg mt-1">{label}</div>
    </div>
    <Icon size={22} className="text-muted-foreground group-hover:text-primary transition-colors" strokeWidth={1.75} />
  </Link>
);

const NewsThumb = ({ src, label }) => {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div className="w-14 h-14 border border-border bg-secondary shrink-0 flex items-center justify-center text-muted-foreground">
        <ImageOff size={14} strokeWidth={1.5} />
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={label || ""}
      referrerPolicy="no-referrer"
      loading="lazy"
      className="w-14 h-14 object-cover border border-border shrink-0 bg-secondary"
      onError={() => setFailed(true)}
    />
  );
};

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(true);

  const sourceMap = useMemo(() => {
    const m = {};
    for (const s of sources) m[s.id] = s;
    return m;
  }, [sources]);

  useEffect(() => {
    Promise.all([
      api.get("/dashboard/stats"),
      api.get("/news-sources"),
    ])
      .then(([s, src]) => { setStats(s.data); setSources(src.data); })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="fux-label" data-testid="dashboard-loading">Lade Telemetrie…</div>;
  if (!stats) return <div className="fux-label">Keine Daten</div>;

  return (
    <div className="space-y-8" data-testid="dashboard-page">
      <header className="flex items-end justify-between">
        <div>
          <div className="fux-label">/ dashboard</div>
          <h1 className="fux-heading text-4xl mt-1">Kommandozentrale</h1>
          <p className="text-muted-foreground text-sm mt-2">
            Live-Übersicht deiner Kunden, importierten News und generierten Inhalte.
          </p>
        </div>
      </header>

      <section className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Stat icon={Users} label="Kunden" value={stats.customers_count} testid="stat-customers" />
        <Stat icon={Newspaper} label="Neue News" value={stats.news_new_count} testid="stat-news-new" />
        <Stat icon={FileEdit} label="Entwürfe" value={stats.drafts_count} testid="stat-drafts" />
        <Stat icon={CheckCircle2} label="Freigegeben" value={stats.approved_count} testid="stat-approved" />
        <Stat icon={Send} label="Veröffentlicht" value={stats.published_count} testid="stat-published" />
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="fux-card" data-testid="latest-news-card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="fux-heading text-lg">Neueste News</h2>
            <Link to="/news" className="fux-label hover:text-primary">alle anzeigen →</Link>
          </div>
          <ul className="divide-y divide-border">
            {stats.latest_news.length === 0 && (
              <li className="text-muted-foreground text-sm py-4">
                Noch keine News. Quelle abrufen oder URL importieren.
              </li>
            )}
            {stats.latest_news.map((n) => {
              const src = n.news_source_id ? sourceMap[n.news_source_id] : null;
              const srcLabel = src?.name || "Manuell";
              const raw = n.image_url;
              const imgSrc = raw
                ? (raw.startsWith("http") ? raw : resolveUpload(raw))
                : null;
              return (
                <li key={n.id} className="py-3 flex gap-3" data-testid={`dash-news-${n.id}`}>
                  <NewsThumb src={imgSrc} label={srcLabel} />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{n.title}</div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="fux-badge fux-badge-accent inline-flex items-center gap-1">
                        <Radar size={10} /> {srcLabel}
                      </span>
                      <span className="fux-label">{n.status} · {n.published_at?.slice(0, 10) || "—"}</span>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="fux-card" data-testid="latest-generated-card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="fux-heading text-lg">Neueste Inhalte</h2>
            <Link to="/approvals" className="fux-label hover:text-primary">freigabe →</Link>
          </div>
          <ul className="divide-y divide-border">
            {stats.latest_generated_content.length === 0 && (
              <li className="text-muted-foreground text-sm py-4">
                Noch nichts generiert.
              </li>
            )}
            {stats.latest_generated_content.map((c) => (
              <li key={c.id} className="py-3" data-testid={`dash-generated-${c.id}`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-medium truncate flex-1">{c.title || "(ohne Titel)"}</div>
                  <span className="fux-badge">{c.platform}</span>
                </div>
                <div className="fux-label mt-1">{c.status} · {c.tone}</div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section>
        <h2 className="fux-heading text-lg mb-4">Schnellaktionen</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <QuickAction to="/customers" icon={Plus} label="Neuer Kunde" testid="qa-new-customer" />
          <QuickAction to="/news-sources" icon={Rss} label="News importieren" testid="qa-import-news" />
          <QuickAction to="/content-generator" icon={Wand2} label="Content generieren" testid="qa-generate" />
          <QuickAction to="/creative-editor" icon={Palette} label="Creative erstellen" testid="qa-creative" />
        </div>
      </section>
    </div>
  );
}
