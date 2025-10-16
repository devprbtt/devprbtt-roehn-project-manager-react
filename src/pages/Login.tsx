import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import Layout from "@/components/Layout";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { Lock, Eye, EyeOff, LogIn, Sparkles } from "lucide-react";
import { useAuth } from "@/store/auth";
import { motion } from "framer-motion";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { user, fetchSession } = useAuth();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const from = (location.state as any)?.from || "/";

  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  useEffect(() => {
    if (user) {
      navigate(from, { replace: true });
    }
  }, [user, from, navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/login", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const data = await res.json();
      if (res.ok && data?.ok) {
        await fetchSession();
        toast({ title: "Bem-vindo!", description: "Login realizado com sucesso." });
      } else {
        setError(data?.error || "Credenciais inválidas.");
      }
    } catch {
      setError("Falha ao se conectar ao servidor.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 dark:from-background dark:via-background/40 dark:to-primary/25">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 mb-10">
            <div>
              <div className="flex items-center gap-4 mb-4">
                <div className="w-16 h-16 bg-gradient-to-br from-purple-600 to-violet-600 rounded-3xl flex items-center justify-center shadow-lg shadow-purple-500/25">
                  <LogIn className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h1 className="text-4xl font-bold text-foreground mb-2">Login</h1>
                  <p className="text-lg text-muted-foreground max-w-2xl">
                    Entre para acessar seu painel e gerenciar seus projetos.
                  </p>
                </div>
              </div>
              <div className="h-1 w-32 bg-gradient-to-r from-purple-600 to-violet-600 rounded-full shadow-sm" />
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="max-w-md mx-auto"
          >
            <Card className="border-0 shadow-lg rounded-3xl bg-card/50 backdrop-blur-sm">
              <CardHeader className="text-center">
                <div className="flex flex-col items-center mb-4">
                  <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center mb-2">
                    <Lock className="h-6 w-6 text-gray-600" />
                  </div>
                  <h2 className="text-2xl font-bold">Acesso ao Sistema</h2>
                </div>
              </CardHeader>
              <CardContent>
                {error && (
                  <Alert variant="destructive" className="mb-4">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
                <form className="space-y-4" onSubmit={handleSubmit}>
                  <div>
                    <Label htmlFor="username">Nome de Usuário</Label>
                    <Input
                      id="username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      required
                      autoComplete="username"
                      className="h-11"
                    />
                  </div>
                  <div>
                    <Label htmlFor="password">Senha</Label>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        autoComplete="current-password"
                        className="h-11 pr-10"
                      />
                      <button
                        type="button"
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-md hover:bg-muted"
                        onClick={() => setShowPassword((s) => !s)}
                        aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    className="w-full h-11 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300"
                    disabled={loading || !username || !password}
                  >
                    {loading ? (
                      <span className="inline-flex items-center gap-2">
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-transparent border-b-current" />
                        Entrando...
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-2">
                        <LogIn className="h-4 w-4" />
                        Entrar
                      </span>
                    )}
                  </Button>

                  <p className="text-center text-xs text-muted-foreground">
                    Dica: usuário <span className="font-medium">admin</span> / senha <span className="font-medium">admin123</span> (alterar após primeiro login)
                  </p>
                </form>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </Layout>
  );
}
