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
  DoorOpen,
  Sparkles,
  Building2,
  FolderPlus,
  Grid3X3,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type Area = { id: number; nome: string };
type Ambiente = { id: number; nome: string; area?: Area; area_id?: number };

export default function Ambientes() {
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


  const [areas, setAreas] = useState<Area[]>([]);
  const [ambientes, setAmbientes] = useState<Ambiente[]>([]);
  const [loading, setLoading] = useState(true);

  // form
  const [nome, setNome] = useState("");
  const [areaId, setAreaId] = useState<number | "">("");

  const fetchAreas = async () => {
    try {
      const res = await fetch("/api/areas", {
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });
      if (!res.ok) throw new Error("Falha ao carregar as áreas.");
      const data = await res.json();
      setAreas(data?.areas || []);
    } catch (error) {
      console.error(error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Não foi possível carregar as áreas do projeto.",
      });
    }
  };

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

  const fetchAll = async () => {
    if (projetoSelecionado !== true) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      await Promise.all([fetchAreas(), fetchAmbientes()]);
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
    if (!nome.trim() || !areaId) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Preencha o nome do ambiente e selecione uma área.",
      });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/ambientes", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ nome: nome.trim(), area_id: areaId }),
      });
      const data = await res.json().catch(() => null);

      if (res.ok && (data?.ok || data?.success)) {
        setNome("");
        setAreaId("");
        await fetchAmbientes();
        toast({ title: "Sucesso!", description: "Ambiente adicionado com sucesso." });
      } else {
        toast({
          variant: "destructive",
          title: "Erro",
          description: data?.error || data?.message || "Erro ao adicionar ambiente.",
        });
      }
    } catch {
      toast({ variant: "destructive", title: "Erro", description: "Erro de conexão com o servidor." });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Tem certeza que deseja excluir este ambiente?")) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/ambientes/${id}`, {
        method: "DELETE",
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });
      const data = await res.json().catch(() => null);
      if (res.ok && (data?.ok || data?.success)) {
        setAmbientes((prev) => prev.filter((a) => a.id !== id));
        toast({ title: "Sucesso!", description: "Ambiente excluído com sucesso." });
      } else {
        toast({
          variant: "destructive",
          title: "Erro",
          description: data?.error || data?.message || "Erro ao excluir ambiente.",
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
                <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-green-600 rounded-3xl flex items-center justify-center shadow-lg shadow-blue-500/25">
                  <Grid3X3 className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h1 className="text-4xl font-bold text-slate-900 mb-2">Gerenciar Ambientes</h1>
                  <p className="text-lg text-slate-600 max-w-2xl">
                    Adicione ambientes dentro de áreas.
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
                  Selecione um projeto na página inicial para gerenciar ambientes.
                </AlertDescription>
              </Alert>
            </motion.div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}>
              <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-xl shadow-slate-900/5">
                <CardHeader className="pb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center shadow-lg">
                      <FolderPlus className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-2xl font-bold text-slate-900">Adicionar Novo Ambiente</CardTitle>
                      <p className="text-slate-600 mt-1">Preencha as informações do ambiente</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <form className="space-y-6" onSubmit={handleCreate}>
                    <div className="space-y-2">
                      <Label htmlFor="nome" className="text-sm font-semibold text-slate-700">
                        Nome do Ambiente *
                      </Label>
                      <Input
                        id="nome"
                        placeholder="Ex: Sala de Estar, Cozinha..."
                        value={nome}
                        onChange={(e) => setNome(e.target.value)}
                        required
                        disabled={isLocked || loading || areas.length === 0}
                        className="h-12 px-4 rounded-xl border-slate-200 focus:border-blue-500 focus:ring-blue-500/20"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="areaId" className="text-sm font-semibold text-slate-700">
                        Área *
                      </Label>
                      <select
                        id="areaId"
                        className="h-12 w-full px-4 rounded-xl border border-slate-200 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                        value={areaId as any}
                        onChange={(e) => setAreaId(Number(e.target.value))}
                        required
                        disabled={!projetoSelecionado || areas.length === 0}
                      >
                        <option value="">Selecione uma área</option>
                        {areas.map((area) => (
                          <option key={area.id} value={area.id}>
                            {area.nome}
                          </option>
                        ))}
                      </select>
                      {!loading && projetoSelecionado === true && areas.length === 0 && (
                        <p className="text-sm text-amber-600 mt-1 flex items-center gap-1">
                          <Sparkles className="w-3 h-3" />
                          Nenhuma área disponível. Crie áreas primeiro.
                        </p>
                      )}
                    </div>

                    <Button
                      type="submit"
                      className="w-full h-12 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center gap-2"
                      disabled={!projetoSelecionado || areas.length === 0}
                    >
                      <PlusCircle className="h-5 w-5" />
                      Adicionar Ambiente
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
                      <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-2xl flex items-center justify-center shadow-lg">
                        <Grid3X3 className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <CardTitle className="text-2xl font-bold text-slate-900">Ambientes Cadastrados</CardTitle>
                        <p className="text-slate-600 mt-1">Lista de todos os ambientes</p>
                      </div>
                    </div>
                    <Badge className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white text-sm font-medium px-3 py-1">
                      {ambientes.length} {ambientes.length === 1 ? "ambiente" : "ambientes"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="flex flex-col justify-center items-center py-12">
                      <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent mb-4"></div>
                      <p className="text-slate-600 font-medium">Carregando ambientes...</p>
                    </div>
                  ) : ambientes.length === 0 ? (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-center py-12"
                    >
                      <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-6">
                        <DoorOpen className="h-10 w-10 text-slate-400" />
                      </div>
                      <h4 className="text-xl font-semibold text-slate-900 mb-2">
                        {projetoSelecionado ? "Nenhum ambiente cadastrado" : "Selecione um projeto"}
                      </h4>
                      <p className="text-slate-600 max-w-sm mx-auto">
                        {projetoSelecionado
                          ? "Comece adicionando seu primeiro ambiente usando o formulário ao lado."
                          : "Selecione um projeto para visualizar e gerenciar os ambientes."}
                      </p>
                    </motion.div>
                  ) : (
                    <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                      <AnimatePresence>
                        {ambientes.map((amb, index) => (
                          <motion.div
                            key={amb.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            transition={{ delay: index * 0.05 }}
                            className="group relative overflow-hidden rounded-2xl border border-slate-200/60 bg-white/60 backdrop-blur-sm p-4 hover:bg-white/80 hover:shadow-lg hover:shadow-slate-900/5 transition-all duration-300"
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1 mr-4">
                                <h4 className="font-bold text-slate-900 text-lg mb-1">{amb.nome}</h4>
                                <div className="flex items-center gap-2 text-sm text-slate-600 mb-2">
                                  <Building2 className="h-4 w-4 text-slate-400" />
                                  <span className="font-medium">
                                    Área:{" "}
                                    {amb.area?.nome ||
                                      areas.find((a) => a.id === amb.area_id)?.nome ||
                                      "—"}
                                  </span>
                                </div>
                              </div>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => handleDelete(amb.id)}
                                disabled={loading}
                                className="opacity-0 group-hover:opacity-100 transition-all duration-300 rounded-xl shadow-lg hover:shadow-xl"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
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