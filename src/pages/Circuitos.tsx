import { useEffect, useMemo, useState } from "react";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Trash2, PlusCircle, Server, Zap, DoorOpen } from "lucide-react";
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
    } catch {
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
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          {/* Header no padrão Áreas/Ambientes */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <Zap className="h-8 w-8 text-primary" />
              <div>
                <h1 className="text-3xl font-bold text-foreground">Gerenciar Circuitos do Projeto</h1>
                <p className="text-muted-foreground mt-1">Cadastre e liste seus circuitos.</p>
              </div>
            </div>
            <div className="h-1 w-24 bg-gradient-to-r from-primary to-primary-glow rounded-full" />
          </div>

          {!projetoSelecionado && (
            <Alert className="mb-6">
              <AlertDescription>Selecione um projeto na página inicial para cadastrar circuitos.</AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Form */}
            <Card className="shadow-sm border-0 bg-card/50 backdrop-blur-sm">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-xl">
                  <Server className="h-5 w-5 text-primary" />
                  Adicionar Novo Circuito
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form className="space-y-4" onSubmit={handleCreate}>
                  <div>
                    <Label htmlFor="identificador">Identificador</Label>
                    <Input
                      id="identificador"
                      value={identificador}
                      onChange={(e) => setIdentificador(e.target.value)}
                      required
                      disabled={!projetoSelecionado}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="nome">Nome do Circuito</Label>
                    <Input
                      id="nome"
                      value={nome}
                      onChange={(e) => setNome(e.target.value)}
                      required
                      disabled={!projetoSelecionado}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="tipo">Tipo</Label>
                    <select
                      id="tipo"
                      className="mt-1 w-full h-10 px-3 rounded-md border bg-background"
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
                    <Label htmlFor="ambiente_id">Ambiente</Label>
                    <select
                      id="ambiente_id"
                      className="mt-1 w-full h-10 px-3 rounded-md border bg-background"
                      value={ambienteId as any}
                      onChange={(e) => setAmbienteId(Number(e.target.value))}
                      required
                      disabled={!projetoSelecionado}
                    >
                      <option value="">Selecione um ambiente</option>
                      {ambienteOptions.map((opt) => (
                        <option key={opt.id} value={opt.id}>
                          {opt.label}
                        </option>
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

            {/* Lista */}
            <Card className="shadow-sm border-0 bg-card/50 backdrop-blur-sm">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center justify-between text-xl">
                  <span className="flex items-center gap-2">
                    <Zap className="h-5 w-5 text-primary" />
                    Circuitos Cadastrados
                  </span>
                  <Badge variant="secondary" className="text-xs">
                    {circuitos.length} {circuitos.length === 1 ? "circuito" : "circuitos"}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <p className="text-sm text-muted-foreground">Carregando…</p>
                ) : circuitos.length === 0 ? (
                  <div className="text-center py-8">
                    <Zap className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                    <p className="text-muted-foreground">Nenhum circuito cadastrado ainda.</p>
                  </div>
                ) : (
                  <ul className="space-y-3">
                    {circuitos.map((c) => (
                      <li key={c.id} className="flex items-start justify-between rounded-lg border p-3 bg-card hover:bg-accent/50 transition-colors group">
                        <div className="mr-4">
                          <div className="font-semibold">
                            {c.identificador} — {c.nome} ({c.tipo})
                          </div>
                          <div className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
                            <DoorOpen className="h-4 w-4" />
                            Ambiente: {c.ambiente?.nome}
                            {c.ambiente?.area?.nome ? <> (Área: {c.ambiente.area.nome})</> : null}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            SAK:{" "}
                            {c.tipo !== "hvac"
                              ? (c.sak ?? <span className="italic opacity-60">—</span>)
                              : <span className="opacity-60">Não aplicável</span>}
                          </div>
                        </div>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDelete(c.id)}
                          disabled={!projetoSelecionado}
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
}
