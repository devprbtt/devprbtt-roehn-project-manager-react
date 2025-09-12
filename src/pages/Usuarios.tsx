import { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { useAuth } from "@/store/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useNavigate, Link } from "react-router-dom";
import { Users, UserPlus, Trash2, Shield } from "lucide-react";
import { Badge } from "@/components/ui/badge";

type UserRow = { id: number; username: string; email: string; role: "admin" | "user"; is_current?: boolean };

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
          description: "A página de usuários é restrita a administradores." 
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
          description: "A página de usuários é restrita a administradores." 
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
        description: "Falha ao carregar usuários." 
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
        setUsers(prev => prev.filter(u => u.id !== id));
        toast({ title: "Sucesso!", description: "Usuário excluído." });
      } else {
        toast({ 
          variant: "destructive", 
          title: "Erro", 
          description: data?.error || data?.message || "Falha ao excluir usuário." 
        });
      }
    } catch {
      toast({ 
        variant: "destructive", 
        title: "Erro", 
        description: "Falha ao se conectar ao servidor." 
      });
    }
  }

  return (
    <Layout>
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <Shield className="h-8 w-8 text-primary" />
              <div>
                <h1 className="text-3xl font-bold text-foreground">Gerenciar Usuários</h1>
                <p className="text-muted-foreground mt-1">Controle de contas e permissões.</p>
              </div>
            </div>
            <div className="h-1 w-24 bg-gradient-to-r from-primary to-primary-glow rounded-full" />
          </div>

          <div className="flex items-center justify-between mb-4">
            <div className="h-10" />
            <Button asChild>
              <Link to="/usuarios/novo">
                <UserPlus className="h-4 w-4 mr-2" />
                Novo Usuário
              </Link>
            </Button>
          </div>

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
                <p className="text-center text-muted-foreground py-6">Nenhum usuário cadastrado.</p>
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
                    <tbody>
                      {users.map(u => (
                        <tr key={u.id} className="border-b">
                          <td className="py-2 px-3">{u.id}</td>
                          <td className="py-2 px-3">{u.username}</td>
                          <td className="py-2 px-3">{u.email}</td>
                          <td className="py-2 px-3">
                            <span className={`px-2 py-1 text-xs rounded ${u.role === "admin" ? "bg-red-100 text-red-700" : "bg-primary/10 text-primary"}`}>
                              {u.role}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-right">
                            {u.is_current ? (
                              <span className="text-muted-foreground text-xs">Usuário atual</span>
                            ) : (
                              <Button variant="destructive" size="sm" onClick={() => handleDelete(u.id)}>
                                <Trash2 className="h-4 w-4 mr-1" /> Excluir
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}