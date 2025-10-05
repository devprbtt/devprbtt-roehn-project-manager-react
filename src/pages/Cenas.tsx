import { useState, useEffect, useMemo } from "react";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useCenas, useDeleteCena } from "@/hooks/useCenas";
import { SceneForm } from "@/components/cenas/SceneForm";
import { Trash2, Clapperboard, Edit, Search, Filter, X } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import type { Cena } from "@/types/cena";
import NavigationButtons from "@/components/NavigationButtons";
import type { Circuito, Ambiente, Area } from "@/types/project";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";

const Cenas = () => {
  // State for data
  const [ambientes, setAmbientes] = useState<(Ambiente & { area: Area })[]>([]);
  const [circuitos, setCircuitos] = useState<Circuito[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  // State for UI
  const [editingScene, setEditingScene] = useState<Cena | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [ambienteFilter, setAmbienteFilter] = useState<number | "todos">("todos");

  // Hooks
  const { data: cenas, isLoading: loadingCenas, refetch: refetchCenas } = useCenas();
  const { mutate: deleteCena } = useDeleteCena();

  // Fetch all necessary project data
  useEffect(() => {
    const fetchAllData = async () => {
      try {
        setLoadingData(true);
        const [ambRes, circRes] = await Promise.all([
          fetch("/api/ambientes"),
          fetch("/api/circuitos"),
        ]);
        if (!ambRes.ok || !circRes.ok) throw new Error("Falha ao carregar dados do projeto");

        const ambData = await ambRes.json();
        const circData = await circRes.json();

        setAmbientes(ambData?.ambientes || []);
        setCircuitos(circData?.circuitos || []);

      } catch (error) {
        toast({
          title: "Erro ao carregar dados",
          description: "Não foi possível buscar os dados do projeto.",
          variant: "destructive",
        });
      } finally {
        setLoadingData(false);
      }
    };
    fetchAllData();
  }, []);

  const filteredCenas = useMemo(() => {
    if (!cenas) return [];
    return cenas.filter(cena => {
        const matchesSearch = searchTerm === "" || cena.nome.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesAmbiente = ambienteFilter === "todos" || cena.ambiente.id === ambienteFilter;
        return matchesSearch && matchesAmbiente;
    });
  }, [cenas, searchTerm, ambienteFilter]);


  const handleEdit = (scene: Cena) => {
    setEditingScene(scene);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = (cenaId: number) => {
    if (window.confirm("Tem certeza que deseja excluir esta cena?")) {
      deleteCena({ id: cenaId });
    }
  };

  const handleFormSuccess = () => {
    setEditingScene(null);
    refetchCenas();
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex items-center gap-4 mb-10">
            <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-3xl flex items-center justify-center shadow-lg">
                <Clapperboard className="w-8 h-8 text-white" />
            </div>
            <div>
                <h1 className="text-4xl font-bold text-slate-900">Gerenciar Cenas</h1>
                <p className="text-lg text-slate-600">Crie e configure cenas para automatizar seus ambientes.</p>
            </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Coluna do Formulário */}
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
                <SceneForm
                    key={editingScene ? editingScene.id : 'new'}
                    scene={editingScene}
                    projectCircuits={circuitos}
                    projectAmbientes={ambientes}
                    onSuccess={handleFormSuccess}
                />
            </motion.div>

            {/* Coluna da Lista de Cenas */}
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
                <Card>
                <CardHeader className="pb-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg">
                                <Clapperboard className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <CardTitle className="text-2xl font-bold text-slate-900">Cenas Cadastradas</CardTitle>
                                <p className="text-slate-600 mt-1">Lista de todas as cenas</p>
                            </div>
                        </div>
                        <Badge className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-sm font-medium px-3 py-1">
                            {filteredCenas.length} de {cenas?.length || 0} {cenas?.length === 1 ? "cena" : "cenas"}
                        </Badge>
                    </div>

                    {/* Barra de Filtros */}
                    <div className="mt-6 space-y-4">
                        {/* Filtro de Busca por Texto */}
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                            <Input
                                placeholder="Buscar por nome..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-10 pr-10 h-10 rounded-xl border-slate-200 focus:border-blue-500"
                            />
                            {searchTerm && (
                                <button
                                    onClick={() => setSearchTerm("")}
                                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            )}
                        </div>

                        {/* Filtro por Ambiente */}
                        <div className="space-y-1">
                            <Label htmlFor="filtro-ambiente" className="text-xs font-medium text-slate-600">
                                Ambiente
                            </Label>
                            <Select value={String(ambienteFilter)} onValueChange={(v) => setAmbienteFilter(v === "todos" ? "todos" : Number(v))}>
                                <SelectTrigger id="filtro-ambiente" className="h-9 text-sm rounded-xl">
                                    <SelectValue placeholder="Filtrar por ambiente..." />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl">
                                    <SelectItem value="todos">Todos os Ambientes</SelectItem>
                                    {ambientes.map(a => (
                                        <SelectItem key={a.id} value={String(a.id)}>
                                            {a.nome} ({a.area.nome})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Botão para limpar todos os filtros */}
                        {(searchTerm || ambienteFilter !== "todos") && (
                            <div className="flex justify-end">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                        setSearchTerm("");
                                        setAmbienteFilter("todos");
                                    }}
                                    className="h-8 text-xs rounded-lg gap-1"
                                >
                                    <X className="w-3 h-3" />
                                    Limpar filtros
                                </Button>
                            </div>
                        )}
                    </div>
                </CardHeader>
                <CardContent>
                    {loadingCenas ? (
                    <p>Carregando cenas...</p>
                    ) : filteredCenas && filteredCenas.length > 0 ? (
                    <ScrollArea className="h-[500px] pr-4">
                        <div className="space-y-3">
                            <AnimatePresence>
                                {filteredCenas.map((cena, index) => (
                                    <motion.div
                                        key={cena.id}
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -20 }}
                                        transition={{ delay: index * 0.05 }}
                                        className="group relative overflow-hidden rounded-2xl border border-slate-200/60 bg-white/60 backdrop-blur-sm p-4 hover:bg-white/80 hover:shadow-lg hover:shadow-slate-900/5 transition-all duration-300"
                                    >
                                        <div className="flex items-start justify-between">
                                            <div className="flex-1 mr-4">
                                                <div className="flex items-center gap-3 mb-2">
                                                    <Badge className="text-xs font-medium px-2 py-1 bg-indigo-100 text-indigo-800">
                                                        {cena.acoes.length} {cena.acoes.length === 1 ? 'Ação' : 'Ações'}
                                                    </Badge>
                                                </div>
                                                <h4 className="font-bold text-slate-900 text-lg">{cena.nome}</h4>
                                                <p className="text-sm text-slate-600">
                                                    {cena.ambiente.nome}
                                                    {cena.ambiente.area && ` (${cena.ambiente.area.nome})`}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Button variant="outline" size="sm" onClick={() => handleEdit(cena)} className="rounded-xl shadow hover:shadow-md">
                                                    <Edit className="h-4 w-4 mr-2" />
                                                    Editar
                                                </Button>
                                                <Button variant="destructive" size="sm" onClick={() => handleDelete(cena.id)} className="rounded-xl shadow-lg hover:shadow-xl">
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        </div>
                    </ScrollArea>
                    ) : (
                    <p className="text-center text-muted-foreground py-8">Nenhuma cena encontrada.</p>
                    )}
                </CardContent>
                </Card>
            </motion.div>
        </div>

        <NavigationButtons previousPath="/keypads" nextPath="/vinculacao" />
      </div>
    </Layout>
  );
};

export default Cenas;