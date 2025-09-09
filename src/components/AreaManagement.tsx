import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { PlusCircle, Trash2, AlertTriangle, FolderPlus, Building2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Area {
  id: number;
  nome: string;
}

interface AreaManagementProps {
  projectName?: string;
  initialAreas?: Area[];
  projectSelected?: boolean;
}

const AreaManagement: React.FC<AreaManagementProps> = ({ 
  projectName = "",
  initialAreas = [],
  projectSelected = false
}) => {
  const [areas, setAreas] = useState<Area[]>(initialAreas);
  const [novaArea, setNovaArea] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  // Função para buscar as áreas do servidor
  const fetchAreas = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/areas', {
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) throw new Error('Falha ao carregar as áreas.');
      const data = await response.json();
      setAreas(data.areas || []);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erro ao carregar áreas",
        description: "Não foi possível carregar a lista de áreas do projeto.",
      });
      console.error("Erro ao carregar áreas:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Usa o useEffect para carregar as áreas quando o componente for montado
  // A array vazia [] garante que ele só é executado uma vez, no carregamento inicial
  useEffect(() => {
    if (projectSelected) {
      fetchAreas();
    }
  }, [projectSelected]);

  const handleAddArea = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!novaArea.trim()) {
      toast({ variant: "destructive", title: "Erro", description: "O nome da área não pode estar vazio." });
      return;
    }
    setIsLoading(true);
    try {
      const response = await fetch('/api/areas', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ nome: novaArea.trim() }),
      });
      const data = await response.json().catch(() => null);
      if (response.ok && (data?.ok || data?.success)) {
        await fetchAreas();
        setNovaArea('');
        toast({ title: "Sucesso!", description: "Área adicionada com sucesso." });
      } else {
        toast({ variant: "destructive", title: "Erro", description: data?.error || data?.message || "Erro ao adicionar área." });
      }
    } catch {
      toast({ variant: "destructive", title: "Erro", description: "Erro de conexão com o servidor." });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteArea = async (id: number) => {
    const areaToDelete = areas.find(a => a.id === id);
    if (!areaToDelete) return;

    if (!window.confirm('Tem certeza que deseja excluir esta área? Esta ação não pode ser desfeita.')) return;

    setIsLoading(true);
    try {
      const response = await fetch(`/api/areas/${id}`, {
        method: 'DELETE',
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
      });
      const data = await response.json().catch(() => null);
      if (response.ok && (data?.ok || data?.success)) {
        await fetchAreas();
        toast({ title: "Sucesso!", description: "Área excluída com sucesso." });
      } else {
        toast({ variant: "destructive", title: "Erro", description: data?.error || data?.message || "Erro ao excluir área." });
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
              Nenhum projeto selecionado.{' '}
              <a href="/" className="underline hover:no-underline font-medium">
                Voltar para a página inicial
              </a>{' '}
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
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Building2 className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold text-foreground">
                Gerenciar Áreas do Projeto
              </h1>
              <p className="text-muted-foreground mt-1">
                {projectName}
              </p>
            </div>
          </div>
          <div className="h-1 w-24 bg-gradient-to-r from-primary to-primary-glow rounded-full" />
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Add Area Form */}
          <Card className="shadow-sm border-0 bg-card/50 backdrop-blur-sm">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-xl">
                <FolderPlus className="h-5 w-5 text-primary" />
                Adicionar Nova Área
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAddArea} className="space-y-4">
                <div>
                  <Label htmlFor="area-name" className="text-sm font-medium">
                    Nome da Área
                  </Label>
                  <Input
                    id="area-name"
                    type="text"
                    value={novaArea}
                    onChange={(e) => setNovaArea(e.target.value)}
                    placeholder="Digite o nome da área..."
                    className="mt-1"
                    disabled={isLoading}
                  />
                </div>
                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={isLoading || !novaArea.trim()}
                >
                  {isLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                      Adicionando...
                    </>
                  ) : (
                    <>
                      <PlusCircle className="h-4 w-4 mr-2" />
                      Adicionar Área
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Areas List */}
          <Card className="shadow-sm border-0 bg-card/50 backdrop-blur-sm">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center justify-between text-xl">
                <span className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-primary" />
                  Áreas Cadastradas
                </span>
                <Badge variant="secondary" className="text-xs">
                  {areas.length} {areas.length === 1 ? 'área' : 'áreas'}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {areas.length > 0 ? (
                <div className="space-y-3">
                  {areas.map((area) => (
                    <div
                      key={area.id}
                      className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors group"
                    >
                      <span className="font-medium text-foreground">
                        {area.nome}
                      </span>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDeleteArea(area.id)}
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
                  <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground">
                    Nenhuma área cadastrada ainda.
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Adicione sua primeira área usando o formulário ao lado.
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

export default AreaManagement;