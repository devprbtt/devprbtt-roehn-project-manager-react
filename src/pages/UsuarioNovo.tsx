import { useState } from "react";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useNavigate, Link } from "react-router-dom";
import { UserPlus, ArrowLeft } from "lucide-react";

export default function UsuarioNovo() {
  const { toast } = useToast();
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [email, setEmail]     = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole]       = useState<"user" | "admin">("user");
  const [loading, setLoading] = useState(false);

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
        toast({ variant: "destructive", title: "Erro", description: data?.error || data?.message || "Falha ao criar usuário." });
      }
    } catch {
      toast({ variant: "destructive", title: "Erro", description: "Falha ao se conectar ao servidor." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Layout projectSelected={false}>
      <div className="max-w-lg mx-auto">
        <Card className="border-0 shadow-lg rounded-3xl">
          <CardHeader className="border-0">
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <UserPlus className="h-5 w-5" /> Registrar Novo Usuário
            </h2>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div>
                <Label htmlFor="username">Nome de Usuário</Label>
                <Input id="username" value={username} onChange={e => setUsername(e.target.value)} required autoComplete="username" />
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" />
              </div>
              <div>
                <Label htmlFor="password">Senha</Label>
                <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} required autoComplete="new-password" />
              </div>
              <div>
                <Label htmlFor="role">Função</Label>
                <select id="role" className="w-full h-10 px-3 rounded-md border bg-background" value={role} onChange={e => setRole(e.target.value as any)}>
                  <option value="user">Usuário</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <Button type="submit" disabled={loading}>Criar Usuário</Button>
                <Button variant="secondary" asChild><Link to="/usuarios"><ArrowLeft className="h-4 w-4 mr-1" />Voltar</Link></Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
