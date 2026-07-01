import { useEffect, useState } from "react";
import { api, API_BASE } from "../lib/api";

const SettingsRow = ({ label, value, testid }) => (
  <div className="flex items-center justify-between border-b border-border py-3">
    <div className="fux-label">{label}</div>
    <div className="mono text-sm text-right break-all max-w-md" data-testid={testid}>{value}</div>
  </div>
);

export default function Settings() {
  const [s, setS] = useState(null);
  useEffect(() => { api.get("/settings").then((r) => setS(r.data)); }, []);

  return (
    <div className="space-y-6" data-testid="settings-page">
      <header>
        <div className="fux-label">/ einstellungen</div>
        <h1 className="fux-heading text-4xl mt-1">Einstellungen</h1>
      </header>

      <div className="fux-card">
        {s ? (
          <>
            <SettingsRow label="Anwendung" value={`${s.app} v${s.version}`} testid="set-app" />
            <SettingsRow label="Domain" value={s.domain} testid="set-domain" />
            <SettingsRow label="API-Basis-URL" value={API_BASE} testid="set-api" />
            <SettingsRow label="Upload-Verzeichnis" value={s.upload_dir} testid="set-uploads" />
            <SettingsRow label="LLM konfiguriert" value={s.llm_configured ? "ja · Claude Opus 4.8" : "nein (Mock-Generator)"} testid="set-llm" />
          </>
        ) : (
          <div className="fux-label">Lädt…</div>
        )}
      </div>

      <div className="fux-card">
        <h3 className="fux-heading text-lg mb-2">Deployment-Ziel</h3>
        <p className="text-sm text-muted-foreground">
          Für VPS-Betrieb ist Backend-Port <span className="mono">7090</span> vorgesehen. In dieser
          Emergent-Umgebung läuft der Server intern auf <span className="mono">8001</span> hinter
          Kubernetes Ingress. Nginx-Beispiel siehe <span className="mono">scripts/deploy_notes.md</span>.
        </p>
      </div>
    </div>
  );
}
