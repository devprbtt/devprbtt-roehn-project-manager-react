import { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";
import { Users, UserPlus, Trash2 } from "lucide-react";

type UserRow = { id: number; username: string; email: string; role: "admin" | "user"; is_current?: boolean };

export default function Usuarios() {
  const { toast } = useToast();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/users", { credentials: "same-origin" });
      const data = await res.json();
      setUsers(data?.users || []);
    } catch {
      // eslint-disable-next-line no-console
      console.error("Falha ao carregar usuários");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

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
        toast({ variant: "destructive", title: "Erro", description: data?.error || data?.message || "Falha ao excluir usuário." });
      }
    } catch {
      toast({ variant: "destructive", title: "Erro", description: "Falha ao se conectar ao servidor." });
    }
  }

  return (
    <Layout projectSelected={false}>
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-5 w-5" /> Gerenciar Usuários
          </h2>
          <Button asChild><Link to="/usuarios/novo"><UserPlus className="h-4 w-4 mr-2" />Novo Usuário</Link></Button>
        </div>

        <Card className="border-0 shadow-sm rounded-3xl">
          <CardHeader className="border-0">Usuários do Sistema</CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground">Carregando…</p>
            ) : users.length === 0 ? (
              <p className="text-center text-muted-foreground py-6">Nenhum usuário cadastrado.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left border-b">
                      <th className="py-2">ID</th>
                      <th className="py-2">Usuário</th>
                      <th className="py-2">Email</th>
                      <th className="py-2">Função</th>
                      <th className="py-2 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(u => (
                      <tr key={u.id} className="border-b">
                        <td className="py-2">{u.id}</td>
                        <td className="py-2">{u.username}</td>
                        <td className="py-2">{u.email}</td>
                        <td className="py-2">
                          <span className={`px-2 py-1 text-xs rounded ${u.role === "admin" ? "bg-red-100 text-red-700" : "bg-primary/10 text-primary"}`}>
                            {u.role}
                          </span>
                        </td>
                        <td className="py-2 text-right">
                          {u.is_current ? (
                            <span className="text-muted-foreground text-xs">Usuário atual</span>
                          ) : (
                            <Button
                              variant="outline"
                              className="text-red-600 border-red-600 hover:bg-red-50"
                              onClick={() => handleDelete(u.id)}
                            >
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
    </Layout>
  );
}
