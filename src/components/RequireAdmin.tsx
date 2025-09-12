// src/components/RequireAdmin.tsx
import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";

export default function RequireAdmin({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<"loading" | "ok" | "login" | "forbidden">("loading");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/session", { credentials: "include" });
        const data = await res.json();
        if (!data?.authenticated) return setState("login");
        if (data?.user?.role !== "admin") return setState("forbidden");
        setState("ok");
      } catch {
        setState("login");
      }
    })();
  }, []);

  if (state === "loading") return <div className="p-6 text-sm text-muted-foreground">Verificando permissões…</div>;
  if (state === "login") return <Navigate to="/login" replace />;
  if (state === "forbidden") return <Navigate to="/" replace />;
  return <>{children}</>;
}
