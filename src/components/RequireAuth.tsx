// src/components/RequireAuth.tsx
import { Navigate, useLocation } from "react-router-dom";
import { ReactNode } from "react";
import { useAuth } from "@/store/auth";

export default function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  // Mostre um placeholder enquanto carrega a sessão
  if (loading) return null; // ou <div className="p-4 text-sm text-muted-foreground">Carregando…</div>

  // Se não autenticado, redireciona para login e informa de onde veio (pathname+query+hash)
  if (!user) {
    const from = `${location.pathname}${location.search}${location.hash}`;
    // Evita redirect-loop caso alguém tente proteger a própria /login por engano:
    const goingToLogin = location.pathname === "/login";
    return goingToLogin ? null : <Navigate to="/login" replace state={{ from }} />;
  }

  return <>{children}</>;
}
