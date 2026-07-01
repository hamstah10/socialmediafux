import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import {
  LayoutDashboard,
  Users,
  Rss,
  Inbox,
  Link2,
  Wand2,
  Palette,
  Layers,
  Archive,
  LayoutTemplate,
  Image,
  Settings,
  LogOut,
  Radar,
} from "lucide-react";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, testid: "nav-dashboard" },
  { to: "/customers", label: "Customers", icon: Users, testid: "nav-customers" },
  { to: "/news-sources", label: "News Sources", icon: Rss, testid: "nav-news-sources" },
  { to: "/news", label: "News Inbox", icon: Inbox, testid: "nav-news-inbox" },
  { to: "/news/import-url", label: "URL Import", icon: Link2, testid: "nav-import-url" },
  { to: "/content-generator", label: "Generator", icon: Wand2, testid: "nav-generator" },
  { to: "/creative-editor", label: "Creative Editor", icon: Palette, testid: "nav-creative-editor" },
  { to: "/layout-editor", label: "Layout Editor", icon: Layers, testid: "nav-layout-editor" },
  { to: "/archive", label: "Archive", icon: Archive, testid: "nav-archive" },
  { to: "/templates", label: "Templates", icon: LayoutTemplate, testid: "nav-templates" },
  { to: "/media-library", label: "Media Library", icon: Image, testid: "nav-media" },
  { to: "/settings", label: "Settings", icon: Settings, testid: "nav-settings" },
];

export default function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex" data-testid="app-layout">
      <aside
        className="w-64 shrink-0 bg-card border-r border-border flex flex-col"
        data-testid="app-sidebar"
      >
        <div className="px-6 py-5 border-b border-border flex items-center gap-2">
          <Radar className="text-primary" size={22} strokeWidth={2} />
          <div>
            <div className="fux-heading text-xl leading-none">SocialFUX</div>
            <div className="fux-label mt-1">tuning content ops</div>
          </div>
        </div>
        <nav className="flex-1 py-4">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              data-testid={n.testid}
              className={({ isActive }) =>
                `flex items-center gap-3 px-6 py-2.5 text-sm transition-colors border-l-2 ${
                  isActive
                    ? "border-primary text-primary bg-secondary"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:bg-secondary"
                }`
              }
            >
              <n.icon size={16} strokeWidth={1.75} />
              <span className="uppercase tracking-wider text-xs font-semibold">{n.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-border px-6 py-4">
          <div className="fux-label">Signed in as</div>
          <div className="text-sm font-semibold truncate" data-testid="current-user-email">
            {user?.email}
          </div>
          <div className="fux-label mt-0.5">{user?.role}</div>
          <button
            data-testid="logout-btn"
            className="fux-btn-ghost mt-3 w-full justify-center"
            onClick={() => {
              logout();
              navigate("/login");
            }}
          >
            <LogOut size={14} /> Logout
          </button>
        </div>
      </aside>

      <main className="flex-1 min-w-0">
        <div className="border-b border-border bg-background/70 backdrop-blur px-8 py-3 flex items-center justify-between">
          <div className="fux-label">social.tuningfux.de · admin console</div>
          <div className="flex items-center gap-2">
            <span className="fux-badge">
              <span className="inline-block w-1.5 h-1.5 bg-primary mr-1.5 animate-pulse" />
              live
            </span>
            <span className="fux-badge">v0.1.0</span>
          </div>
        </div>
        <div className="p-8 fux-fade-in">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
