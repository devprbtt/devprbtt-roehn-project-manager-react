import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import Layout from "@/components/Layout";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { Lock, User as UserIcon, Eye, EyeOff, LogIn } from "lucide-react";
import { useAuth } from "@/store/auth";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { setUser, fetchSession } = useAuth();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const from = (location.state as any)?.from || "/";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ username: username.trim(), password }),
      });

      let data: any = null;
      try { data = await res.json(); } catch {}

      if (res.ok && (data?.ok || data?.success)) {
        // atualiza o store para a Navbar refletir imediatamente
        if (data?.user) setUser(data.user);
        else await fetchSession(); // fallback, se o backend não devolver user

        toast({ title: "Bem-vindo!", description: "Login realizado com sucesso." });
        navigate(from);
      } else {
        setError(data?.error || data?.message || (res.status === 401 ? "Usuário ou senha inválidos." : "Falha ao autenticar."));
      }
    } catch {
      setError("Falha ao conectar ao servidor. Verifique sua conexão.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Layout>
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <Card className="w-full max-w-md border-0 shadow-lg rounded-3xl bg-card/70 backdrop-blur">
          <CardHeader className="px-6 pt-6 pb-2">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Lock className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="text-2xl font-bold leading-tight">Login</h2>
                <p className="text-sm text-muted-foreground">Acesse o Gerenciador de Projetos Roehn</p>
              </div>
            </div>
            <div className="mt-4 h-1 w-24 bg-gradient-to-r from-primary to-primary/40 rounded-full" />
          </CardHeader>

          <CardContent className="px-6 pb-6">
            {error && (
              <Alert className="mb-4 border-destructive/30 bg-destructive/10">
                <AlertDescription className="text-destructive-foreground">
                  {error}
                </AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Usuário</Label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="username"
                    autoFocus
                    placeholder="Seu usuário"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="pl-9"
                    required
                    autoComplete="username"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pr-10"
                    required
                    autoComplete="current-password"
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
                className="w-full h-11"
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
      </div>
    </Layout>
  );
}
