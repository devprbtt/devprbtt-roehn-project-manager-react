import { useEffect, useMemo, useState } from "react";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { Trash2, PlusCircle, Server, Layers, DoorOpen } from "lucide-react";
import { useProject } from "@/store/project";

type Ambiente = { id: number; nome: string; area?: { id: number; nome: string } };
type Circuito = {
  id: number;
  identificador: string;
  nome: string;
  tipo: "luz" | "persiana" | "hvac";
  ambiente: { id: number; nome: string; area?: { id: number; nome: string } };
  sak?: string | null;
};

export default function Circuitos() {
  const { toast } = useToast();
  const { projeto } = useProject();
  const [ambientes, setAmbientes] = useState<Ambiente[]>([]);
  const [circuitos, setCircuitos] = useState<Circuito[]>([]);
  const [loading, setLoading] = useState(true);

  // form
  const [identificador, setIdentificador] = useState("");
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState<"luz" | "persiana" | "hvac" | "">("");
  const [ambienteId, setAmbienteId] = useState<number | "">("");

  const projetoSelecionado = !!projeto?.id;

  const fetchData = async () => {
    setLoading(true);
    try {
      const [ambRes, circRes] = await Promise.all([
        fetch("/api/ambientes", { credentials: "same-origin" }),
        fetch("/api/circuitos", { credentials: "same-origin" }),
      ]);
      const ambData = await ambRes.json();
      const circData = await circRes.json();
      setAmbientes(ambData?.ambientes || []);
      setCircuitos(circData?.circuitos || []);
    } catch (e) {
      toast({ variant: "destructive", title: "Erro", description: "Falha ao carregar dados." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (projetoSelecionado) fetchData();
  }, [projetoSelecionado]);

  const ambienteOptions = useMemo(
    () =>
      ambientes.map((a) => ({
        id: a.id,
        label: a.area?.nome ? `${a.nome} (${a.area.nome})` : a.nome,
      })),
    [ambientes]
  );

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!identificador.trim() || !nome.trim() || !tipo || !ambienteId) {
      toast({ variant: "destructive", title: "Erro", description: "Preencha todos os campos." });
      return;
    }
    try {
      const res = await fetch("/api/circuitos", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          identificador: identificador.trim(),
          nome: nome.trim(),
          tipo,
          ambiente_id: ambienteId,
        }),
      });
      let data: any = null;
      try { data = await res.json(); } catch {}
      if (res.ok && (data?.ok || data?.success)) {
        setIdentificador("");
        setNome("");
        setTipo("");
        setAmbienteId("");
        await fetchData();
        toast({ title: "Sucesso!", description: "Circuito adicionado." });
      } else {
        toast({
          variant: "destructive",
          title: "Erro",
          description: data?.error || data?.message || "Falha ao adicionar circuito.",
        });
      }
    } catch {
      toast({ variant: "destructive", title: "Erro", description: "Falha ao se conectar ao servidor." });
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Tem certeza que deseja excluir este circuito?")) return;
    try {
      const res = await fetch(`/api/circuitos/${id}`, {
        method: "DELETE",
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });
      let data: any = null;
      try { data = await res.json(); } catch {}
      if (res.ok && (data?.ok || data?.success)) {
        setCircuitos((prev) => prev.filter((c) => c.id !== id));
        toast({ title: "Sucesso!", description: "Circuito excluído." });
      } else {
        toast({
          variant: "destructive",
          title: "Erro",
          description: data?.error || data?.message || "Falha ao excluir circuito.",
        });
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
            <Server className="h-5 w-5" /> Gerenciar Circuitos
          </h2>
          <p className="text-sm text-muted-foreground">Cadastre os circuitos com seus identificadores e tipos.</p>
        </div>

        {!projetoSelecionado && (
          <Alert className="mb-6">
            <AlertDescription>Selecione um projeto na página inicial para cadastrar circuitos.</AlertDescription>
          </Alert>
        )}

        <div className="grid md:grid-cols-2 gap-4">
          <Card className="border-0 shadow-sm rounded-3xl">
            <CardHeader className="border-0">Adicionar Novo Circuito</CardHeader>
            <CardContent>
              <form className="space-y-3" onSubmit={handleCreate}>
                <div>
                  <Label htmlFor="identificador" className="text-muted-foreground">Identificador</Label>
                  <Input
                    id="identificador"
                    value={identificador}
                    onChange={(e) => setIdentificador(e.target.value)}
                    required
                    disabled={!projetoSelecionado}
                  />
                </div>
                <div>
                  <Label htmlFor="nome" className="text-muted-foreground">Nome do Circuito</Label>
                  <Input
                    id="nome"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    required
                    disabled={!projetoSelecionado}
                  />
                </div>
                <div>
                  <Label htmlFor="tipo" className="text-muted-foreground">Tipo</Label>
                  <select
                    id="tipo"
                    className="w-full h-10 px-3 rounded-md border bg-background"
                    value={tipo}
                    onChange={(e) => setTipo(e.target.value as any)}
                    required
                    disabled={!projetoSelecionado}
                  >
                    <option value="">Selecione o tipo</option>
                    <option value="luz">Luz</option>
                    <option value="persiana">Persiana</option>
                    <option value="hvac">HVAC</option>
                  </select>
                </div>
                <div>
                  <Label htmlFor="ambiente_id" className="text-muted-foreground">Ambiente</Label>
                  <select
                    id="ambiente_id"
                    className="w-full h-10 px-3 rounded-md border bg-background"
                    value={ambienteId as any}
                    onChange={(e) => setAmbienteId(Number(e.target.value))}
                    required
                    disabled={!projetoSelecionado}
                  >
                    <option value="">Selecione um ambiente</option>
                    {ambienteOptions.map((opt) => (
                      <option key={opt.id} value={opt.id}>{opt.label}</option>
                    ))}
                  </select>
                </div>

                <Button type="submit" className="w-full" disabled={!projetoSelecionado}>
                  <PlusCircle className="h-4 w-4 mr-2" />
                  Adicionar Circuito
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm rounded-3xl">
            <CardHeader className="border-0">Circuitos Cadastrados</CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-sm text-muted-foreground">Carregando…</p>
              ) : circuitos.length === 0 ? (
                <p className="text-muted-foreground text-center py-6">Nenhum circuito cadastrado ainda.</p>
              ) : (
                <ul className="space-y-2">
                  {circuitos.map((c) => (
                    <li key={c.id} className="flex items-start justify-between rounded-lg border p-3">
                      <div className="mr-4">
                        <div className="font-semibold">
                          {c.identificador} — {c.nome} ({c.tipo})
                        </div>
                        <div className="text-sm text-muted-foreground flex items-center gap-2">
                          <DoorOpen className="h-4 w-4" />
                          Ambiente: {c.ambiente?.nome}
                          {c.ambiente?.area?.nome ? <> (Área: {c.ambiente.area.nome})</> : null}
                        </div>
                        <div className="text-sm text-muted-foreground mt-1">
                          SAK:{" "}
                          {c.tipo !== "hvac"
                            ? (c.sak ?? <span className="italic opacity-60">—</span>)
                            : <span className="opacity-60">Não aplicável</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          className="text-red-600 border-red-600 hover:bg-red-50"
                          onClick={() => handleDelete(c.id)}
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
