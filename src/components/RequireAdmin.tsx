// RequireAdmin.tsx
import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/store/auth";

export default function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!loading) {
      if (!user) {
        setChecked(true);
      } else if (user.role !== "admin") {
        setChecked(true);
      } else {
        setChecked(true);
      }
    }
  }, [user, loading]);

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Verificando permissões…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== "admin") return <Navigate to="/" replace />;
  
  return <>{children}</>;
}