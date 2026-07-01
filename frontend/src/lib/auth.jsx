import { createContext, useContext, useEffect, useState } from "react";
import { api } from "./api";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("fux_user") || "null");
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("fux_token");
    if (token && !user) {
      api
        .get("/auth/me")
        .then((r) => setUser(r.data))
        .catch(() => {
          localStorage.removeItem("fux_token");
          localStorage.removeItem("fux_user");
        });
    }
  }, []);

  const login = async (email, password) => {
    setLoading(true);
    try {
      const r = await api.post("/auth/login", { email, password });
      localStorage.setItem("fux_token", r.data.access_token);
      localStorage.setItem("fux_user", JSON.stringify(r.data.user));
      setUser(r.data.user);
      return r.data.user;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem("fux_token");
    localStorage.removeItem("fux_user");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
