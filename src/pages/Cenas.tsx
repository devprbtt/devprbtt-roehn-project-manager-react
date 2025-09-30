import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCenas, useDeleteCena } from "@/hooks/useCenas";
import { SceneForm } from "@/components/cenas/SceneForm";
import { PlusCircle, Trash2, Clapperboard, Edit } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import type { Cena } from "@/types/cena";
import type { Circuito, Ambiente, Area } from "@/types/project";

const Cenas = () => {
  // State for data
  const [ambientes, setAmbientes] = useState<(Ambiente & { area: Area })[]>([]);
  const [circuitos, setCircuitos] = useState<Circuito[]>([]);
  const [selectedAmbiente, setSelectedAmbiente] = useState<number | null>(null);
  const [loadingData, setLoadingData] = useState(true);

  // State for UI
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingScene, setEditingScene] = useState<Cena | null>(null);

  // Hooks
  const { data: cenas, isLoading: loadingCenas } = useCenas(selectedAmbiente);
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

  const handleOpenCreateForm = () => {
    if (!selectedAmbiente) {
        toast({ title: "Atenção", description: "Por favor, selecione um ambiente primeiro.", variant: "default" });
        return;
    }
    setEditingScene(null);
    setIsFormOpen(true);
  };

  const handleOpenEditForm = (scene: Cena) => {
    setEditingScene(scene);
    setIsFormOpen(true);
  };

  const handleDelete = (cenaId: number) => {
    if (!selectedAmbiente) return;
    if (window.confirm("Tem certeza que deseja excluir esta cena?")) {
      deleteCena({ id: cenaId, ambienteId: selectedAmbiente });
    }
  };

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

        <div className="grid grid-cols-1 gap-8">
          <Card>
            <CardHeader>
              <CardTitle>Selecione um Ambiente</CardTitle>
            </CardHeader>
            <CardContent>
              <Select
                onValueChange={(value) => setSelectedAmbiente(Number(value))}
                disabled={loadingData || ambientes.length === 0}
              >
                <SelectTrigger className="w-full md:w-1/3">
                  <SelectValue placeholder={loadingData ? "Carregando..." : "Selecione um ambiente"} />
                </SelectTrigger>
                <SelectContent>
                  {ambientes.map((ambiente) => (
                    <SelectItem key={ambiente.id} value={String(ambiente.id)}>
                      {ambiente.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {selectedAmbiente && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Cenas do Ambiente</CardTitle>
                <Button onClick={handleOpenCreateForm}>
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Criar Cena
                </Button>
              </CardHeader>
              <CardContent>
                {loadingCenas ? (
                  <p>Carregando cenas...</p>
                ) : cenas && cenas.length > 0 ? (
                  <div className="space-y-4">
                    {cenas.map((cena) => (
                      <div key={cena.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div>
                          <p className="font-semibold">{cena.nome}</p>
                          <p className="text-sm text-muted-foreground">{cena.acoes.length} ações</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="icon" onClick={() => handleOpenEditForm(cena)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="destructive" size="icon" onClick={() => handleDelete(cena.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-8">Nenhuma cena encontrada para este ambiente.</p>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {selectedAmbiente && (
        <SceneForm
            isOpen={isFormOpen}
            onOpenChange={setIsFormOpen}
            scene={editingScene}
            ambienteId={selectedAmbiente}
            projectCircuits={circuitos}
            projectAmbientes={ambientes}
        />
      )}
    </Layout>
  );
};

export default Cenas;