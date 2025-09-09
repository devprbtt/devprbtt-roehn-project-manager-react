// src/store/auth.ts
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type AuthUser = {
  id: number;
  username: string;
  role?: "admin" | "user";
};

type AuthState = {
  user: AuthUser | null;
  loading: boolean;

  // session
  fetchSession: () => Promise<void>;   // alias para loadSession (compat com seu AppInner)
  loadSession: () => Promise<void>;

  // auth actions
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;

  // util
  setUser: (u: AuthUser | null) => void; // compat com seu Login.tsx
};

export const useAuth = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      loading: true, // começa carregando até consultar /api/session

      // Consulta a sessão no backend e popula o usuário
      loadSession: async () => {
        try {
          const res = await fetch("/api/session", { credentials: "same-origin" });
          const data = await res.json();
          if (res.ok && data?.authenticated) {
            set({ user: data.user ?? null, loading: false });
          } else {
            set({ user: null, loading: false });
          }
        } catch {
          set({ user: null, loading: false });
        }
      },

      // Alias para manter compatibilidade com o que você já chama
      fetchSession: async () => {
        await get().loadSession();
      },

      // Faz login e já sincroniza a sessão
      login: async (username, password) => {
        try {
          const res = await fetch("/api/login", {
            method: "POST",
            credentials: "same-origin",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify({ username, password }),
          });
          const data = await res.json();
          if (res.ok && (data?.ok || data?.success)) {
            await get().loadSession();
            return true;
          }
        } catch {
          /* noop */
        }
        return false;
      },

      // Faz logout no backend e limpa o usuário
      logout: async () => {
        try {
          await fetch("/api/logout", { method: "POST", credentials: "same-origin" });
        } catch {
          /* noop */
        }
        set({ user: null });
      },

      // Útil se você quiser setar manualmente o user após alguma ação
      setUser: (u) => set({ user: u }),
    }),
    { name: "auth" }
  )
);
