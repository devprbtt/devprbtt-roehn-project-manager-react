import { useEffect, useMemo, useState } from "react";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { useProject } from "@/store/project";
import { Trash2, PlusCircle, Layers, DoorOpen } from "lucide-react";

type Area = { id: number; nome: string };
type Ambiente = { id: number; nome: string; area: Area };

export default function Ambientes() {
  const { projeto } = useProject();
  const projetoSelecionado = !!projeto?.id;
  const { toast } = useToast();

  const [areas, setAreas] = useState<Area[]>([]);
  const [ambientes, setAmbientes] = useState<Ambiente[]>([]);
  const [loading, setLoading] = useState(true);

  // form
  const [nome, setNome] = useState("");
  const [areaId, setAreaId] = useState<number | "">("");

  const fetchData = async () => {
    setLoading(true);
    try {
      const [areasRes, ambRes] = await Promise.all([
        fetch("/api/areas", { credentials: "same-origin" }),
        fetch("/api/ambientes", { credentials: "same-origin" }),
      ]);
      const areasData = await areasRes.json();
      const ambData = await ambRes.json();
      setAreas(areasData?.areas || []);
      setAmbientes(ambData?.ambientes || []);
    } catch {
      toast({ variant: "destructive", title: "Erro", description: "Falha ao carregar áreas/ambientes." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (projetoSelecionado) fetchData();
  }, [projetoSelecionado]);

  const areaOptions = useMemo(() => areas.map(a => ({ id: a.id, label: a.nome })), [areas]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim() || !areaId) {
      toast({ variant: "destructive", title: "Erro", description: "Preencha nome e área." });
      return;
    }
    try {
      const res = await fetch("/api/ambientes", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ nome: nome.trim(), area_id: areaId }),
      });
      let data: any = null; try { data = await res.json(); } catch {}
      if (res.ok && (data?.ok || data?.success)) {
        setNome("");
        setAreaId("");
        await fetchData();
        toast({ title: "Sucesso!", description: "Ambiente adicionado." });
      } else {
        toast({ variant: "destructive", title: "Erro", description: data?.error || data?.message || "Falha ao adicionar ambiente." });
      }
    } catch {
      toast({ variant: "destructive", title: "Erro", description: "Falha ao se conectar ao servidor." });
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Tem certeza que deseja excluir este ambiente? Esta ação não pode ser desfeita.")) return;
    try {
      const res = await fetch(`/api/ambientes/${id}`, {
        method: "DELETE",
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });
      let data: any = null; try { data = await res.json(); } catch {}
      if (res.ok && (data?.ok || data?.success)) {
        setAmbientes(prev => prev.filter(a => a.id !== id));
        toast({ title: "Sucesso!", description: "Ambiente excluído." });
      } else {
        toast({ variant: "destructive", title: "Erro", description: data?.error || data?.message || "Falha ao excluir ambiente." });
      }
    } catch {
      toast({ variant: "destructive", title: "Erro", description: "Falha ao se conectar ao servidor." });
    }
  }

  return (
    <Layout projectSelected={projetoSelecionado}>
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Layers className="h-5 w-5" /> Gerenciar Ambientes
          </h2>
          <p className="text-sm text-muted-foreground">Defina os ambientes dentro de cada área.</p>
        </div>

        {!projetoSelecionado && (
          <Alert className="mb-6">
            <AlertDescription>Selecione um projeto na página inicial para cadastrar ambientes.</AlertDescription>
          </Alert>
        )}

        <div className="grid md:grid-cols-2 gap-4">
          <Card className="border-0 shadow-sm rounded-3xl">
            <CardHeader className="border-0">Adicionar Novo Ambiente</CardHeader>
            <CardContent>
              <form className="space-y-3" onSubmit={handleCreate}>
                <div>
                  <Label htmlFor="nome" className="text-muted-foreground">Nome do Ambiente</Label>
                  <Input
                    id="nome"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    required
                    disabled={!projetoSelecionado}
                  />
                </div>
                <div>
                  <Label htmlFor="area_id" className="text-muted-foreground">Área</Label>
                  <select
                    id="area_id"
                    className="w-full h-10 px-3 rounded-md border bg-background"
                    value={areaId as any}
                    onChange={(e) => setAreaId(Number(e.target.value))}
                    required
                    disabled={!projetoSelecionado}
                  >
                    <option value="">Selecione uma área</option>
                    {areaOptions.map(opt => (
                      <option key={opt.id} value={opt.id}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                <Button type="submit" className="w-full" disabled={!projetoSelecionado}>
                  <PlusCircle className="h-4 w-4 mr-2" />
                  Adicionar Ambiente
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm rounded-3xl">
            <CardHeader className="border-0">Ambientes Cadastrados</CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-sm text-muted-foreground">Carregando…</p>
              ) : ambientes.length === 0 ? (
                <p className="text-muted-foreground text-center py-6">Nenhum ambiente cadastrado ainda.</p>
              ) : (
                <ul className="space-y-2">
                  {ambientes.map(a => (
                    <li key={a.id} className="flex items-center justify-between rounded-lg border p-3">
                      <div className="mr-4">
                        <div className="font-semibold flex items-center gap-2">
                          <DoorOpen className="h-4 w-4 text-muted-foreground" />
                          {a.nome}
                        </div>
                        <div className="text-sm text-muted-foreground mt-1">
                          Área: {a.area?.nome}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          className="text-red-600 border-red-600 hover:bg-red-50"
                          onClick={() => handleDelete(a.id)}
                          disabled={!projetoSelecionado}
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Excluir
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
