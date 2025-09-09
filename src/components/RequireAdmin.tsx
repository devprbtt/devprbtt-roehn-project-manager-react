// src/components/RequireAdmin.tsx
import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/store/auth";
import Layout from "@/components/Layout";

export default function RequireAdmin({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return null;
  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }
  if (user.role !== "admin") {
    return (
      <Layout projectSelected={false}>
        <div className="max-w-2xl mx-auto mt-8">
          <div className="rounded-xl border p-6">
            <h2 className="text-xl font-semibold mb-2">Acesso negado</h2>
            <p className="text-muted-foreground">Esta seção é restrita a administradores.</p>
          </div>
        </div>
      </Layout>
    );
  }
  return <>{children}</>;
}
