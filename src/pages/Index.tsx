import { useState, useEffect } from "react";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Edit, CheckCircle, Download, FolderPlus, FilePlus, Projector, FileUp, List, Folder } from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import { useProject } from "@/store/project";
import { useAuth } from "@/store/auth";
import { useNavigate } from "react-router-dom";

interface Projeto {
  id: number;
  nome: string;
}

const Index = () => {
  const navigate = useNavigate();                // <-- MOVIDO p/ dentro
  const { user } = useAuth();                    // <-- MOVIDO p/ dentro
  const { setProjeto, fetchProjeto } = useProject();

  const [projetos, setProjetos] = useState<Projeto[]>([]);
  const [projetoAtual, setProjetoAtual] = useState<{ id: number; nome: string } | null>(null);
  const [novoNomeProjeto, setNovoNomeProjeto] = useState("");
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingProjeto, setEditingProjeto] = useState<{ id: number; nome: string } | null>(null);
  const [importFile, setImportFile] = useState<File | null>(null);
  const { toast } = useToast();

  // Buscar projetos + projeto atual
  const fetchProjetos = async () => {
    try {
      const projetosResponse = await fetch("/api/projetos", { credentials: "same-origin" });
      const projetosData = await projetosResponse.json();
      setProjetos(projetosData.projetos || []);

      const atualResponse = await fetch("/api/projeto_atual", { credentials: "same-origin" });
      const atualData = await atualResponse.json();
      setProjetoAtual(atualData.projeto_atual || null);
    } catch (error) {
      console.error("Erro ao carregar projetos:", error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Não foi possível carregar a lista de projetos.",
      });
    }
  };

  useEffect(() => {
    fetchProjetos();
    fetchProjeto();
  }, []);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!novoNomeProjeto.trim()) {
      toast({ variant: "destructive", title: "Erro", description: "O nome do projeto não pode ser vazio." });
      return;
    }

    try {
      const res = await fetch("/api/projetos", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ nome: novoNomeProjeto }),
      });

      const data = await res.json().catch(() => null);

      if (res.ok && (data?.ok || data?.success)) {
        setNovoNomeProjeto("");

        // ⚡ Atualiza o store global (Navbar passa a habilitar as rotas)
        setProjeto({ id: data.id, nome: data.nome });

        // ⚡ (Opcional, mas bom) sincroniza com o backend lendo /api/projeto_atual
        await fetchProjeto();

        // Atualiza a lista e o selecionado local
        await fetchProjetos();

        toast({ title: "Sucesso!", description: "Projeto criado e selecionado." });
      } else {
        toast({
          variant: "destructive",
          title: "Erro",
          description: data?.error || data?.message || "Falha ao criar projeto.",
        });
      }
    } catch (error) {
      console.error("Erro ao criar projeto:", error);
      toast({ variant: "destructive", title: "Erro", description: "Falha ao se conectar com o servidor." });
    }
  };

  const handleSelecionarProjeto = async (id: number, nome: string) => {
    try {
      const res = await fetch("/api/projeto_atual", {
        method: "POST", // <- pode usar PUT também; ambos aceitos
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({ projeto_id: id }),
      });

      const data = await res.json().catch(() => null);
      if (res.ok && (data?.ok || data?.success)) {
        setProjeto({ id, nome });   // ⚡ atualiza o store global (Navbar habilita)
        await fetchProjeto();        // ⚡ confirma com backend
        toast({ title: "Sucesso!", description: `Projeto '${nome}' selecionado.` });
      } else {
        toast({ variant: "destructive", title: "Erro", description: data?.error || "Falha ao selecionar o projeto." });
      }
    } catch {
      toast({ variant: "destructive", title: "Erro", description: "Falha ao se conectar com o servidor." });
    }
  };

  const handleDeleteProjeto = async (id: number) => {
    if (!window.confirm("Tem certeza que deseja excluir este projeto?")) return;

    try {
      const res = await fetch(`/api/projetos/${id}`, {
        method: "DELETE",
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });

      // tenta ler json (sem quebrar se vier vazio)
      let data: any = null;
      try { data = await res.json(); } catch {}

      // sessão expirada → manda para login
      if (res.status === 401) {
        toast({ variant: "destructive", title: "Sessão expirada", description: "Faça login novamente." });
        navigate("/login");
        return;
      }

      // não é admin
      if (res.status === 403) {
        toast({ variant: "destructive", title: "Acesso negado", description: "Apenas administradores podem excluir projetos." });
        return;
      }

      // regras de negócio (se você optar por bloquear exclusão quando houver dependências)
      if (res.status === 409) {
        toast({ variant: "destructive", title: "Não foi possível excluir", description: data?.error || data?.message || "Remova as dependências antes de excluir." });
        return;
      }

      if (res.ok && (data?.ok || data?.success || data === null)) {
        // Se apagou justamente o projeto selecionado, zere estados locais/globais
        if (projetoAtual?.id === id) {
          setProjetoAtual(null); // estado local (Index)
          setProjeto(null);      // estado global (store do Navbar)
        }

        // Recarrega lista e sessão do projeto selecionado
        await fetchProjetos();
        await fetchProjeto(); // (GET /api/projeto_atual) para refletir a sessão do backend

        toast({ title: "Sucesso!", description: "Projeto excluído com sucesso." });
      } else {
        toast({
          variant: "destructive",
          title: "Erro ao excluir",
          description: data?.error || data?.message || "Falha ao excluir projeto.",
        });
      }
    } catch (err) {
      console.error("Erro ao excluir projeto:", err);
      toast({ variant: "destructive", title: "Erro de rede", description: "Falha ao se conectar com o servidor." });
    }
  };


  const openEditModal = (projeto: Projeto) => {
    setEditingProjeto(projeto);
    setEditModalOpen(true);
  };

  const saveProjectEdit = async () => {
    if (!editingProjeto || !editingProjeto.nome.trim()) {
      toast({ variant: "destructive", title: "Erro", description: "O nome do projeto não pode ser vazio." });
      return;
    }

    try {
      const formData = new FormData();
      formData.append('nome', editingProjeto.nome);
      const res = await fetch(`/api/projetos/${editingProjeto.id}`, {
        method: "PUT",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ nome: editingProjeto.nome }),
      });
      let data: any = null; try { data = await res.json(); } catch {}

      if (res.ok && (data?.ok || data?.success)) {
        await fetchProjetos();
        setEditModalOpen(false);
        toast({ title: "Sucesso!", description: "Nome do projeto atualizado." });
      } else {
        toast({ variant: "destructive", title: "Erro", description: data?.error || data?.message || "Falha ao editar projeto." });
      }
    } catch (error) {
      console.error("Erro ao editar projeto:", error);
      toast({ variant: "destructive", title: "Erro", description: "Falha ao se conectar com o servidor." });
    }
  };

  const handleImportFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setImportFile(e.target.files[0]);
    }
  };

  const handleImportarProjeto = async () => {
    if (!importFile) {
      toast({ variant: "destructive", title: "Erro", description: "Selecione um arquivo para importar." });
      return;
    }

    const formData = new FormData();
    formData.append('file', importFile);

    try {
      const response = await fetch('/import_roehn', {
        method: 'POST',
        body: formData,
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });
      let data: any = null; try { data = await response.json(); } catch {}

      if (response.ok && (data?.ok || data?.success)) {
        setImportFile(null);
        await fetchProjetos();
        toast({ title: "Sucesso!", description: "Projeto importado com sucesso." });
      } else {
        toast({ variant: "destructive", title: "Erro", description: data?.error || data?.message || "Erro na importação." });
      }
    } catch (error) {
      console.error("Erro ao importar projeto:", error);
      toast({ variant: "destructive", title: "Erro", description: "Falha ao se conectar com o servidor." });
    }
  };

  return (
    <Layout>
      <div className="container max-w-4xl mx-auto">
        <Card className="shadow-lg border-0 rounded-4">
          <CardHeader className="bg-background border-0">
            <h2 className="text-2xl font-bold text-primary">
              Bem-vindo ao Gerenciador de Projetos Roehn
            </h2>
          </CardHeader>
          <CardContent className="p-6">
            {projetoAtual && (
              <Alert className="mb-6 bg-info/10 border-info text-info">
                <Projector className="h-5 w-5 mr-3 text-info" />
                <AlertDescription className="text-info-foreground">
                  Projeto atual: <strong>{projetoAtual.nome}</strong>
                </AlertDescription>
              </Alert>
            )}

            <div className="mb-6">
              <h4 className="font-bold text-lg mb-3 text-muted-foreground">Gerenciar Projetos</h4>
              <Card className="shadow-sm border-0">
                <CardContent className="bg-muted/50 p-4">
                  <form onSubmit={handleCreateProject}>
                    <div className="flex gap-2 items-center">
                      <div className="flex-1 relative">
                        <FolderPlus className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-5 w-5" />
                        <Input
                          className="pl-10 h-10"
                          placeholder="Nome do novo projeto"
                          value={novoNomeProjeto}
                          onChange={(e) => setNovoNomeProjeto(e.target.value)}
                          required
                        />
                      </div>
                      <Button type="submit" className="px-6 h-10">
                        <FilePlus className="h-4 w-4 mr-2" />Criar
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </div>

            <div className="mb-6">
              <h5 className="font-bold mb-3 text-muted-foreground">Projetos Existentes</h5>
              {projetos.length > 0 ? (
                <div className="space-y-3">
                  {projetos.map(projeto => (
                    <div key={projeto.id} className="flex flex-wrap items-center justify-between p-3 border rounded-lg bg-background">
                      <div className="flex items-center flex-grow mb-2 sm:mb-0">
                        <Folder className="h-5 w-5 mr-3 text-muted-foreground" />
                        <span className="font-medium">{projeto.nome}</span>
                      </div>
                      <div className="flex gap-2">
                        {projetoAtual && projetoAtual.id === projeto.id ? (
                          <Badge className="bg-green-500 hover:bg-green-500/80">
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Selecionado
                          </Badge>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-green-600 border-green-600 hover:bg-green-50"
                            onClick={() => handleSelecionarProjeto(projeto.id, projeto.nome)}
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Selecionar
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openEditModal(projeto)}
                        >
                          <Edit className="h-4 w-4 mr-1" />
                          Editar
                        </Button>
                        <a
                          href={`/exportar_projeto/${projeto.id}`}
                          download
                          className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors h-8 px-3 border border-input bg-background hover:bg-accent hover:text-accent-foreground"
                        >
                          <Download className="h-4 w-4 mr-1" />Exportar
                        </a>
                        {user?.role === "admin" && (
                          <Button
                            variant="outline"
                            className="text-red-600 border-red-600 hover:bg-red-50"
                            onClick={() => handleDeleteProjeto(projeto.id)}
                            title="Excluir projeto (somente admin)"
                          >
                            Excluir
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-8">Nenhum projeto cadastrado ainda.</p>
              )}
            </div>

            <div className="mb-6">
              <h5 className="font-bold mb-3 text-muted-foreground">Importar Projeto</h5>
              <Alert className="mb-4 bg-yellow-50 border-yellow-200">
                <List className="h-5 w-5 mr-2 text-yellow-600" />
                <AlertDescription className="text-yellow-800">
                  <strong>Informação:</strong> Para importar um projeto, use um arquivo JSON exportado anteriormente através do botão "Exportar" na lista de projetos. O arquivo CSV é apenas para documentação e não pode ser usado para importação.
                </AlertDescription>
              </Alert>
              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  type="file"
                  accept=".json"
                  onChange={handleImportFileChange}
                  className="flex-1"
                />
                <Button
                  variant="default"
                  className="bg-primary hover:bg-primary/90 text-white"
                  onClick={handleImportarProjeto}
                >
                  <FileUp className="h-4 w-4 mr-2" />Importar Projeto (JSON)
                </Button>
              </div>
            </div>

            {projetoAtual && (
              <div>
                <h5 className="font-bold mb-3 text-muted-foreground">Navegação</h5>
                <p className="text-muted-foreground mb-3">Use o menu acima para navegar pelas diferentes seções do sistema:</p>
                <ul className="space-y-2">
                  <li className="flex items-center">
                    <List className="h-5 w-5 mr-2 text-blue-500" />
                    <strong>Áreas</strong>: Cadastre as áreas do projeto
                  </li>
                  <li className="flex items-center">
                    <List className="h-5 w-5 mr-2 text-yellow-500" />
                    <strong>Ambientes</strong>: Cadastre os ambientes dentro de cada área
                  </li>
                  <li className="flex items-center">
                    <List className="h-5 w-5 mr-2 text-red-500" />
                    <strong>Circuitos</strong>: Cadastre os circuitos com seus identificadores e tipos
                  </li>
                  <li className="flex items-center">
                    <List className="h-5 w-5 mr-2 text-green-500" />
                    <strong>Módulos</strong>: Cadastre os módulos disponíveis
                  </li>
                  <li className="flex items-center">
                    <List className="h-5 w-5 mr-2 text-blue-600" />
                    <strong>Vinculação</strong>: Associe os circuitos aos módulos e canais
                  </li>
                  <li className="flex items-center">
                    <List className="h-5 w-5 mr-2 text-gray-500" />
                    <strong>Visualizar Projeto</strong>: Veja o projeto completo e exporte para CSV
                  </li>
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Nome do Projeto</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="editProjectName">Novo Nome do Projeto</Label>
            <Input
              id="editProjectName"
              value={editingProjeto?.nome || ""}
              onChange={(e) => setEditingProjeto(prev =>
                prev ? { ...prev, nome: e.target.value } : null
              )}
              className="mt-2"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={saveProjectEdit}>
              Salvar Alterações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default Index;
