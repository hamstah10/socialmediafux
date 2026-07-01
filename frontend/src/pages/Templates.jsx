import { useEffect, useState } from "react";
import { api } from "../lib/api";

export default function Templates() {
  const [items, setItems] = useState([]);
  useEffect(() => { api.get("/templates").then((r) => setItems(r.data)); }, []);

  return (
    <div className="space-y-6" data-testid="templates-page">
      <header>
        <div className="fux-label">/ templates</div>
        <h1 className="fux-heading text-4xl mt-1">Design Templates</h1>
        <p className="text-muted-foreground text-sm mt-2">
          Globale Templates für Creatives. Der visuelle Template-Builder folgt in Phase 2 – MVP zeigt die JSON-Konfiguration.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((t) => (
          <div key={t.id} className="fux-card" data-testid={`template-${t.id}`}>
            <div className="fux-label">{t.style_key}</div>
            <h3 className="fux-heading text-lg mt-1">{t.name}</h3>
            <div className="flex flex-wrap gap-2 mt-3">
              <span className="fux-badge">{t.format}</span>
              <span className="fux-badge">{t.width}×{t.height}</span>
              <span className="fux-badge">{t.background_type}</span>
              {t.is_global && <span className="fux-badge fux-badge-accent">global</span>}
            </div>
            <pre className="mono text-[11px] text-muted-foreground mt-3 whitespace-pre-wrap break-all border border-border p-3">
{JSON.stringify(t.config, null, 2)}
            </pre>
          </div>
        ))}
        {items.length === 0 && (
          <div className="fux-card col-span-full text-muted-foreground">Keine Templates gefunden.</div>
        )}
      </div>
    </div>
  );
}
