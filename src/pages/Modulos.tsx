import { useEffect, useMemo, useState } from "react";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { useProject } from "@/store/project";
import { PlusCircle, Trash2, Server } from "lucide-react";

type MetaModulo = {
  nome_completo: string;
  canais: number;
  tipos_permitidos: string[]; // usado depois na Vinculação
};
type ModulosMeta = Record<string, MetaModulo>;

type Modulo = {
  id: number;
  nome: string;
  tipo: string;
  quantidade_canais: number;
  vinc_count?: number; // <<--- novo
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

  // carrega metadados
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

  useEffect(() => {
    fetchMeta();
  }, []);

  useEffect(() => {
    if (projetoSelecionado) fetchModulos();
  }, [projetoSelecionado]);

  // auto-preenche nome com nome_completo ao escolher tipo
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
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Server className="h-5 w-5" /> Gerenciar Módulos
          </h2>
          <p className="text-sm text-muted-foreground">Cadastre módulos físicos do projeto e a respectiva quantidade de canais.</p>
        </div>

        {!projetoSelecionado && (
          <Alert className="mb-6">
            <AlertDescription>Selecione um projeto na página inicial para cadastrar módulos.</AlertDescription>
          </Alert>
        )}

        <div className="grid md:grid-cols-2 gap-4">
          <Card className="border-0 shadow-sm rounded-3xl">
            <CardHeader className="border-0">Adicionar Novo Módulo</CardHeader>
            <CardContent>
              {loadingMeta ? (
                <p className="text-sm text-muted-foreground">Carregando metadados…</p>
              ) : (
                <form className="space-y-3" onSubmit={handleCreate}>
                  <div>
                    <Label htmlFor="tipo" className="text-muted-foreground">Tipo</Label>
                    <select
                      id="tipo"
                      className="w-full h-10 px-3 rounded-md border bg-background"
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
                    <Label htmlFor="nome" className="text-muted-foreground">Nome do Módulo</Label>
                    <Input
                      id="nome"
                      value={nome}
                      onChange={(e) => setNome(e.target.value)}
                      placeholder={tipo && meta[tipo]?.nome_completo ? meta[tipo].nome_completo : ""}
                      required
                      disabled={!projetoSelecionado}
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

          <Card className="border-0 shadow-sm rounded-3xl">
            <CardHeader className="border-0">Módulos Cadastrados</CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-sm text-muted-foreground">Carregando…</p>
              ) : modulos.length === 0 ? (
                <p className="text-muted-foreground text-center py-6">Nenhum módulo cadastrado.</p>
              ) : (
                <ul className="space-y-2">
                  {modulos.map(m => (
                    <li key={m.id} className="flex items-center justify-between rounded-lg border p-3">
                      <div className="mr-4">
                        <div className="font-semibold">{m.nome} ({m.tipo})</div>
                        <div className="text-sm text-muted-foreground">Canais: {m.quantidade_canais}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        {m.vinc_count && m.vinc_count > 0 ? (
                          <span className="text-xs px-2 py-1 rounded bg-yellow-100 text-yellow-800">
                            Em uso ({m.vinc_count})
                          </span>
                        ) : null}
                        <Button
                          variant="outline"
                          className={`text-red-600 border-red-600 hover:bg-red-50 ${m.vinc_count && m.vinc_count > 0 ? "pointer-events-none opacity-50" : ""}`}
                          onClick={() => handleDelete(m.id)}
                          disabled={!!m.vinc_count && m.vinc_count > 0}
                          title={m.vinc_count && m.vinc_count > 0 ? "Exclua as vinculações antes de remover este módulo." : undefined}
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
