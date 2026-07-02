import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { toast } from "sonner";
import { Radar, Share2, Video, Mail, LogOut, ArrowRight, Clock } from "lucide-react";

const APPS = [
  {
    key: "social",
    to: "/dashboard",
    name: "SocialFUX",
    tagline: "Content Ops",
    description: "News scrapen, KI-Content generieren, Creatives produzieren – markenkonform, in Serie.",
    icon: Share2,
    available: true,
  },
  {
    key: "video",
    to: null,
    name: "VideoFUX",
    tagline: "Video Ops",
    description: "KI-gestützte Video-Erstellung für Reels, Shorts und Werkstatt-Content.",
    icon: Video,
    available: false,
  },
  {
    key: "newsletter",
    to: null,
    name: "NewsletterFUX",
    tagline: "Newsletter Ops",
    description: "Newsletter-Kampagnen planen, gestalten und automatisiert versenden.",
    icon: Mail,
    available: false,
  },
];

export default function Apps() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const openApp = (app) => {
    if (!app.available) {
      toast("Noch nicht verfügbar", { description: `${app.name} befindet sich in Entwicklung.` });
      return;
    }
    navigate(app.to);
  };

  return (
    <div className="min-h-screen flex flex-col" data-testid="apps-page">
      <header className="border-b border-border px-8 py-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Radar className="text-primary" size={26} strokeWidth={2} />
          <div>
            <div className="fux-heading text-2xl leading-none">MarketingFUX</div>
            <div className="fux-label mt-1">tuningfux.de · tool auswahl</div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-sm font-semibold" data-testid="current-user-email">{user?.email}</div>
            <div className="fux-label mt-0.5">{user?.role}</div>
          </div>
          <button
            data-testid="logout-btn"
            className="fux-btn-ghost"
            onClick={() => { logout(); navigate("/login"); }}
          >
            <LogOut size={14} /> Abmelden
          </button>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center p-8">
        <div className="w-full max-w-5xl">
          <div className="text-center mb-10">
            <div className="fux-label mb-2">// WILLKOMMEN BEI MARKETINGFUX</div>
            <h1 className="fux-heading text-4xl">Welches Tool möchtest du öffnen?</h1>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {APPS.map((app) => (
              <button
                key={app.key}
                onClick={() => openApp(app)}
                className={`fux-card text-left p-6 flex flex-col gap-4 transition-colors group ${
                  app.available ? "hover:border-primary cursor-pointer" : "opacity-70 cursor-pointer"
                }`}
                data-testid={`app-tile-${app.key}`}
              >
                <div className="flex items-start justify-between">
                  <app.icon size={32} className={app.available ? "text-primary" : "text-muted-foreground"} strokeWidth={1.75} />
                  {!app.available && (
                    <span className="fux-badge inline-flex items-center gap-1">
                      <Clock size={10} /> Bald verfügbar
                    </span>
                  )}
                </div>
                <div>
                  <div className="fux-heading text-2xl">{app.name}</div>
                  <div className="fux-label mt-1">{app.tagline}</div>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed flex-1">{app.description}</p>
                <div className={`flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider ${
                  app.available ? "text-primary" : "text-muted-foreground"
                }`}>
                  {app.available ? "Öffnen" : "In Entwicklung"}
                  <ArrowRight size={13} className={app.available ? "group-hover:translate-x-0.5 transition-transform" : ""} />
                </div>
              </button>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
