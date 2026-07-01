import { useEffect, useState } from "react";
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
      <div className="fux-label">Quick action</div>
      <div className="fux-heading text-lg mt-1">{label}</div>
    </div>
    <Icon size={22} className="text-muted-foreground group-hover:text-primary transition-colors" strokeWidth={1.75} />
  </Link>
);

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/dashboard/stats")
      .then((r) => setStats(r.data))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="fux-label" data-testid="dashboard-loading">Loading telemetry…</div>;
  if (!stats) return <div className="fux-label">No data</div>;

  return (
    <div className="space-y-8" data-testid="dashboard-page">
      <header className="flex items-end justify-between">
        <div>
          <div className="fux-label">/ dashboard</div>
          <h1 className="fux-heading text-4xl mt-1">Command Center</h1>
          <p className="text-muted-foreground text-sm mt-2">
            Live overview of your customers, imported news and generated content.
          </p>
        </div>
      </header>

      <section className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Stat icon={Users} label="Customers" value={stats.customers_count} testid="stat-customers" />
        <Stat icon={Newspaper} label="New news" value={stats.news_new_count} testid="stat-news-new" />
        <Stat icon={FileEdit} label="Drafts" value={stats.drafts_count} testid="stat-drafts" />
        <Stat icon={CheckCircle2} label="Approved" value={stats.approved_count} testid="stat-approved" />
        <Stat icon={Send} label="Published" value={stats.published_count} testid="stat-published" />
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="fux-card" data-testid="latest-news-card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="fux-heading text-lg">Latest news</h2>
            <Link to="/news" className="fux-label hover:text-primary">view all →</Link>
          </div>
          <ul className="divide-y divide-border">
            {stats.latest_news.length === 0 && (
              <li className="text-muted-foreground text-sm py-4">
                No news yet. Fetch a source or import a URL.
              </li>
            )}
            {stats.latest_news.map((n) => (
              <li key={n.id} className="py-3 flex gap-3" data-testid={`dash-news-${n.id}`}>
                {n.image_url && (
                  <img
                    src={resolveUpload(n.image_url).startsWith("http") ? n.image_url : resolveUpload(n.image_url)}
                    alt=""
                    className="w-14 h-14 object-cover border border-border shrink-0"
                    onError={(e) => (e.target.style.display = "none")}
                  />
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{n.title}</div>
                  <div className="fux-label mt-1">{n.status} · {n.published_at?.slice(0, 10) || "—"}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="fux-card" data-testid="latest-generated-card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="fux-heading text-lg">Latest generated content</h2>
            <Link to="/archive" className="fux-label hover:text-primary">archive →</Link>
          </div>
          <ul className="divide-y divide-border">
            {stats.latest_generated_content.length === 0 && (
              <li className="text-muted-foreground text-sm py-4">
                Nothing generated yet.
              </li>
            )}
            {stats.latest_generated_content.map((c) => (
              <li key={c.id} className="py-3" data-testid={`dash-generated-${c.id}`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-medium truncate flex-1">{c.title || "(untitled)"}</div>
                  <span className="fux-badge">{c.platform}</span>
                </div>
                <div className="fux-label mt-1">{c.status} · {c.tone}</div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section>
        <h2 className="fux-heading text-lg mb-4">Quick actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <QuickAction to="/customers" icon={Plus} label="New customer" testid="qa-new-customer" />
          <QuickAction to="/news-sources" icon={Rss} label="Import news" testid="qa-import-news" />
          <QuickAction to="/content-generator" icon={Wand2} label="Generate content" testid="qa-generate" />
          <QuickAction to="/creative-editor" icon={Palette} label="Create creative" testid="qa-creative" />
        </div>
      </section>
    </div>
  );
}
