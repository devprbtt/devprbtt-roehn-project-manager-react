import { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { useAuth } from "@/store/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useNavigate, Link } from "react-router-dom";
import { Users, UserPlus, Trash2, Shield, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";

type UserRow = {
  id: number;
  username: string;
  email: string;
  role: "admin" | "user";
  is_current?: boolean;
};

export default function Usuarios() {
  const { user: sessionUser } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      if (sessionUser?.role !== "admin") {
        toast({
          variant: "destructive",
          title: "Acesso negado",
          description: "A página de usuários é restrita a administradores.",
        });
        navigate("/", { replace: true });
        return;
      }
      await fetchUsers();
    })();
  }, [sessionUser]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/users", { credentials: "same-origin" });
      if (res.status === 401) {
        navigate("/login", { replace: true });
        return;
      }
      if (res.status === 403) {
        toast({
          variant: "destructive",
          title: "Acesso negado",
          description: "A página de usuários é restrita a administradores.",
        });
        navigate("/", { replace: true });
        return;
      }
      const data = await res.json();
      setUsers(data?.users || []);
    } catch {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Falha ao carregar usuários.",
      });
    } finally {
      setLoading(false);
    }
  };

  async function handleDelete(id: number) {
    if (!confirm("Tem certeza que deseja excluir este usuário? Esta ação não pode ser desfeita.")) return;
    try {
      const res = await fetch(`/api/users/${id}`, {
        method: "DELETE",
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });
      const data = await res.json();
      if (res.ok && (data?.ok || data?.success)) {
        setUsers((prev) => prev.filter((u) => u.id !== id));
        toast({ title: "Sucesso!", description: "Usuário excluído." });
      } else {
        toast({
          variant: "destructive",
          title: "Erro",
          description: data?.error || data?.message || "Falha ao excluir usuário.",
        });
      }
    } catch {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Falha ao se conectar ao servidor.",
      });
    }
  }

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 mb-10">
            <div>
              <div className="flex items-center gap-4 mb-4">
                <div className="w-16 h-16 bg-gradient-to-br from-purple-600 to-violet-600 rounded-3xl flex items-center justify-center shadow-lg shadow-purple-500/25">
                  <Users className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h1 className="text-4xl font-bold text-slate-900 mb-2">Gerenciar Usuários</h1>
                  <p className="text-lg text-slate-600 max-w-2xl">
                    Crie, gerencie e defina as permissões de acesso para os usuários do sistema.
                  </p>
                </div>
              </div>
              <div className="h-1 w-32 bg-gradient-to-r from-purple-600 to-violet-600 rounded-full shadow-sm" />
            </div>
            <Button
              asChild
              className="rounded-xl shadow-lg hover:shadow-xl transition-all duration-300"
            >
              <Link to="/usuarios/novo">
                <UserPlus className="h-4 w-4 mr-2" />
                Novo Usuário
              </Link>
            </Button>
          </div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Card className="border-0 shadow-sm rounded-3xl bg-card/50 backdrop-blur-sm">
              <CardHeader className="border-0 pb-2">
                <CardTitle className="flex items-center justify-between text-xl">
                  <span className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-primary" />
                    Usuários do Sistema
                  </span>
                  <Badge variant="secondary" className="text-xs">
                    {users.length} {users.length === 1 ? "usuário" : "usuários"}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <p className="text-sm text-muted-foreground">Carregando…</p>
                ) : users.length === 0 ? (
                  <div className="text-center py-8">
                    <Users className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                    <p className="text-muted-foreground">Nenhum usuário cadastrado ainda.</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Adicione seu primeiro usuário usando o botão acima.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left border-b bg-muted/40">
                          <th className="py-2 px-3">ID</th>
                          <th className="py-2 px-3">Usuário</th>
                          <th className="py-2 px-3">Email</th>
                          <th className="py-2 px-3">Função</th>
                          <th className="py-2 px-3 text-right">Ações</th>
                        </tr>
                      </thead>
                      <AnimatePresence>
                        <tbody>
                          {users.map((u, index) => (
                            <motion.tr
                              key={u.id}
                              initial={{ opacity: 0, y: 20 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -20 }}
                              transition={{ delay: index * 0.05 }}
                              className="border-b"
                            >
                              <td className="py-2 px-3">{u.id}</td>
                              <td className="py-2 px-3">{u.username}</td>
                              <td className="py-2 px-3">{u.email}</td>
                              <td className="py-2 px-3">
                                <span
                                  className={`px-2 py-1 text-xs rounded-full ${
                                    u.role === "admin"
                                      ? "bg-red-100 text-red-700"
                                      : "bg-primary/10 text-primary"
                                  }`}
                                >
                                  {u.role}
                                </span>
                              </td>
                              <td className="py-2 px-3 text-right">
                                {u.is_current ? (
                                  <span className="text-muted-foreground text-xs">Usuário atual</span>
                                ) : (
                                  <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={() => handleDelete(u.id)}
                                    className="rounded-xl shadow-lg hover:shadow-xl transition-all duration-300"
                                  >
                                    <Trash2 className="h-4 w-4 mr-1" /> Excluir
                                  </Button>
                                )}
                              </td>
                            </motion.tr>
                          ))}
                        </tbody>
                      </AnimatePresence>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </Layout>
  );
}