import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { PlusCircle, Trash2, AlertTriangle, FolderPlus, DoorOpen, Building2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Area = { id: number; nome: string };
type Ambiente = { id: number; nome: string; area?: Area; area_id?: number };

interface AmbienteManagementProps {
  projectName?: string;
  initialAreas?: Area[];
  initialAmbientes?: Ambiente[];
  projectSelected?: boolean;
}

const AmbienteManagement: React.FC<AmbienteManagementProps> = ({
  projectName = "",
  initialAreas = [],
  initialAmbientes = [],
  projectSelected = false,
}) => {
  const { toast } = useToast();

  const [areas, setAreas] = useState<Area[]>(initialAreas);
  const [ambientes, setAmbientes] = useState<Ambiente[]>(initialAmbientes);

  const [isLoading, setIsLoading] = useState(false);

  // form
  const [nome, setNome] = useState("");
  const [areaId, setAreaId] = useState<number | "">("");

  const fetchAreas = async () => {
    const res = await fetch("/api/areas", {
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) throw new Error("Falha ao carregar as áreas.");
    const data = await res.json();
    setAreas(data?.areas || []);
  };

  const fetchAmbientes = async () => {
    const res = await fetch("/api/ambientes", {
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) throw new Error("Falha ao carregar os ambientes.");
    const data = await res.json();
    setAmbientes(data?.ambientes || []);
  };

  const fetchAll = async () => {
    setIsLoading(true);
    try {
      await Promise.all([fetchAreas(), fetchAmbientes()]);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erro ao carregar dados",
        description: "Não foi possível carregar áreas/ambientes do projeto.",
      });
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (projectSelected) fetchAll();
  }, [projectSelected]);

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
    setIsLoading(true);
    try {
      const res = await fetch("/api/ambientes", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
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
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    const toDelete = ambientes.find((a) => a.id === id);
    if (!toDelete) return;
    if (!window.confirm("Tem certeza que deseja excluir este ambiente? Esta ação não pode ser desfeita.")) return;

    setIsLoading(true);
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
      setIsLoading(false);
    }
  };

  if (!projectSelected) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="mx-auto max-w-4xl">
          <Alert className="border-warning bg-warning/10">
            <AlertTriangle className="h-4 w-4 text-warning" />
            <AlertDescription className="text-warning-foreground">
              Nenhum projeto selecionado.{" "}
              <a href="/" className="underline hover:no-underline font-medium">
                Voltar para a página inicial
              </a>{" "}
              para selecionar ou criar um projeto.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* Header — mesmo padrão de Áreas */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <DoorOpen className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold text-foreground">Gerenciar Ambientes do Projeto</h1>
              <p className="text-muted-foreground mt-1">{projectName}</p>
            </div>
          </div>
          <div className="h-1 w-24 bg-gradient-to-r from-primary to-primary-glow rounded-full" />
        </div>

        {/* Main Content — grid 2 colunas igual Áreas */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Form de cadastro */}
          <Card className="shadow-sm border-0 bg-card/50 backdrop-blur-sm">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-xl">
                <FolderPlus className="h-5 w-5 text-primary" />
                Adicionar Novo Ambiente
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreate} className="space-y-4">
                <div>
                  <Label htmlFor="ambiente-nome" className="text-sm font-medium">
                    Nome do Ambiente
                  </Label>
                  <Input
                    id="ambiente-nome"
                    type="text"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    placeholder="Digite o nome do ambiente..."
                    className="mt-1"
                    disabled={isLoading}
                  />
                </div>
                <div>
                  <Label htmlFor="ambiente-area" className="text-sm font-medium">
                    Área
                  </Label>
                  <select
                    id="ambiente-area"
                    className="mt-1 w-full h-10 px-3 rounded-md border bg-background"
                    value={areaId as any}
                    onChange={(e) => setAreaId(Number(e.target.value))}
                    disabled={isLoading}
                    required
                  >
                    <option value="">Selecione uma área…</option>
                    {areas.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.nome}
                      </option>
                    ))}
                  </select>
                </div>

                <Button type="submit" className="w-full" disabled={isLoading || !nome.trim() || !areaId}>
                  {isLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                      Adicionando...
                    </>
                  ) : (
                    <>
                      <PlusCircle className="h-4 w-4 mr-2" />
                      Adicionar Ambiente
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Lista de ambientes */}
          <Card className="shadow-sm border-0 bg-card/50 backdrop-blur-sm">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center justify-between text-xl">
                <span className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-primary" />
                  Ambientes Cadastrados
                </span>
                <Badge variant="secondary" className="text-xs">
                  {ambientes.length} {ambientes.length === 1 ? "ambiente" : "ambientes"}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {ambientes.length > 0 ? (
                <div className="space-y-3">
                  {ambientes.map((amb) => (
                    <div
                      key={amb.id}
                      className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors group"
                    >
                      <div>
                        <span className="font-medium text-foreground">{amb.nome}</span>
                        <p className="text-xs text-muted-foreground mt-1">
                          Área: {amb.area?.nome || areas.find((a) => a.id === amb.area_id)?.nome || "—"}
                        </p>
                      </div>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDelete(amb.id)}
                        disabled={isLoading}
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <DoorOpen className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground">Nenhum ambiente cadastrado ainda.</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Adicione seu primeiro ambiente usando o formulário ao lado.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default AmbienteManagement;
