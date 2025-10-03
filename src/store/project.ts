// src/store/project.ts
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ProjetoSlim = { id: number; nome: string };

type ProjectState = {
  projeto: ProjetoSlim | null;
  loading: boolean;
  setProjeto: (p: ProjetoSlim | null) => void;
  clearProjeto: () => void;

  // carrega da sessão do backend
  fetchProjeto: () => Promise<void>;
};

export const useProject = create<ProjectState>()(
  persist(
    (set, get) => ({
      projeto: null,
      loading: true,
      setProjeto: (p) => set({ projeto: p, loading: false }),
      clearProjeto: () => set({ projeto: null, loading: false }),

      fetchProjeto: async () => {
        set({ loading: true });
        try {
          const res = await fetch("/api/projeto_atual", {
            credentials: "same-origin",
            headers: { Accept: "application/json" },
          });

          // se a sessão nem está autenticada, não mexe no store aqui
          if (res.status === 401) return;

          const data = await res.json().catch(() => null);

          // ⚠️ Só ZERE o projeto se o servidor explicitamente responder 200 com "projeto_atual": null
          if (res.ok) {
            // aceite tanto "projeto_atual" quanto "projeto" (tolerante a variações)
            const p = data?.projeto_atual ?? data?.projeto ?? null;
            if (p && typeof p.id === "number") {
              set({ projeto: { id: p.id, nome: p.nome } });
            } else {
              // somente aqui limpar
              set({ projeto: null });
            }
          }
          // se deu 4xx/5xx (exceto 401), não sobrescreva o estado atual
        } catch {
          // erro de rede? mantenha o estado atual
        } finally {
          set({ loading: false });
        }
      },
    }),
    {
      name: "project",
      partialize: (state) => ({ projeto: state.projeto }),
    }
  )
);
