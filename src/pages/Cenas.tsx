import { useState, useEffect, useMemo } from "react";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useCenas, useDeleteCena } from "@/hooks/useCenas";
import { SceneForm } from "@/components/cenas/SceneForm";
import { Trash2, Clapperboard, Edit, Search, Filter, X } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import type { Cena } from "@/types/cena";
import type { Circuito, Ambiente, Area } from "@/types/project";
import { motion } from "framer-motion";

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
                <CardHeader>
                    <CardTitle>Cenas Cadastradas</CardTitle>
                    <div className="mt-4 space-y-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                            <Input
                                placeholder="Buscar por nome..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-10 pr-10 h-10"
                            />
                            {searchTerm && <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 transform -translate-y-1/2 h-8 w-8" onClick={() => setSearchTerm("")}><X className="w-4 h-4" /></Button>}
                        </div>
                        <div className="flex items-center gap-2">
                            <Filter className="h-4 w-4 text-slate-500" />
                            <Select value={String(ambienteFilter)} onValueChange={(v) => setAmbienteFilter(v === "todos" ? "todos" : Number(v))}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Filtrar por ambiente..." />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="todos">Todos os Ambientes</SelectItem>
                                    {ambientes.map(a => <SelectItem key={a.id} value={String(a.id)}>{a.nome}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {loadingCenas ? (
                    <p>Carregando cenas...</p>
                    ) : filteredCenas && filteredCenas.length > 0 ? (
                    <ScrollArea className="h-[500px] pr-4">
                        <div className="space-y-4">
                        {filteredCenas.map((cena) => (
                            <div key={cena.id} className="flex items-center justify-between p-4 border rounded-lg">
                            <div>
                                <p className="font-semibold">{cena.nome}</p>
                                <p className="text-sm text-muted-foreground">{cena.ambiente.nome} ({cena.ambiente.area.nome})</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <Button variant="outline" size="icon" onClick={() => handleEdit(cena)}>
                                <Edit className="h-4 w-4" />
                                </Button>
                                <Button variant="destructive" size="icon" onClick={() => handleDelete(cena.id)}>
                                <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                            </div>
                        ))}
                        </div>
                    </ScrollArea>
                    ) : (
                    <p className="text-center text-muted-foreground py-8">Nenhuma cena encontrada.</p>
                    )}
                </CardContent>
                </Card>
            </motion.div>
        </div>
      </div>
    </Layout>
  );
};

export default Cenas;