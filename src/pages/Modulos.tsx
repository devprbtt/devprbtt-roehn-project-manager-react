import { useEffect, useMemo, useState } from "react";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useProject } from "@/store/project";
import { PlusCircle, Trash2, Boxes, Server } from "lucide-react";

type MetaModulo = {
  nome_completo: string;
  canais: number;
  tipos_permitidos: string[];
};
type ModulosMeta = Record<string, MetaModulo>;

type Modulo = {
  id: number;
  nome: string;
  tipo: string;
  quantidade_canais: number;
  vinc_count?: number;
};

export default function Modulos() {
  const { projeto } = useProject();
  const projetoSelecionado = !!projeto?.id;
  const { toast } = useToast();

  const [modulos, setModulos] = useState<Modulo[]>([]);
  const [meta, setMeta] = useState<ModulosMeta>({});
  const [loading, setLoading] = useState(true);
  const [loadingMeta, setLoadingMeta] = useState(true);

  // form
  const [tipo, setTipo] = useState<string>("");
  const [nome, setNome] = useState("");

  const tipoOptions = useMemo(() => Object.keys(meta), [meta]);

  const fetchMeta = async () => {
    setLoadingMeta(true);
    try {
      const res = await fetch("/api/modulos/meta", { credentials: "same-origin" });
      const data = await res.json();
      setMeta(data?.meta || {});
    } catch {
      toast({ variant: "destructive", title: "Erro", description: "Falha ao carregar metadados de módulos." });
    } finally {
      setLoadingMeta(false);
    }
  };

  const fetchModulos = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/modulos", { credentials: "same-origin" });
      const data = await res.json();
      setModulos(data?.modulos || []);
    } catch {
      toast({ variant: "destructive", title: "Erro", description: "Falha ao carregar módulos." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchMeta(); }, []);
  useEffect(() => { if (projetoSelecionado) fetchModulos(); }, [projetoSelecionado]);

  useEffect(() => {
    if (tipo && meta[tipo]) setNome(meta[tipo].nome_completo);
    else setNome("");
  }, [tipo, meta]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!tipo || !nome.trim()) {
      toast({ variant: "destructive", title: "Erro", description: "Selecione o tipo e informe o nome." });
      return;
    }
    try {
      const res = await fetch("/api/modulos", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ tipo, nome: nome.trim() }),
      });
      let data: any = null; try { data = await res.json(); } catch {}
      if (res.ok && (data?.ok || data?.success)) {
        setTipo("");
        setNome("");
        await fetchModulos();
        toast({ title: "Sucesso!", description: "Módulo adicionado." });
      } else {
        toast({ variant: "destructive", title: "Erro", description: data?.error || data?.message || "Falha ao adicionar módulo." });
      }
    } catch {
      toast({ variant: "destructive", title: "Erro", description: "Falha ao se conectar ao servidor." });
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Tem certeza que deseja excluir este módulo? Esta ação não pode ser desfeita.")) return;
    try {
      const res = await fetch(`/api/modulos/${id}`, {
        method: "DELETE",
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });
      let data: any = null; try { data = await res.json(); } catch {}
      if (res.ok && (data?.ok || data?.success)) {
        setModulos(prev => prev.filter(m => m.id !== id));
        toast({ title: "Sucesso!", description: "Módulo excluído." });
      } else {
        toast({
          variant: "destructive",
          title: "Não foi possível excluir",
          description: data?.error || "Este módulo pode estar em uso.",
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
          {/* Header no padrão */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <Boxes className="h-8 w-8 text-primary" />
              <div>
                <h1 className="text-3xl font-bold text-foreground">Gerenciar Módulos do Projeto</h1>
                <p className="text-muted-foreground mt-1">Cadastre módulos físicos e defina seus canais.</p>
              </div>
            </div>
            <div className="h-1 w-24 bg-gradient-to-r from-primary to-primary-glow rounded-full" />
          </div>

          {!projetoSelecionado && (
            <Alert className="mb-6">
              <AlertDescription>Selecione um projeto na página inicial para cadastrar módulos.</AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Form */}
            <Card className="shadow-sm border-0 bg-card/50 backdrop-blur-sm">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-xl">
                  <Server className="h-5 w-5 text-primary" />
                  Adicionar Novo Módulo
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loadingMeta ? (
                  <p className="text-sm text-muted-foreground">Carregando metadados…</p>
                ) : (
                  <form className="space-y-4" onSubmit={handleCreate}>
                    <div>
                      <Label htmlFor="tipo">Tipo</Label>
                      <select
                        id="tipo"
                        className="mt-1 w-full h-10 px-3 rounded-md border bg-background"
                        value={tipo}
                        onChange={(e) => setTipo(e.target.value)}
                        required
                        disabled={!projetoSelecionado}
                      >
                        <option value="">Selecione o tipo</option>
                        {tipoOptions.map(t => (
                          <option key={t} value={t}>
                            {meta[t]?.nome_completo || t}
                          </option>
                        ))}
                      </select>
                      {!!tipo && meta[tipo] && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Canais: {meta[tipo].canais} • Tipos permitidos: {meta[tipo].tipos_permitidos.join(", ")}
                        </p>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="nome">Nome do Módulo</Label>
                      <Input
                        id="nome"
                        value={nome}
                        onChange={(e) => setNome(e.target.value)}
                        placeholder={tipo && meta[tipo]?.nome_completo ? meta[tipo].nome_completo : ""}
                        required
                        disabled={!projetoSelecionado}
                        className="mt-1"
                      />
                    </div>

                    <Button type="submit" className="w-full" disabled={!projetoSelecionado}>
                      <PlusCircle className="h-4 w-4 mr-2" />
                      Adicionar Módulo
                    </Button>
                  </form>
                )}
              </CardContent>
            </Card>

            {/* Lista */}
            <Card className="shadow-sm border-0 bg-card/50 backdrop-blur-sm">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center justify-between text-xl">
                  <span className="flex items-center gap-2">
                    <Boxes className="h-5 w-5 text-primary" />
                    Módulos Cadastrados
                  </span>
                  <Badge variant="secondary" className="text-xs">
                    {modulos.length} {modulos.length === 1 ? "módulo" : "módulos"}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <p className="text-sm text-muted-foreground">Carregando…</p>
                ) : modulos.length === 0 ? (
                  <div className="text-center py-8">
                    <Boxes className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                    <p className="text-muted-foreground">Nenhum módulo cadastrado.</p>
                  </div>
                ) : (
                  <ul className="space-y-3">
                    {modulos.map(m => (
                      <li key={m.id} className="flex items-center justify-between rounded-lg border p-3 bg-card hover:bg-accent/50 transition-colors group">
                        <div className="mr-4">
                          <div className="font-semibold">{m.nome} ({m.tipo})</div>
                          <div className="text-sm text-muted-foreground">Canais: {m.quantidade_canais}</div>
                          {m.vinc_count && m.vinc_count > 0 ? (
                            <div className="text-xs mt-1 px-2 py-1 rounded bg-yellow-100 text-yellow-800 w-fit">
                              Em uso ({m.vinc_count})
                            </div>
                          ) : null}
                        </div>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDelete(m.id)}
                          disabled={!!m.vinc_count && m.vinc_count > 0}
                          title={m.vinc_count && m.vinc_count > 0 ? "Exclua as vinculações antes de remover este módulo." : undefined}
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
