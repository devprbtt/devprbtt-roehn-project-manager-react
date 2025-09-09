// src/components/ProjectBootstrapper.tsx
import { useEffect } from "react";
import { useProject } from "@/store/project";
import { useAuth } from "@/store/auth";

export default function ProjectBootstrapper() {
  const { fetchProjeto, clearProjeto } = useProject();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) return;           // espere o auth terminar
    if (user) fetchProjeto();      // só busca projeto se estiver logado
    else clearProjeto();           // deslogado → limpa estado sem fazer fetch
  }, [loading, user, fetchProjeto, clearProjeto]);

  return null;
}
