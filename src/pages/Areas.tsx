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
  Building2,
  Sparkles,
  FolderPlus,
  MapPin,
  Pencil,
  Check,
  X,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import NavigationButtons from "@/components/NavigationButtons";

type Area = {
  id: number;
  nome: string;
};

export default function Areas() {
  const { toast } = useToast();
  const { projeto } = useProject();
  const [projetoSelecionado, setProjetoSelecionado] = useState<boolean | null>(
    projeto ? true : null
  );
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
        const res = await fetch("/api/projeto_atual", {
          credentials: "same-origin",
        });
        const data = await res.json();
        setProjetoSelecionado(!!(data?.ok && data?.projeto_atual));
      } catch {
        setProjetoSelecionado(false);
      }
    };
    checkProject();
  }, [projetoSelecionado]);

  const [areas, setAreas] = useState<Area[]>([]);
  const [loading, setLoading] = useState(true);

  // form
  const [novaArea, setNovaArea] = useState("");

  // editing state
  const [editingAreaId, setEditingAreaId] = useState<number | null>(null);
  const [editingAreaName, setEditingAreaName] = useState("");

  const fetchAreas = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/areas", {
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });
      if (!response.ok) throw new Error("Falha ao carregar as áreas.");
      const data = await response.json();
      setAreas(data?.areas || []);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Não foi possível carregar a lista de áreas do projeto.",
      });
      console.error("Erro ao carregar áreas:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (projetoSelecionado === true) {
      fetchAreas();
    } else {
      setLoading(false);
    }
  }, [projetoSelecionado]);

  const handleAddArea = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!novaArea.trim()) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "O nome da área não pode estar vazio.",
      });
      return;
    }
    setLoading(true);
    try {
      const response = await fetch("/api/areas", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ nome: novaArea.trim() }),
      });
      const data = await response.json().catch(() => null);
      if (response.ok && (data?.ok || data?.success)) {
        setNovaArea("");
        await fetchAreas();
        toast({
          title: "Sucesso!",
          description: "Área adicionada com sucesso.",
        });
      } else {
        toast({
          variant: "destructive",
          title: "Erro",
          description: data?.error || data?.message || "Erro ao adicionar área.",
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

  const handleStartEdit = (area: Area) => {
    setEditingAreaId(area.id);
    setEditingAreaName(area.nome);
  };

  const handleCancelEdit = () => {
    setEditingAreaId(null);
    setEditingAreaName("");
  };

  const handleUpdateArea = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingAreaId === null || !editingAreaName.trim()) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/areas/${editingAreaId}`, {
        method: "PUT",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ nome: editingAreaName.trim() }),
      });
      const data = await response.json().catch(() => null);

      if (response.ok && data?.ok) {
        handleCancelEdit();
        await fetchAreas();
        toast({
          title: "Sucesso!",
          description: "Área atualizada com sucesso.",
        });
      } else {
        toast({
          variant: "destructive",
          title: "Erro",
          description: data?.error || "Não foi possível atualizar a área.",
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erro de Conexão",
        description: "Não foi possível conectar ao servidor.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteArea = async (id: number) => {
    const areaToDelete = areas.find((a) => a.id === id);
    if (!areaToDelete) return;
    if (
      !window.confirm(
        "Tem certeza que deseja excluir esta área? Esta ação não pode ser desfeita."
      )
    )
      return;
    setLoading(true);
    try {
      const response = await fetch(`/api/areas/${id}`, {
        method: "DELETE",
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });
      const data = await response.json().catch(() => null);
      if (response.ok && (data?.ok || data?.success)) {
        await fetchAreas();
        toast({
          title: "Sucesso!",
          description: "Área excluída com sucesso.",
        });
      } else {
        toast({
          variant: "destructive",
          title: "Erro",
          description: data?.error || data?.message || "Erro ao excluir área.",
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

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 dark:from-background dark:via-background/40 dark:to-primary/25">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 mb-10">
            <div>
              <div className="flex items-center gap-4 mb-4">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-3xl flex items-center justify-center shadow-lg shadow-purple-500/25">
                  <MapPin className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h1 className="text-4xl font-bold text-foreground mb-2">
                    Gerenciar Áreas
                  </h1>
                  <p className="text-lg text-muted-foreground max-w-2xl">
                    Adicione ou edite as áreas do seu projeto.
                  </p>
                </div>
              </div>
              <div className="h-1 w-32 bg-gradient-to-r from-purple-600 to-violet-600 rounded-full shadow-sm" />
            </div>
          </div>

          {projetoSelecionado === false && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-8"
            >
              <Alert className="bg-amber-50 border-amber-200 shadow-sm">
                <Sparkles className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-amber-800">
                  Selecione um projeto na página inicial para gerenciar áreas.
                </AlertDescription>
              </Alert>
            </motion.div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
            >
              <Card className="bg-card/95 backdrop-blur-sm border border-border shadow-xl shadow-primary/10 dark:bg-card/85 dark:shadow-primary/20">
                <CardHeader className="pb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center shadow-lg">
                      <FolderPlus className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-2xl font-bold text-foreground">
                        Adicionar Nova Área
                      </CardTitle>
                      <p className="text-muted-foreground mt-1">
                        Preencha as informações da área
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleAddArea} className="space-y-6">
                    <div>
                      <Label
                        htmlFor="area-name"
                        className="text-sm font-semibold text-slate-700"
                      >
                        Nome da Área *
                      </Label>
                      <Input
                        id="area-name"
                        type="text"
                        value={novaArea}
                        onChange={(e) => setNovaArea(e.target.value)}
                        placeholder="Ex: Térreo, Cobertura..."
                        required
                        className="mt-2 h-12 px-4 rounded-xl border-border focus:border-purple-500 focus:ring-purple-500/20"
                        disabled={isLocked}
                      />
                    </div>
                    <Button
                      type="submit"
                      className="w-full h-12 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-purple-700 hover:to-violet-700 text-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center gap-2"
                      disabled={isLocked}
                    >
                      <PlusCircle className="h-5 w-5" />
                      Adicionar Área
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Card className="bg-card/95 backdrop-blur-sm border border-border shadow-xl shadow-primary/10 dark:bg-card/85 dark:shadow-primary/20">
                <CardHeader className="pb-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg">
                        <MapPin className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <CardTitle className="text-2xl font-bold text-foreground">
                          Áreas Cadastradas
                        </CardTitle>
                        <p className="text-muted-foreground mt-1">
                          Lista de todas as áreas do projeto
                        </p>
                      </div>
                    </div>
                    <Badge className="bg-gradient-to-r from-purple-500 to-violet-500 text-white text-sm font-medium px-3 py-1">
                      {areas.length} {areas.length === 1 ? "área" : "áreas"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  {loading && areas.length === 0 ? (
                    <div className="flex flex-col justify-center items-center py-12">
                      <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-500 border-t-transparent mb-4"></div>
                      <p className="text-muted-foreground font-medium">
                        Carregando áreas...
                      </p>
                    </div>
                  ) : areas.length === 0 ? (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-center py-12"
                    >
                      <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mx-auto mb-6">
                        <Building2 className="h-10 w-10 text-muted-foreground/80" />
                      </div>
                      <h4 className="text-xl font-semibold text-foreground mb-2">
                        {projetoSelecionado
                          ? "Nenhuma área cadastrada"
                          : "Selecione um projeto"}
                      </h4>
                      <p className="text-muted-foreground max-w-sm mx-auto">
                        {projetoSelecionado
                          ? "Comece adicionando sua primeira área usando o formulário ao lado."
                          : "Selecione um projeto para visualizar e gerenciar as áreas."}
                      </p>
                    </motion.div>
                  ) : (
                    <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                      <AnimatePresence>
                        {areas.map((area, index) => (
                          <motion.li
                            key={area.id}
                            layout
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            transition={{ delay: index * 0.05 }}
                            className="group relative overflow-hidden rounded-2xl border border-border bg-card/85 backdrop-blur-sm p-4 hover:bg-card/90 hover:shadow-lg hover:shadow-slate-900/5 transition-all duration-300 flex items-center justify-between"
                          >
                            {editingAreaId === area.id ? (
                              <form
                                onSubmit={handleUpdateArea}
                                className="flex-grow flex items-center gap-2"
                              >
                                <Input
                                  type="text"
                                  value={editingAreaName}
                                  onChange={(e) =>
                                    setEditingAreaName(e.target.value)
                                  }
                                  className="h-9"
                                  autoFocus
                                />
                                <Button
                                  type="submit"
                                  size="icon"
                                  className="h-9 w-9 bg-green-500 hover:bg-green-600"
                                  onClick={handleUpdateArea}
                                >
                                  <Check className="h-4 w-4" />
                                </Button>
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="ghost"
                                  onClick={handleCancelEdit}
                                  className="h-9 w-9"
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </form>
                            ) : (
                              <>
                                <span className="font-bold text-lg text-foreground">
                                  {area.nome}
                                </span>
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleStartEdit(area)}
                                    className="h-8 w-8 hover:bg-blue-100"
                                  >
                                    <Pencil className="h-4 w-4 text-blue-600" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleDeleteArea(area.id)}
                                    className="h-8 w-8 hover:bg-red-100"
                                  >
                                    <Trash2 className="h-4 w-4 text-red-600" />
                                  </Button>
                                </div>
                              </>
                            )}
                          </motion.li>
                        ))}
                      </AnimatePresence>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </div>

          <NavigationButtons nextPath="/ambientes" />
        </div>
      </div>
    </Layout>
  );
}
