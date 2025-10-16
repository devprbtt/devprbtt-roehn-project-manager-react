import { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { useProject } from "@/store/project";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useNavigate, Link } from "react-router-dom";
import { UserPlus, ArrowLeft, Sparkles } from "lucide-react";
import { motion } from "framer-motion";

export default function UsuarioNovo() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { projeto } = useProject();
  const projetoSelecionado = !!projeto?.id;
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"user" | "admin">("user");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const s = await fetch("/api/session", { credentials: "include" });
        const sd = await s.json();
        if (!sd?.authenticated) {
          navigate("/login", { replace: true });
          return;
        }
        if (sd?.user?.role !== "admin") {
          toast({
            variant: "destructive",
            title: "Acesso negado",
            description: "Somente administradores podem criar usuários.",
          });
          navigate("/usuarios", { replace: true });
          return;
        }
      } catch {
        navigate("/", { replace: true });
      }
    })();
  }, [navigate, toast]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ username: username.trim(), email: email.trim(), password, role }),
      });
      const data = await res.json();
      if (res.ok && (data?.ok || data?.success)) {
        toast({ title: "Usuário criado!", description: "Cadastro realizado com sucesso." });
        navigate("/usuarios");
      } else {
        toast({
          variant: "destructive",
          title: "Erro",
          description: data?.error || data?.message || "Falha ao criar usuário.",
        });
      }
    } catch {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Falha ao se conectar ao servidor.",
      });
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
                  <UserPlus className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h1 className="text-4xl font-bold text-foreground mb-2">Novo Usuário</h1>
                  <p className="text-lg text-muted-foreground max-w-2xl">
                    Crie uma nova conta de acesso para o sistema.
                  </p>
                </div>
              </div>
              <div className="h-1 w-32 bg-gradient-to-r from-purple-600 to-violet-600 rounded-full shadow-sm" />
            </div>
            <Button
              variant="secondary"
              asChild
              className="rounded-xl shadow-lg hover:shadow-xl transition-all duration-300"
            >
              <Link to="/usuarios">
                <ArrowLeft className="h-4 w-4 mr-1" />
                Voltar
              </Link>
            </Button>
          </div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="max-w-lg mx-auto"
          >
            <Card className="border-0 shadow-lg rounded-3xl bg-card/50 backdrop-blur-sm">
              <CardHeader className="border-0">
                <CardTitle className="flex items-center gap-2 text-xl">
                  <UserPlus className="h-5 w-5 text-primary" />
                  Registrar Novo Usuário
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form className="space-y-4" onSubmit={handleSubmit}>
                  <div>
                    <Label htmlFor="username">Nome de Usuário</Label>
                    <Input
                      id="username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      required
                      autoComplete="username"
                    />
                  </div>
                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      autoComplete="email"
                    />
                  </div>
                  <div>
                    <Label htmlFor="password">Senha</Label>
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      autoComplete="new-password"
                    />
                  </div>
                  <div>
                    <Label htmlFor="role">Função</Label>
                    <select
                      id="role"
                      className="w-full h-10 px-3 rounded-md border bg-background"
                      value={role}
                      onChange={(e) => setRole(e.target.value as any)}
                    >
                      <option value="user">Usuário</option>
                      <option value="admin">Administrador</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      type="submit"
                      disabled={loading}
                      className="rounded-xl shadow-lg hover:shadow-xl transition-all duration-300"
                    >
                      Criar Usuário
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </Layout>
  );
}
