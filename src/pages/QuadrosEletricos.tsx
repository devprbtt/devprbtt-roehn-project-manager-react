import { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useProject } from "@/store/project";
import {
  PlusCircle,
  Trash2,
  Cpu,
  Sparkles,
  Building2,
  FolderPlus,
  CircuitBoard,
  Wrench,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type Area = { id: number; nome: string };
type Ambiente = { id: number; nome: string; area?: Area; area_id?: number };
type QuadroEletrico = { 
  id: number; 
  nome: string; 
  notes?: string;
  ambiente: Ambiente;
  quantidade_modulos: number;
};

export default function QuadrosEletricos() {
  const { toast } = useToast();
  const { projeto } = useProject();
  const [projetoSelecionado, setProjetoSelecionado] = useState<boolean | null>(projeto ? true : null);
  const isLocked = projetoSelecionado !== true;

  // Se o store já tem projeto, marcamos como selecionado
  useEffect(() => {
    try {
      if (projeto) setProjetoSelecionado(true);
    } catch {}
  }, [projeto]);

  // Checa a sessão quando ainda não sabemos se há projeto
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

  const [ambientes, setAmbientes] = useState<Ambiente[]>([]);
  const [quadros, setQuadros] = useState<QuadroEletrico[]>([]);
  const [loading, setLoading] = useState(true);

  // form
  const [nome, setNome] = useState("");
  const [ambienteId, setAmbienteId] = useState<number | "">("");
  const [notes, setNotes] = useState("");

  const fetchAmbientes = async () => {
    try {
      const res = await fetch("/api/ambientes", {
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });
      if (!res.ok) throw new Error("Falha ao carregar os ambientes.");
      const data = await res.json();
      setAmbientes(data?.ambientes || []);
    } catch (error) {
      console.error(error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Não foi possível carregar os ambientes do projeto.",
      });
    }
  };

  const fetchQuadros = async () => {
    try {
      const res = await fetch("/api/quadros_eletricos", {
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });
      if (!res.ok) throw new Error("Falha ao carregar os quadros elétricos.");
      const data = await res.json();
      setQuadros(data?.quadros_eletricos || []);
    } catch (error) {
      console.error(error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Não foi possível carregar os quadros elétricos do projeto.",
      });
    }
  };

  const fetchAll = async () => {
    if (projetoSelecionado !== true) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      await Promise.all([fetchAmbientes(), fetchQuadros()]);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, [projetoSelecionado]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim() || !ambienteId) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Preencha o nome do quadro elétrico e selecione um ambiente.",
      });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/quadros_eletricos", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ 
          nome: nome.trim(), 
          ambiente_id: ambienteId,
          notes: notes.trim() || null 
        }),
      });
      const data = await res.json().catch(() => null);

      if (res.ok && data?.ok) {
        setNome("");
        setAmbienteId("");
        setNotes("");
        await fetchQuadros();
        toast({ title: "Sucesso!", description: "Quadro elétrico adicionado com sucesso." });
      } else {
        toast({
          variant: "destructive",
          title: "Erro",
          description: data?.error || "Erro ao adicionar quadro elétrico.",
        });
      }
    } catch {
      toast({ variant: "destructive", title: "Erro", description: "Erro de conexão com o servidor." });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Tem certeza que deseja excluir este quadro elétrico?")) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/quadros_eletricos/${id}`, {
        method: "DELETE",
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.ok) {
        setQuadros((prev) => prev.filter((q) => q.id !== id));
        toast({ title: "Sucesso!", description: "Quadro elétrico excluído com sucesso." });
      } else {
        toast({
          variant: "destructive",
          title: "Erro",
          description: data?.error || "Erro ao excluir quadro elétrico.",
        });
      }
    } catch {
      toast({ variant: "destructive", title: "Erro", description: "Erro de conexão com o servidor." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 mb-10">
            <div>
              <div className="flex items-center gap-4 mb-4">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-3xl flex items-center justify-center shadow-lg shadow-blue-500/25">
                  <CircuitBoard className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h1 className="text-4xl font-bold text-slate-900 mb-2">Gerenciar Quadros Elétricos</h1>
                  <p className="text-lg text-slate-600 max-w-2xl">
                    Adicione quadros elétricos dentro de ambientes para organizar seus módulos.
                  </p>
                </div>
              </div>
              <div className="h-1 w-32 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full shadow-sm" />
            </div>
          </div>

          {projetoSelecionado === false && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
              <Alert className="bg-amber-50 border-amber-200 shadow-sm">
                <Sparkles className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-amber-800">
                  Selecione um projeto na página inicial para gerenciar quadros elétricos.
                </AlertDescription>
              </Alert>
            </motion.div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}>
              <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-xl shadow-slate-900/5">
                <CardHeader className="pb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg">
                      <FolderPlus className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-2xl font-bold text-slate-900">Adicionar Novo Quadro</CardTitle>
                      <p className="text-slate-600 mt-1">Preencha as informações do quadro elétrico</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <form className="space-y-6" onSubmit={handleCreate}>
                    <div className="space-y-2">
                      <Label htmlFor="nome" className="text-sm font-semibold text-slate-700">
                        Nome do Quadro Elétrico *
                      </Label>
                      <Input
                        id="nome"
                        placeholder="Ex: Quadro Principal, Quadro Técnico..."
                        value={nome}
                        onChange={(e) => setNome(e.target.value)}
                        required
                        disabled={isLocked || loading || ambientes.length === 0}
                        className="h-12 px-4 rounded-xl border-slate-200 focus:border-blue-500 focus:ring-blue-500/20"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="ambienteId" className="text-sm font-semibold text-slate-700">
                        Ambiente *
                      </Label>
                      <select
                        id="ambienteId"
                        className="h-12 w-full px-4 rounded-xl border border-slate-200 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                        value={ambienteId as any}
                        onChange={(e) => setAmbienteId(Number(e.target.value))}
                        required
                        disabled={!projetoSelecionado || ambientes.length === 0}
                      >
                        <option value="">Selecione um ambiente</option>
                        {ambientes.map((ambiente) => (
                          <option key={ambiente.id} value={ambiente.id}>
                            {ambiente.nome} {ambiente.area && `- ${ambiente.area.nome}`}
                          </option>
                        ))}
                      </select>
                      {!loading && projetoSelecionado === true && ambientes.length === 0 && (
                        <p className="text-sm text-amber-600 mt-1 flex items-center gap-1">
                          <Sparkles className="w-3 h-3" />
                          Nenhum ambiente disponível. Crie ambientes primeiro.
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="notes" className="text-sm font-semibold text-slate-700">
                        Observações (Opcional)
                      </Label>
                      <textarea
                        id="notes"
                        placeholder="Observações adicionais sobre o quadro elétrico..."
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        disabled={isLocked || loading || ambientes.length === 0}
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all resize-none"
                        rows={3}
                      />
                    </div>

                    <Button
                      type="submit"
                      className="w-full h-12 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center gap-2"
                      disabled={!projetoSelecionado || ambientes.length === 0}
                    >
                      <PlusCircle className="h-5 w-5" />
                      Adicionar Quadro Elétrico
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}>
              <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-xl shadow-slate-900/5">
                <CardHeader className="pb-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg">
                        <CircuitBoard className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <CardTitle className="text-2xl font-bold text-slate-900">Quadros Cadastrados</CardTitle>
                        <p className="text-slate-600 mt-1">Lista de todos os quadros elétricos</p>
                      </div>
                    </div>
                    <Badge className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white text-sm font-medium px-3 py-1">
                      {quadros.length} {quadros.length === 1 ? "quadro" : "quadros"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="flex flex-col justify-center items-center py-12">
                      <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent mb-4"></div>
                      <p className="text-slate-600 font-medium">Carregando quadros elétricos...</p>
                    </div>
                  ) : quadros.length === 0 ? (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-center py-12"
                    >
                      <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Cpu className="h-10 w-10 text-slate-400" />
                      </div>
                      <h4 className="text-xl font-semibold text-slate-900 mb-2">
                        {projetoSelecionado ? "Nenhum quadro elétrico cadastrado" : "Selecione um projeto"}
                      </h4>
                      <p className="text-slate-600 max-w-sm mx-auto">
                        {projetoSelecionado
                          ? "Comece adicionando seu primeiro quadro elétrico usando o formulário ao lado."
                          : "Selecione um projeto para visualizar e gerenciar os quadros elétricos."}
                      </p>
                    </motion.div>
                  ) : (
                    <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                      <AnimatePresence>
                        {quadros.map((quadro, index) => (
                          <motion.div
                            key={quadro.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            transition={{ delay: index * 0.05 }}
                            className="group relative overflow-hidden rounded-2xl border border-slate-200/60 bg-white/60 backdrop-blur-sm p-4 hover:bg-white/80 hover:shadow-lg hover:shadow-slate-900/5 transition-all duration-300"
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1 mr-4">
                                <div className="flex items-center gap-2 mb-2">
                                  <h4 className="font-bold text-slate-900 text-lg">{quadro.nome}</h4>
                                  <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                                    {quadro.quantidade_modulos} módulo{quadro.quantidade_modulos !== 1 ? 's' : ''}
                                  </Badge>
                                </div>
                                
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2 text-sm text-slate-600">
                                    <Building2 className="h-4 w-4 text-slate-400" />
                                    <span className="font-medium">
                                      Ambiente: {quadro.ambiente.nome}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2 text-sm text-slate-600">
                                    <Wrench className="h-4 w-4 text-slate-400" />
                                    <span className="font-medium">
                                      Área: {quadro.ambiente.area?.nome || "—"}
                                    </span>
                                  </div>
                                </div>

                                {quadro.notes && (
                                  <div className="mt-2">
                                    <p className="text-sm text-slate-500 italic">
                                      {quadro.notes}
                                    </p>
                                  </div>
                                )}
                              </div>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => handleDelete(quadro.id)}
                                disabled={loading || quadro.quantidade_modulos > 0}
                                className="opacity-0 group-hover:opacity-100 transition-all duration-300 rounded-xl shadow-lg hover:shadow-xl"
                                title={quadro.quantidade_modulos > 0 ? "Remova os módulos antes de excluir" : "Excluir quadro"}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                            
                            {quadro.quantidade_modulos > 0 && (
                              <div className="mt-2">
                                <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">
                                  Contém {quadro.quantidade_modulos} módulo{quadro.quantidade_modulos !== 1 ? 's' : ''}
                                </Badge>
                              </div>
                            )}
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </div>
    </Layout>
  );
}