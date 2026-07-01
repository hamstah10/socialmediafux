import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";

const STATUSES = ["all","draft","review","approved","scheduled","published","archived"];
const PLATFORMS = ["all","instagram","facebook","linkedin","google_business","blog","newsletter","whatsapp"];

export default function Archive() {
  const [items, setItems] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [customerId, setCustomerId] = useState("");
  const [platform, setPlatform] = useState("all");
  const [status, setStatus] = useState("all");

  const load = () => {
    const q = new URLSearchParams();
    if (customerId) q.append("customer_id", customerId);
    if (platform !== "all") q.append("platform", platform);
    if (status !== "all") q.append("status_filter", status);
    api.get(`/generator/contents?${q.toString()}`).then((r) => setItems(r.data));
  };

  useEffect(() => { api.get("/customers").then((r) => setCustomers(r.data)); }, []);
  useEffect(() => { load(); }, [customerId, platform, status]);

  return (
    <div className="space-y-6" data-testid="archive-page">
      <header>
        <div className="fux-label">/ archive</div>
        <h1 className="fux-heading text-4xl mt-1">Archive</h1>
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
          <div key={c.id} className="fux-card" data-testid={`arch-item-${c.id}`}>
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
          </div>
        ))}
        {items.length === 0 && (
          <div className="fux-card col-span-full text-center text-muted-foreground">Keine Inhalte gefunden.</div>
        )}
      </div>
    </div>
  );
}
