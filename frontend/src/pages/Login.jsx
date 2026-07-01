import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { AlertCircle, Radar } from "lucide-react";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("admin@socialfux.local");
  const [password, setPassword] = useState("admin123456");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      navigate("/dashboard");
    } catch (err) {
      setError(err?.response?.data?.detail || "Login fehlgeschlagen");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2" data-testid="login-page">
      {/* Left: brand panel */}
      <div className="hidden lg:flex flex-col justify-between p-12 border-r border-border relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none opacity-40"
             style={{
               backgroundImage:
                 "linear-gradient(#232D42 1px,transparent 1px),linear-gradient(90deg,#232D42 1px,transparent 1px)",
               backgroundSize: "60px 60px",
             }}
        />
        <div className="relative flex items-center gap-3">
          <Radar className="text-primary" size={32} strokeWidth={2} />
          <div>
            <div className="fux-heading text-3xl leading-none">SocialFUX</div>
            <div className="fux-label mt-1">social.tuningfux.de</div>
          </div>
        </div>
        <div className="relative">
          <div className="fux-label mb-3">CONTENT OPS FOR</div>
          <h1 className="fux-heading text-5xl leading-[0.95]">
            Automotive.<br />Chiptuning.<br />
            <span className="text-primary">Performance.</span>
          </h1>
          <p className="text-muted-foreground mt-6 max-w-md text-sm leading-relaxed">
            Mandantenfähige Social-Content-Plattform für Werkstätten, Tuner und
            Tuningfiles-Anbieter. News scrapen, KI-Content generieren,
            Creatives produzieren – markenkonform, rechtssicher, in Serie.
          </p>
        </div>
        <div className="relative fux-label">v0.1.0 · secure jwt session</div>
      </div>

      {/* Right: form */}
      <div className="flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="fux-label mb-2">// ACCESS TERMINAL</div>
          <h2 className="fux-heading text-3xl mb-8">Login</h2>

          <form onSubmit={submit} className="fux-card space-y-4" data-testid="login-form">
            <div>
              <label className="fux-label block mb-1.5">Email</label>
              <input
                data-testid="login-email"
                className="fux-input"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="fux-label block mb-1.5">Password</label>
              <input
                data-testid="login-password"
                className="fux-input"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {error && (
              <div className="flex items-start gap-2 text-destructive text-sm" data-testid="login-error">
                <AlertCircle size={16} className="mt-0.5" /> {error}
              </div>
            )}
            <button
              type="submit"
              data-testid="login-submit"
              disabled={loading}
              className="fux-btn-primary w-full justify-center py-3"
            >
              {loading ? "Signing in..." : "Enter cockpit"}
            </button>
          </form>

          <div className="mt-6 fux-label text-center">
            Default admin: admin@socialfux.local / admin123456
          </div>
        </div>
      </div>
    </div>
  );
}
