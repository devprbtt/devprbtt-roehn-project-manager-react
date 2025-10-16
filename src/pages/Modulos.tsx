import { useEffect, useMemo, useState } from "react";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useProject } from "@/store/project";
import { PlusCircle, Trash2, Boxes, Server, Sparkles, CircuitBoard, Pencil } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import NavigationButtons from "@/components/NavigationButtons";

type MetaModulo = {
  nome_completo: string;
  canais: number;
  tipos_permitidos: string[];
};
type ModulosMeta = Record<string, MetaModulo>;

type QuadroEletrico = {
  id: number;
  nome: string;
  ambiente: {
    nome: string;
    area: {
      nome: string;
    };
  };
};

type Modulo = {
  id: number;
  nome: string;
  tipo: string;
  hsnet?: number;
  quantidade_canais: number;
  vinc_count?: number;
  quadro_eletrico?: {
    id: number;
    nome: string;
  };
};

export default function Modulos() {
  const { projeto } = useProject();
  const [projetoSelecionado, setProjetoSelecionado] = useState<boolean | null>(projeto ? true : null);
  const isLocked = projetoSelecionado !== true;
  const { toast } = useToast();

  const [modulos, setModulos] = useState<Modulo[]>([]);
  const [quadros, setQuadros] = useState<QuadroEletrico[]>([]);
  const [meta, setMeta] = useState<ModulosMeta>({});
  const [loading, setLoading] = useState(true);
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [loadingQuadros, setLoadingQuadros] = useState(true);

  // form
  const [tipo, setTipo] = useState<string>("");
  const [nome, setNome] = useState("");
  const [quadroEletricoId, setQuadroEletricoId] = useState<number | "">("");
  
  // edit state
  const [editingModulo, setEditingModulo] = useState<Modulo | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const tipoOptions = useMemo(() => Object.keys(meta), [meta]);

  // Mantém em sincronia com o store quando ele hidratar
  useEffect(() => {
    try { if (projeto) setProjetoSelecionado(true); } catch {}
  }, [projeto]);

  // Confirma na sessão quando ainda não sabemos
  useEffect(() => {
    const checkProject = async () => {
      try {
        if (projetoSelecionado !== null) return;
        const res = await fetch("/api/projeto_atual", { credentials: "same-origin" });
        const data = await res.json();
        setProjetoSelecionado(!!(data?.ok && data?.projeto_atual));
      } catch {
        setProjetoSelecionado(false);
      }
    };
    checkProject();
  }, [projetoSelecionado]);

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

  const fetchQuadros = async () => {
    if (projetoSelecionado !== true) { setLoadingQuadros(false); return; }
    setLoadingQuadros(true);
    try {
      const res = await fetch("/api/quadros_eletricos", { credentials: "same-origin" });
      const data = await res.json();
      setQuadros(data?.quadros_eletricos || []);
    } catch {
      toast({ variant: "destructive", title: "Erro", description: "Falha ao carregar quadros elétricos." });
    } finally {
      setLoadingQuadros(false);
    }
  };

  const fetchModulos = async () => {
    if (projetoSelecionado !== true) { setLoading(false); return; }
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
  useEffect(() => { 
    if (projetoSelecionado === true) {
      fetchModulos();
      fetchQuadros();
    } else if (projetoSelecionado === false) {
      setLoading(false);
      setLoadingQuadros(false);
    }
  }, [projetoSelecionado]);

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
        body: JSON.stringify({ 
          tipo, 
          nome: nome.trim(),
          quadro_eletrico_id: quadroEletricoId || undefined 
        }),
      });
      let data: any = null; try { data = await res.json(); } catch {}
      if (res.ok && (data?.ok || data?.success)) {
        setTipo("");
        setNome("");
        setQuadroEletricoId("");
        await fetchModulos();
        toast({ title: "Sucesso!", description: "Módulo adicionado." });
      } else {
        toast({ variant: "destructive", title: "Erro", description: data?.error || data?.message || "Falha ao adicionar módulo." });
      }
    } catch {
      toast({ variant: "destructive", title: "Erro", description: "Falha ao se conectar ao servidor." });
    }
  }

  const handleEdit = (modulo: Modulo) => {
    setEditingModulo(modulo);
    setIsEditModalOpen(true);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingModulo) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/modulos/${editingModulo.id}`, {
        method: "PUT",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          nome: editingModulo.nome.trim(),
          quadro_eletrico_id: editingModulo.quadro_eletrico?.id || null,
          hsnet: editingModulo.hsnet,
        }),
      });
      const data = await res.json().catch(() => null);

      if (res.ok && (data?.ok || data?.success)) {
        setIsEditModalOpen(false);
        await fetchModulos();
        toast({
          title: "Sucesso!",
          description: "Módulo atualizado com sucesso.",
        });
      } else {
        toast({
          variant: "destructive",
          title: "Erro",
          description:
            data?.error || data?.message || "Erro ao atualizar módulo.",
        });
      }
    } catch {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Erro de conexão com o servidor.",
      });
    } finally {
      setLoading(false);
    }
  };


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
    <Layout>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 dark:from-background dark:via-background/40 dark:to-primary/25">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 mb-10">
            <div>
              <div className="flex items-center gap-4 mb-4">
                <div className="w-16 h-16 bg-gradient-to-br from-purple-600 to-violet-600 rounded-3xl flex items-center justify-center shadow-lg shadow-purple-500/25">
                  <Boxes className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h1 className="text-4xl font-bold text-foreground mb-2">Gerenciar Módulos</h1>
                  <p className="text-lg text-muted-foreground max-w-2xl">
                    Cadastre os módulos de automação e associe a quadros elétricos.
                  </p>
                </div>
              </div>
              <div className="h-1 w-32 bg-gradient-to-r from-purple-600 to-violet-600 rounded-full shadow-sm" />
            </div>
          </div>

          {projetoSelecionado === false && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
              <Alert className="bg-amber-50 border-amber-200 shadow-sm">
                <Sparkles className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-amber-800">
                  Selecione um projeto na página inicial para cadastrar módulos.
                </AlertDescription>
              </Alert>
            </motion.div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}>
              <Card className="bg-card/95 backdrop-blur-sm border border-border shadow-xl shadow-primary/10 dark:bg-card/85 dark:shadow-primary/20">
                <CardHeader className="pb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center shadow-lg">
                      <PlusCircle className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-2xl font-bold text-foreground">Adicionar Novo Módulo</CardTitle>
                      <p className="text-muted-foreground mt-1">Preencha as informações do módulo físico</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {loadingMeta ? (
                    <div className="flex items-center justify-center py-8 text-muted-foreground">
                      <div className="animate-spin rounded-full h-8 w-8 border-4 border-purple-500 border-t-transparent mr-4"></div>
                      Carregando metadados...
                    </div>
                  ) : (
                    <form className="space-y-6" onSubmit={handleCreate}>
                      <div>
                        <Label htmlFor="tipo" className="text-sm font-semibold text-slate-700">Tipo *</Label>
                        <select
                          id="tipo"
                          className="mt-2 h-12 w-full px-4 rounded-xl border border-border bg-background focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all"
                          value={tipo}
                          onChange={(e) => setTipo(e.target.value)}
                          required
                          disabled={isLocked}
                        >
                          <option value="">Selecione o tipo</option>
                          {tipoOptions.map(t => (
                            <option key={t} value={t}>
                              {meta[t]?.nome_completo || t}
                            </option>
                          ))}
                        </select>
                        {!!tipo && meta[tipo] && (
                          <p className="text-xs text-muted-foreground/90 mt-1">
                            Canais: {meta[tipo].canais} • Tipos permitidos: {meta[tipo].tipos_permitidos.join(", ")}
                          </p>
                        )}
                      </div>

                      <div>
                        <Label htmlFor="nome" className="text-sm font-semibold text-slate-700">Nome do Módulo *</Label>
                        <Input
                          id="nome"
                          value={nome}
                          onChange={(e) => setNome(e.target.value)}
                          placeholder={tipo && meta[tipo]?.nome_completo ? meta[tipo].nome_completo : ""}
                          required
                          disabled={isLocked}
                          className="mt-2 h-12 px-4 rounded-xl border-border focus:border-purple-500 focus:ring-purple-500/20"
                        />
                      </div>

                      <div>
                        <Label htmlFor="quadroEletrico" className="text-sm font-semibold text-slate-700">Quadro Elétrico (Opcional)</Label>
                        <select
                          id="quadroEletrico"
                          className="mt-2 h-12 w-full px-4 rounded-xl border border-border bg-background focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all"
                          value={quadroEletricoId}
                          onChange={(e) => setQuadroEletricoId(Number(e.target.value))}
                          disabled={isLocked || loadingQuadros}
                        >
                          <option value="">Selecione um quadro elétrico (opcional)</option>
                          {quadros.map(quadro => (
                            <option key={quadro.id} value={quadro.id}>
                              {quadro.nome} ({quadro.ambiente.nome} - {quadro.ambiente.area.nome})
                            </option>
                          ))}
                        </select>
                        {loadingQuadros && (
                          <p className="text-xs text-muted-foreground/90 mt-1">Carregando quadros...</p>
                        )}
                      </div>

                      <Button type="submit" className="w-full h-12 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-purple-700 hover:to-violet-700 text-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center gap-2" disabled={isLocked}>
                        <PlusCircle className="h-5 w-5" />
                        Adicionar Módulo
                      </Button>
                    </form>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}>
              <Card className="bg-card/95 backdrop-blur-sm border border-border shadow-xl shadow-primary/10 dark:bg-card/85 dark:shadow-primary/20">
                <CardHeader className="pb-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-gradient-to-br from-purple-600 to-violet-600 rounded-2xl flex items-center justify-center shadow-lg">
                        <Boxes className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <CardTitle className="text-2xl font-bold text-foreground">Módulos Cadastrados</CardTitle>
                        <p className="text-muted-foreground mt-1">Lista de todos os módulos do projeto</p>
                      </div>
                    </div>
                    <Badge className="bg-gradient-to-r from-purple-500 to-violet-500 text-white text-sm font-medium px-3 py-1">
                      {modulos.length} {modulos.length === 1 ? "módulo" : "módulos"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="flex flex-col justify-center items-center py-12">
                      <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-500 border-t-transparent mb-4"></div>
                      <p className="text-muted-foreground font-medium">Carregando módulos...</p>
                    </div>
                  ) : modulos.length === 0 ? (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-center py-12"
                    >
                      <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mx-auto mb-6">
                        <Boxes className="h-10 w-10 text-muted-foreground/80" />
                      </div>
                      <h4 className="text-xl font-semibold text-foreground mb-2">
                        {projetoSelecionado === true ? "Nenhum módulo cadastrado" : "Selecione um projeto"}
                      </h4>
                      <p className="text-muted-foreground max-w-sm mx-auto">
                        {projetoSelecionado === true
                          ? "Comece adicionando seu primeiro módulo usando o formulário ao lado."
                          : "Selecione um projeto para visualizar e gerenciar os módulos."}
                      </p>
                    </motion.div>
                  ) : (
                    <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                      <AnimatePresence>
                        {modulos.map((m, index) => (
                          <motion.li
                            key={m.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            transition={{ delay: index * 0.05 }}
                            className="group relative overflow-hidden rounded-2xl border border-border bg-card/85 backdrop-blur-sm p-4 hover:bg-card/90 hover:shadow-lg hover:shadow-slate-900/5 transition-all duration-300 flex items-center justify-between"
                          >
                            <div className="flex-1 mr-4">
                              <div className="flex items-center gap-3 mb-2">
                                <span className="text-sm font-mono text-muted-foreground/90 bg-muted px-2 py-1 rounded-lg">
                                  {m.tipo}
                                </span>
                                {m.quadro_eletrico && (
                                  <Badge variant="secondary" className="bg-blue-100 text-blue-700 flex items-center gap-1">
                                    <CircuitBoard className="h-3 w-3" />
                                    {m.quadro_eletrico.nome}
                                  </Badge>
                                )}
                              </div>
                              <h4 className="font-bold text-foreground text-lg mb-1">{m.nome}</h4>
                              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                                <Server className="h-4 w-4 text-muted-foreground/80" />
                                <span className="font-medium">Canais: {m.quantidade_canais}</span>
                              </div>
                              {m.vinc_count && m.vinc_count > 0 && (
                                <Badge className="bg-yellow-100 text-yellow-800 text-xs font-medium px-2 py-1 mt-1 w-fit">
                                  Em uso ({m.vinc_count} vinculações)
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleEdit(m)}
                                  className="h-8 w-8 hover:bg-blue-100"
                                >
                                  <Pencil className="h-4 w-4 text-blue-600" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleDelete(m.id)}
                                  disabled={!!m.vinc_count && m.vinc_count > 0}
                                  className="h-8 w-8 hover:bg-red-100"
                                  title={m.vinc_count && m.vinc_count > 0 ? "Exclua as vinculações antes de remover este módulo." : undefined}
                                >
                                  <Trash2 className="h-4 w-4 text-red-600" />
                                </Button>
                              </div>
                          </motion.li>
                        ))}
                      </AnimatePresence>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </div>

          <NavigationButtons previousPath="/circuitos" nextPath="/vinculacao" />

          {editingModulo && (
            <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Editar Módulo</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleUpdate} className="space-y-4">
                  <div>
                    <Label htmlFor="edit-nome">Nome do Módulo</Label>
                    <Input
                      id="edit-nome"
                      value={editingModulo.nome}
                      onChange={(e) =>
                        setEditingModulo({ ...editingModulo, nome: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-hsnet">HSNET</Label>
                    <Input
                      id="edit-hsnet"
                      type="number"
                      value={editingModulo.hsnet || ""}
                      onChange={(e) =>
                        setEditingModulo({ ...editingModulo, hsnet: Number(e.target.value) })
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-quadro">Quadro Elétrico</Label>
                    <select
                      id="edit-quadro"
                      value={editingModulo.quadro_eletrico?.id || ""}
                      onChange={(e) => {
                        const newQuadroId = Number(e.target.value);
                        const newQuadro = quadros.find(
                          (q) => q.id === newQuadroId
                        );
                        setEditingModulo({
                          ...editingModulo,
                          quadro_eletrico: newQuadro ? { id: newQuadro.id, nome: newQuadro.nome } : undefined,
                        });
                      }}
                      className="w-full h-10 px-3 rounded-md border border-input bg-background"
                    >
                      <option value="">Nenhum</option>
                      {quadros.map((quadro) => (
                        <option key={quadro.id} value={quadro.id}>
                          {quadro.nome} ({quadro.ambiente.nome})
                        </option>
                      ))}
                    </select>
                  </div>
                  <DialogFooter>
                    <DialogClose asChild>
                      <Button type="button" variant="secondary">
                        Cancelar
                      </Button>
                    </DialogClose>
                    <Button type="submit" disabled={loading}>
                      Salvar Alterações
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>
    </Layout>
  );
}
