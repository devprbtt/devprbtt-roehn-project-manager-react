import { useEffect, useMemo, useState } from "react";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { useProject } from "@/store/project";
import { Link } from "react-router-dom";
import { Link2, Trash2, Plug } from "lucide-react";
import { Badge } from "@/components/ui/badge";

type Circuito = {
  id: number;
  identificador: string;
  nome: string;
  tipo: "luz" | "persiana" | "hvac";
  area_nome?: string;
  ambiente_nome?: string;
};
type Modulo = {
  id: number;
  nome: string;
  tipo: string;
  canais_disponiveis: number[];
  quantidade_canais?: number;
};
type Vinculacao = {
  id: number;
  circuito_id: number;
  identificador: string;
  circuito_nome: string;
  area_nome: string;
  ambiente_nome: string;
  modulo_nome: string;
  modulo_tipo: string;
  canal: number;
};
type OptionsPayload = {
  compat: Record<"luz" | "persiana" | "hvac", string[]>;
  circuitos: Circuito[];
  modulos: Modulo[];
};

export default function Vinculacao() {
  const { projeto } = useProject();
  const projetoSelecionado = !!projeto?.id;
  const { toast } = useToast();

  const [options, setOptions] = useState<OptionsPayload>({ compat: { luz: [], persiana: [], hvac: [] }, circuitos: [], modulos: [] });
  const [vinculacoes, setVinculacoes] = useState<Vinculacao[]>([]);
  const [loading, setLoading] = useState(true);

  // form
  const [circuitoId, setCircuitoId] = useState<number | "">("");
  const [moduloId, setModuloId] = useState<number | "">("");
  const [canal, setCanal] = useState<number | "">("");

  const circuitoSelecionado = useMemo(() => options.circuitos.find(c => c.id === circuitoId), [circuitoId, options.circuitos]);
  const modulosFiltrados = useMemo(() => {
    if (!circuitoSelecionado) return options.modulos;
    const compatList = options.compat[circuitoSelecionado.tipo] || [];
    return options.modulos.filter(m => compatList.includes(m.tipo));
  }, [circuitoSelecionado, options.modulos, options.compat]);
  const canaisDisponiveis = useMemo(() => {
    if (!moduloId) return [];
    const m = options.modulos.find(mm => mm.id === moduloId);
    return m?.canais_disponiveis ?? [];
  }, [moduloId, options.modulos]);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [optRes, listRes] = await Promise.all([
        fetch("/api/vinculacao/options", { credentials: "same-origin" }),
        fetch("/api/vinculacoes", { credentials: "same-origin" }),
      ]);
      const opt = await optRes.json();
      const lst = await listRes.json();
      setOptions({ compat: opt?.compat || { luz: [], persiana: [], hvac: [] }, circuitos: opt?.circuitos || [], modulos: opt?.modulos || [] });
      setVinculacoes(lst?.vinculacoes || []);
    } catch {
      toast({ variant: "destructive", title: "Erro", description: "Falha ao carregar dados de vinculação." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (projetoSelecionado) fetchAll(); }, [projetoSelecionado]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!circuitoId || !moduloId || !canal) {
      toast({ variant: "destructive", title: "Erro", description: "Preencha circuito, módulo e canal." });
      return;
    }
    try {
      const res = await fetch("/api/vinculacoes", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ circuito_id: circuitoId, modulo_id: moduloId, canal }),
      });
      let data: any = null; try { data = await res.json(); } catch {}
      if (res.ok && (data?.ok || data?.success)) {
        setCircuitoId(""); setModuloId(""); setCanal("");
        await fetchAll();
        toast({ title: "Sucesso!", description: "Vinculação criada." });
      } else {
        toast({ variant: "destructive", title: "Erro", description: data?.error || data?.message || "Falha ao criar vinculação." });
      }
    } catch {
      toast({ variant: "destructive", title: "Erro", description: "Falha ao se conectar com o servidor." });
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Tem certeza que deseja excluir esta vinculação?")) return;
    try {
      const res = await fetch(`/api/vinculacoes/${id}`, {
        method: "DELETE",
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });
      let data: any = null; try { data = await res.json(); } catch {}
      if (res.ok && (data?.ok || data?.success)) {
        setVinculacoes(prev => prev.filter(v => v.id !== id));
        const optRes = await fetch("/api/vinculacao/options", { credentials: "same-origin" });
        const opt = await optRes.json();
        setOptions({ compat: opt?.compat || { luz: [], persiana: [], hvac: [] }, circuitos: opt?.circuitos || [], modulos: opt?.modulos || [] });
        toast({ title: "Sucesso!", description: "Vinculação excluída." });
      } else {
        toast({ variant: "destructive", title: "Erro", description: data?.error || data?.message || "Falha ao excluir vinculação." });
      }
    } catch {
      toast({ variant: "destructive", title: "Erro", description: "Falha ao se conectar com o servidor." });
    }
  }

  return (
    <Layout projectSelected={projetoSelecionado}>
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          {/* Header no padrão */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <Plug className="h-8 w-8 text-primary" />
              <div>
                <h1 className="text-3xl font-bold text-foreground">Vincular Circuitos a Módulos</h1>
                <p className="text-muted-foreground mt-1">Associe seus circuitos a módulos e canais disponíveis.</p>
              </div>
            </div>
            <div className="h-1 w-24 bg-gradient-to-r from-primary to-primary-glow rounded-full" />
          </div>

          {!projetoSelecionado && (
            <Alert className="mb-6">
              <AlertDescription>
                Nenhum projeto selecionado. <Link to="/" className="underline">Volte à página inicial</Link> para selecionar ou criar um projeto.
              </AlertDescription>
            </Alert>
          )}

          {/* Form */}
          <Card className="border-0 shadow-sm rounded-3xl bg-card/50 backdrop-blur-sm mb-6">
            <CardHeader className="border-0 pb-4">
              <CardTitle className="flex items-center gap-2 text-xl">
                <Link2 className="h-5 w-5 text-primary" />
                Vincular Circuito
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form className="grid md:grid-cols-5 gap-3 items-end" onSubmit={handleSubmit}>
                <div className="md:col-span-2">
                  <Label htmlFor="circuito_id">Circuito</Label>
                  <select
                    id="circuito_id"
                    className="mt-1 w-full h-10 px-3 rounded-md border bg-background"
                    value={circuitoId as any}
                    onChange={(e) => { setCircuitoId(Number(e.target.value)); setModuloId(""); setCanal(""); }}
                    disabled={!projetoSelecionado || loading}
                    required
                  >
                    <option value="">Selecione um circuito</option>
                    {options.circuitos.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.identificador} - {c.nome}
                        {c.area_nome ? ` (Área: ${c.area_nome}` : ""}{c.ambiente_nome ? `, Ambiente: ${c.ambiente_nome}` : ""}{c.area_nome ? ")" : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-2">
                  <Label htmlFor="modulo_id">Módulo</Label>
                  <select
                    id="modulo_id"
                    className="mt-1 w-full h-10 px-3 rounded-md border bg-background"
                    value={moduloId as any}
                    onChange={(e) => { setModuloId(Number(e.target.value)); setCanal(""); }}
                    disabled={!projetoSelecionado || !circuitoSelecionado || loading}
                    required
                  >
                    <option value="">Selecione um módulo</option>
                    {modulosFiltrados.map(m => (
                      <option key={m.id} value={m.id}>
                        {m.nome} ({m.tipo})
                      </option>
                    ))}
                  </select>
                  {!!circuitoSelecionado && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Compatível com {circuitoSelecionado.tipo}: {(options.compat[circuitoSelecionado.tipo] || []).join(", ") || "—"}
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="canal">Canal</Label>
                  <select
                    id="canal"
                    className="mt-1 w-full h-10 px-3 rounded-md border bg-background"
                    value={canal as any}
                    onChange={(e) => setCanal(Number(e.target.value))}
                    disabled={!projetoSelecionado || !moduloId || loading}
                    required
                  >
                    <option value="">Selecione</option>
                    {canaisDisponiveis.map(ch => (
                      <option key={ch} value={ch}>Canal {ch}</option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-5">
                  <Button type="submit" className="w-full md:w-auto" disabled={!projetoSelecionado || loading}>
                    <Link2 className="h-4 w-4 mr-2" />
                    Vincular
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Lista */}
          <Card className="border-0 shadow-sm rounded-3xl bg-card/50 backdrop-blur-sm">
            <CardHeader className="border-0 pb-4">
              <CardTitle className="flex items-center justify-between text-xl">
                <span className="flex items-center gap-2">
                  <Plug className="h-5 w-5 text-primary" />
                  Vinculações Existentes
                </span>
                <Badge variant="secondary" className="text-xs">
                  {vinculacoes.length} {vinculacoes.length === 1 ? "vinculação" : "vinculações"}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-sm text-muted-foreground">Carregando…</p>
              ) : vinculacoes.length === 0 ? (
                <p className="text-muted-foreground text-center py-6">Nenhuma vinculação cadastrada ainda.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left border-b bg-muted/40">
                        <th className="py-2 px-3">Circuito</th>
                        <th className="py-2 px-3">Área</th>
                        <th className="py-2 px-3">Ambiente</th>
                        <th className="py-2 px-3">Módulo</th>
                        <th className="py-2 px-3">Canal</th>
                        <th className="py-2 px-3 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {vinculacoes.map(v => (
                        <tr key={v.id} className="border-b">
                          <td className="py-2 px-3"><strong>{v.identificador}</strong> — {v.circuito_nome}</td>
                          <td className="py-2 px-3">{v.area_nome}</td>
                          <td className="py-2 px-3">{v.ambiente_nome}</td>
                          <td className="py-2 px-3">{v.modulo_nome} ({v.modulo_tipo})</td>
                          <td className="py-2 px-3">{v.canal}</td>
                          <td className="py-2 px-3 text-right">
                            <Button variant="destructive" size="sm" onClick={() => handleDelete(v.id)}>
                              <Trash2 className="h-4 w-4 mr-1" />
                              Excluir
                            </Button>
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
