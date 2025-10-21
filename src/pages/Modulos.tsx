import { useEffect, useMemo, useState, useRef } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useProject } from "@/store/project";
import { PlusCircle, Trash2, Boxes, Server, Sparkles, CircuitBoard, Pencil, Link2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import NavigationButtons from "@/components/NavigationButtons";
import { Modulo } from "@/types/project";

const CONTROLLER_TYPES = ["AQL-GV-M4", "ADP-M8", "ADP-M16"];

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
    id: number;
    nome: string;
    area: {
      nome: string;
    };
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

  // form state for regular modules
  const [tipo, setTipo] = useState<string>("");
  const [nome, setNome] = useState("");
  const [parentControllerId, setParentControllerId] = useState<number | "">("");
  const [quadroEletricoId, setQuadroEletricoId] = useState<number | "">("");
  const lastParentControllerId = useRef<number | "">("");

  // form state for controllers
  const [controllerType, setControllerType] = useState<string>("");
  const [controllerName, setControllerName] = useState("");
  const [controllerIp, setControllerIp] = useState("");
  const [controllerQuadroId, setControllerQuadroId] = useState<number | "">("");
  const [isLogicServer, setIsLogicServer] = useState(false);
  
  // edit state
  const [editingModulo, setEditingModulo] = useState<Modulo | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const tipoOptions = useMemo(() => Object.keys(meta).filter(t => !CONTROLLER_TYPES.includes(t)), [meta]);
  const controllerOptions = useMemo(() => modulos.filter(m => m.is_controller), [modulos]);

  useEffect(() => {
    try { if (projeto) setProjetoSelecionado(true); } catch {}
  }, [projeto]);

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

  useEffect(() => {
    const hasControllers = modulos.some(m => m.is_controller);
    setIsLogicServer(!hasControllers);
  }, [modulos]);

  useEffect(() => {
    if (lastParentControllerId.current) {
      setParentControllerId(lastParentControllerId.current);
    }
  }, [tipo]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!tipo || !nome.trim() || !parentControllerId || !quadroEletricoId) {
      toast({ variant: "destructive", title: "Erro", description: "Todos os campos para o módulo são obrigatórios." });
      return;
    }
    lastParentControllerId.current = parentControllerId;
    try {
      const res = await fetch("/api/modulos", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          tipo,
          nome: nome.trim(),
          parent_controller_id: parentControllerId,
          quadro_eletrico_id: quadroEletricoId,
        }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && (data?.ok || data?.success)) {
        setTipo("");
        setNome("");
        setParentControllerId("");
        setQuadroEletricoId("");
        await fetchModulos();
        toast({ title: "Sucesso!", description: "Módulo adicionado." });
      } else {
        toast({ variant: "destructive", title: "Erro", description: data?.error || "Falha ao adicionar módulo." });
      }
    } catch {
      toast({ variant: "destructive", title: "Erro", description: "Falha ao se conectar ao servidor." });
    }
  }

  async function handleCreateController(e: React.FormEvent) {
    e.preventDefault();
    if (!controllerType || !controllerName.trim() || !controllerIp.trim() || !controllerQuadroId) {
      toast({ variant: "destructive", title: "Erro", description: "Todos os campos para o controlador são obrigatórios." });
      return;
    }
    const ipRegex = /^((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    if (!ipRegex.test(controllerIp.trim())) {
        toast({ variant: "destructive", title: "Erro", description: "O formato do endereço IP é inválido." });
        return;
    }
    try {
      const res = await fetch("/api/modulos", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          tipo: controllerType,
          nome: controllerName.trim(),
          ip_address: controllerIp.trim(),
          quadro_eletrico_id: controllerQuadroId,
          is_controller: true,
          is_logic_server: isLogicServer,
        }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && (data?.ok || data?.success)) {
        setControllerType("");
        setControllerName("");
        setControllerIp("");
        setControllerQuadroId("");
        await fetchModulos();
        toast({ title: "Sucesso!", description: "Controlador adicionado." });
      } else {
        toast({ variant: "destructive", title: "Erro", description: data?.error || "Falha ao adicionar controlador." });
      }
    } catch {
      toast({ variant: "destructive", title: "Erro", description: "Falha ao se conectar ao servidor." });
    }
  }

  const handleEdit = (modulo: Modulo) => {
    setEditingModulo({ ...modulo });
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
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          nome: editingModulo.nome.trim(),
          quadro_eletrico_id: editingModulo.quadro_eletrico?.id || null,
          parent_controller_id: editingModulo.parent_controller_id,
          ip_address: CONTROLLER_TYPES.includes(editingModulo.tipo) ? editingModulo.ip_address : undefined,
          is_logic_server: CONTROLLER_TYPES.includes(editingModulo.tipo) ? editingModulo.is_logic_server : undefined,
        }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && (data?.ok || data?.success)) {
        setIsEditModalOpen(false);
        await fetchModulos();
        toast({ title: "Sucesso!", description: "Módulo atualizado." });
      } else {
        toast({ variant: "destructive", title: "Erro", description: data?.error || "Erro ao atualizar módulo." });
      }
    } catch {
      toast({ variant: "destructive", title: "Erro", description: "Erro de conexão com o servidor." });
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
      const data = await res.json().catch(() => null);
      if (res.ok && (data?.ok || data?.success)) {
        await fetchModulos();
        toast({ title: "Sucesso!", description: "Módulo excluído." });
      } else {
        toast({ variant: "destructive", title: "Erro", description: data?.error || "Não foi possível excluir." });
      }
    } catch {
      toast({ variant: "destructive", title: "Erro", description: "Falha ao se conectar ao servidor." });
    }
  }

  const sortedModulos = useMemo(() => {
    return [...modulos].sort((a, b) => {
      if (a.is_controller && !b.is_controller) return -1;
      if (!a.is_controller && b.is_controller) return 1;
      if (a.is_logic_server && !b.is_logic_server) return -1;
      if (!a.is_logic_server && b.is_logic_server) return 1;
      return a.nome.localeCompare(b.nome);
    });
  }, [modulos]);

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
                  <p className="text-lg text-muted-foreground max-w-2xl">Cadastre os módulos de automação e vincule-os aos seus controladores.</p>
                </div>
              </div>
              <div className="h-1 w-32 bg-gradient-to-r from-purple-600 to-violet-600 rounded-full shadow-sm" />
            </div>
          </div>

          {projetoSelecionado === false && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
              <Alert className="bg-amber-50 border-amber-200 shadow-sm">
                <Sparkles className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-amber-800">Selecione um projeto para gerenciar módulos.</AlertDescription>
              </Alert>
            </motion.div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}>
              <Card className="bg-card/95 backdrop-blur-sm border border-border shadow-xl shadow-primary/10 dark:bg-card/85 dark:shadow-primary/20">
                <CardHeader className="pb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-orange-600 rounded-2xl flex items-center justify-center shadow-lg"><CircuitBoard className="w-6 h-6 text-white" /></div>
                    <div>
                      <CardTitle className="text-2xl font-bold text-foreground">Adicionar Controlador</CardTitle>
                      <p className="text-muted-foreground mt-1">Controladores gerenciam outros módulos.</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                    <form className="space-y-6" onSubmit={handleCreateController}>
                      <div>
                        <Label htmlFor="controller-type">Tipo *</Label>
                        <select id="controller-type" className="mt-2 h-12 w-full px-4 rounded-xl border border-border bg-background" value={controllerType} onChange={(e) => { setControllerType(e.target.value); setControllerName(e.target.value); }} required>
                          <option value="">Selecione o tipo</option>
                          {CONTROLLER_TYPES.map(ct => <option key={ct} value={ct}>{ct}</option>)}
                        </select>
                      </div>
                      <div>
                        <Label htmlFor="controller-name-new">Nome do Controlador *</Label>
                        <Input id="controller-name-new" value={controllerName} onChange={(e) => setControllerName(e.target.value)} required className="mt-2 h-12 px-4 rounded-xl border-border" />
                      </div>
                       <div>
                        <Label htmlFor="controller-quadro">Quadro Elétrico *</Label>
                        <select id="controller-quadro" className="mt-2 h-12 w-full px-4 rounded-xl border border-border bg-background" value={controllerQuadroId} onChange={(e) => setControllerQuadroId(Number(e.target.value))} required>
                          <option value="">Selecione um quadro</option>
                          {quadros.map((quadro) => <option key={quadro.id} value={quadro.id}>{quadro.nome} ({quadro.ambiente.nome})</option>)}
                        </select>
                      </div>
                      <div>
                        <Label htmlFor="controller-ip-new">Endereço IP *</Label>
                        <Input id="controller-ip-new" value={controllerIp} onChange={(e) => setControllerIp(e.target.value)} required className="mt-2 h-12 px-4 rounded-xl border-border" pattern="((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)" title="Por favor, insira um endereço IP válido." />
                      </div>
                      <div className="flex items-center space-x-2 pt-2">
                        <Checkbox id="is-logic-server" checked={isLogicServer} onCheckedChange={(checked) => setIsLogicServer(!!checked)} disabled={!modulos.some(m => m.is_controller)} />
                        <Label htmlFor="is-logic-server" className="font-medium">Definir como Logic Server</Label>
                      </div>
                      <Button type="submit" className="w-full h-12">Adicionar Controlador</Button>
                    </form>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}>
              <Card className="bg-card/95 backdrop-blur-sm border border-border shadow-xl shadow-primary/10 dark:bg-card/85 dark:shadow-primary/20">
                <CardHeader className="pb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center shadow-lg"><PlusCircle className="w-6 h-6 text-white" /></div>
                    <div>
                      <CardTitle className="text-2xl font-bold text-foreground">Adicionar Módulo</CardTitle>
                      <p className="text-muted-foreground mt-1">Módulos de canais para circuitos.</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {loadingMeta ? <div className="text-center p-8">Carregando...</div> : (
                    <form className="space-y-6" onSubmit={handleCreate}>
                      <div>
                        <Label htmlFor="parentController">Controlador Vinculado *</Label>
                        <select id="parentController" className="mt-2 h-12 w-full px-4 rounded-xl border border-border bg-background" value={parentControllerId} onChange={(e) => setParentControllerId(Number(e.target.value))} required disabled={isLocked || controllerOptions.length === 0}>
                          <option value="">{controllerOptions.length === 0 ? "Adicione um controlador primeiro" : "Selecione o controlador"}</option>
                          {controllerOptions.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                        </select>
                      </div>
                      <div>
                        <Label htmlFor="module-quadro">Quadro Elétrico *</Label>
                        <select id="module-quadro" className="mt-2 h-12 w-full px-4 rounded-xl border border-border bg-background" value={quadroEletricoId} onChange={(e) => setQuadroEletricoId(Number(e.target.value))} required>
                          <option value="">Selecione um quadro</option>
                          {quadros.map((quadro) => <option key={quadro.id} value={quadro.id}>{quadro.nome} ({quadro.ambiente.nome})</option>)}
                        </select>
                      </div>
                      <div>
                        <Label htmlFor="tipo">Tipo *</Label>
                        <select id="tipo" className="mt-2 h-12 w-full px-4 rounded-xl border border-border bg-background" value={tipo} onChange={(e) => setTipo(e.target.value)} required disabled={isLocked}>
                          <option value="">Selecione o tipo</option>
                          {tipoOptions.map(t => <option key={t} value={t}>{meta[t]?.nome_completo || t}</option>)}
                        </select>
                      </div>
                      <div>
                        <Label htmlFor="nome">Nome do Módulo *</Label>
                        <Input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} placeholder={tipo && meta[tipo]?.nome_completo ? meta[tipo].nome_completo : ""} required disabled={isLocked} className="mt-2 h-12 px-4 rounded-xl border-border" />
                      </div>
                      <Button type="submit" className="w-full h-12" disabled={isLocked || controllerOptions.length === 0}>Adicionar Módulo</Button>
                    </form>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            <div className="lg:col-span-2">
              <Card className="bg-card/95 backdrop-blur-sm border border-border shadow-xl shadow-primary/10 dark:bg-card/85 dark:shadow-primary/20">
                <CardHeader className="pb-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-gradient-to-br from-purple-600 to-violet-600 rounded-2xl flex items-center justify-center shadow-lg"><Boxes className="w-6 h-6 text-white" /></div>
                      <div>
                        <CardTitle className="text-2xl font-bold text-foreground">Módulos Cadastrados</CardTitle>
                        <p className="text-muted-foreground mt-1">Lista de todos os módulos do projeto</p>
                      </div>
                    </div>
                    <Badge className="bg-gradient-to-r from-purple-500 to-violet-500 text-white text-sm font-medium px-3 py-1">{modulos.length} {modulos.length === 1 ? "módulo" : "módulos"}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  {loading ? <div className="text-center p-8">Carregando módulos...</div> : modulos.length === 0 ? (
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center py-12">
                      <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mx-auto mb-6"><Boxes className="h-10 w-10 text-muted-foreground/80" /></div>
                      <h4 className="text-xl font-semibold text-foreground mb-2">{projetoSelecionado === true ? "Nenhum módulo cadastrado" : "Selecione um projeto"}</h4>
                      <p className="text-muted-foreground max-w-sm mx-auto">{projetoSelecionado === true ? "Comece adicionando seu primeiro controlador." : "Selecione um projeto para gerenciar os módulos."}</p>
                    </motion.div>
                  ) : (
                    <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
                      <AnimatePresence>
                        {sortedModulos.map((m, index) => (
                          <motion.li
                            key={m.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            transition={{ delay: index * 0.05 }}
                            className={`group relative overflow-hidden rounded-2xl border bg-card/85 backdrop-blur-sm p-4 hover:bg-card/90 hover:shadow-lg hover:shadow-slate-900/5 transition-all duration-300 flex items-center justify-between ${
                              m.is_logic_server 
                                ? 'border-green-300 dark:border-green-700' 
                                : m.is_controller 
                                  ? 'border-purple-300 dark:border-purple-700' 
                                  : 'border-border'
                            }`}
                          >
                            <div className="flex-1 mr-4">
                               <div className="flex items-center gap-2 flex-wrap mb-2">
                                <span className="text-sm font-mono text-muted-foreground/90 bg-muted px-2 py-1 rounded-lg">{m.tipo}</span>
                                {m.is_logic_server && <Badge className="bg-green-100 text-green-800 border border-green-200 hover:bg-green-200"><Server className="h-3 w-3 mr-1.5" />Logic Server</Badge>}
                                {m.is_controller && !m.is_logic_server && <Badge variant="outline">Controlador</Badge>}
                                {m.quadro_eletrico && <Badge variant="secondary" className="bg-blue-100 text-blue-700 flex items-center gap-1"><CircuitBoard className="h-3 w-3" />{m.quadro_eletrico.nome}</Badge>}
                                {m.parent_controller && <Badge variant="secondary" className="bg-gray-100 text-gray-700 flex items-center gap-1"><Link2 className="h-3 w-3" />{m.parent_controller.nome}</Badge>}
                              </div>
                              <h4 className="font-bold text-foreground text-lg mb-1">{m.nome}</h4>
                              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                                <Server className="h-4 w-4 text-muted-foreground/80" />
                                <span className="font-medium">{m.is_controller ? `IP: ${m.ip_address || "N/A"}` : `Canais: ${m.quantidade_canais}`}</span>
                              </div>
                              {m.vinc_count > 0 && <Badge className="bg-yellow-100 text-yellow-800 text-xs font-medium px-2 py-1 mt-1 w-fit">Em uso ({m.vinc_count} vinculações)</Badge>}
                            </div>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button variant="ghost" size="icon" onClick={() => handleEdit(m)} className="h-8 w-8 hover:bg-blue-100"><Pencil className="h-4 w-4 text-blue-600" /></Button>
                                <Button variant="ghost" size="icon" onClick={() => handleDelete(m.id)} disabled={m.vinc_count > 0} className="h-8 w-8 hover:bg-red-100" title={m.vinc_count > 0 ? "Exclua as vinculações antes de remover." : undefined}><Trash2 className="h-4 w-4 text-red-600" /></Button>
                            </div>
                          </motion.li>
                        ))}
                      </AnimatePresence>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
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
                    <Input id="edit-nome" value={editingModulo.nome} onChange={(e) => setEditingModulo({ ...editingModulo, nome: e.target.value })} />
                  </div>
                  {CONTROLLER_TYPES.includes(editingModulo.tipo) && (
                    <>
                      <div>
                        <Label htmlFor="edit-quadro">Quadro Elétrico</Label>
                        <select id="edit-quadro" value={editingModulo.quadro_eletrico?.id || ""} onChange={(e) => { const newQuadroId = Number(e.target.value); const newQuadro = quadros.find((q) => q.id === newQuadroId); setEditingModulo({ ...editingModulo, quadro_eletrico: newQuadro ? { id: newQuadro.id, nome: newQuadro.nome } : undefined, }); }} className="w-full h-10 px-3 rounded-md border border-input bg-background">
                          <option value="">Nenhum</option>
                          {quadros.map((quadro) => <option key={quadro.id} value={quadro.id}>{quadro.nome} ({quadro.ambiente.nome})</option>)}
                        </select>
                      </div>
                      <div>
                        <Label htmlFor="edit-ip_address">Endereço IP</Label>
                        <Input id="edit-ip_address" value={editingModulo.ip_address || ""} onChange={(e) => setEditingModulo({ ...editingModulo, ip_address: e.target.value })} />
                      </div>
                      <div className="flex items-center space-x-2 pt-2">
                        <Checkbox id="edit-is-logic-server" checked={editingModulo.is_logic_server} onCheckedChange={(checked) => setEditingModulo({ ...editingModulo, is_logic_server: !!checked })} disabled={editingModulo.is_logic_server && modulos.filter(m => m.is_controller).length === 1} />
                        <Label htmlFor="edit-is-logic-server">Definir como Logic Server</Label>
                      </div>
                    </>
                  )}
                  {!CONTROLLER_TYPES.includes(editingModulo.tipo) && (
                     <div>
                        <Label htmlFor="edit-parent-controller">Controlador Vinculado</Label>
                        <select id="edit-parent-controller" value={editingModulo.parent_controller_id || ""} onChange={(e) => setEditingModulo({...editingModulo, parent_controller_id: Number(e.target.value)})} className="w-full h-10 px-3 rounded-md border border-input bg-background">
                          {controllerOptions.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                        </select>
                      </div>
                  )}
                  <DialogFooter>
                    <DialogClose asChild><Button type="button" variant="secondary">Cancelar</Button></DialogClose>
                    <Button type="submit" disabled={loading}>Salvar Alterações</Button>
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