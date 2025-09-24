import React, { useEffect, useState, useMemo } from "react"; // Adicione useMemo
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/store/auth";
import Layout from "../components/Layout";
import CreateProjectForm from "@/components/dashboard/CreateProjectForm";
import ProjectGrid from "@/components/dashboard/ProjectGrid";
import CurrentProjectAlert from "@/components/dashboard/CurrentProjectAlert";
import ImportProjectSection from "@/components/dashboard/ImportProjectSection";
import NavigationGuide from "@/components/dashboard/NavigationGuide";
import type { Project, ProjectStatus } from '@/types/project';

import { Download, Plus, Search, Filter } from "lucide-react"; // Adicione Search e Filter



const Dashboard: React.FC = () => {

  const location = useLocation();
  const { user, loading: authLoading, fetchSession } = useAuth();  
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProject, setCurrentProject] = useState<Project | undefined>();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  // Novos estados para busca e filtro
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | "TODOS">("TODOS");

  // Filtrar projetos baseado na busca e filtro de status
  const filteredProjects = useMemo(() => {
    return projects.filter(project => {
      const matchesSearch = project.nome.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === "TODOS" || project.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [projects, searchTerm, statusFilter]);

  // Carregar projetos e projeto atual
  const loadProjects = async () => {
    setIsLoading(true);
    try {
      const projRes = await fetch("/api/projetos", { credentials: "include" });
      const projData = await projRes.json();
      if (projData.ok && Array.isArray(projData.projetos)) {
        setProjects(
          projData.projetos.map((p: any) => ({
            id: p.id,
            nome: p.nome,
            status: (p.status ?? 'ATIVO') as ProjectStatus,
            selected: !!p.selected,
          }))
        );
      }

      // Buscar o projeto atual
      const currentRes = await fetch("/api/projeto_atual", { credentials: "include" });
      const currentData = await currentRes.json();
      if (currentData.ok && currentData.projeto_atual) {
        const p = currentData.projeto_atual;
        setCurrentProject({
          id: p.id,
          nome: p.nome,
          status: (p.status ?? 'ATIVO') as ProjectStatus,
          selected: !!p.selected,
        });
      } else {
        setCurrentProject(undefined);
      }
    } catch (error) {
      // Trate o erro se necessário
    }
    setIsLoading(false);
  };

  useEffect(() => {
    // garante que a sessão foi checada quando entrar na página
    fetchSession();
  }, [fetchSession]);
  
  useEffect(() => {
    if (user) loadProjects();   // <— só carrega dados se já estiver logado
  }, [user]);

  // Função para exportar projeto em JSON
  const handleExportProject = async () => {
    if (!currentProject) return;
    
    setIsExporting(true);
    try {
      // CORREÇÃO: Usar a rota correta do backend sem o prefixo /api/
      const response = await fetch(`/exportar-projeto/${currentProject.id}`, {
        credentials: "include",
      });
      
      if (response.ok) {
        // Obter o nome do arquivo do header Content-Disposition
        const contentDisposition = response.headers.get('Content-Disposition');
        let filename = `projeto_${currentProject.nome}_${new Date().toISOString().split('T')[0]}.json`;
        
        if (contentDisposition) {
          const filenameMatch = contentDisposition.match(/filename="(.+)"/);
          if (filenameMatch) {
            filename = filenameMatch[1];
          }
        }
        
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.style.display = "none";
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        console.error("Falha ao exportar projeto");
        alert("Erro ao exportar projeto. Verifique se o projeto existe e tente novamente.");
      }
    } catch (error) {
      console.error("Erro ao exportar projeto:", error);
      alert("Erro ao exportar projeto. Tente novamente.");
    } finally {
      setIsExporting(false);
    }
  };

  // Criar novo projeto
  const handleProjectCreated = async (formData: { name: string; description?: string; status: string }) => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/projetos", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome: formData.name }),
      });
      const data = await res.json();
      if (data.ok) {
        // Seleciona automaticamente o projeto criado
        await fetch("/api/projeto_atual", {
          method: "PUT",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projeto_id: data.id }),
        });
        
        // Atualiza localmente sem recarregar tudo
        const newProject: Project = {
          id: data.id,
          nome: formData.name,
          status: 'ATIVO',
          selected: true,
        };
        setProjects(prev => [...prev, newProject]);
        setCurrentProject(newProject);
      }
    } catch (error) {}
    setShowCreateForm(false);
    setIsLoading(false);
  };

  // Selecionar projeto
  const handleSelectProject = async (project: Project) => {
    setIsLoading(true);
    try {
      await fetch("/api/projeto_atual", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projeto_id: project.id }),
      });
      
      // Atualiza localmente sem recarregar tudo
      // depois do fetch PUT, ao atualizar localmente
      setProjects(prev =>
        prev.map(p => ({
          ...p,
          selected: p.id === project.id,
        }))
      );
      // e garantir currentProject com status:
      setCurrentProject(prev => ({
        id: project.id,
        nome: project.nome,
        status: (project as any).status ?? 'ATIVO',
        selected: true,
      }));

    } catch (error) {}
    setIsLoading(false);
  };

  // Excluir projeto
  const handleDeleteProject = async (projectId: number) => {
    setIsLoading(true);
    try {
      await fetch(`/api/projetos/${projectId}`, {
        method: "DELETE",
        credentials: "include",
      });
      
      // Atualiza localmente sem recarregar tudo
      setProjects(prev => prev.filter(p => p.id !== projectId));
      
      // Se era o projeto atual, limpa a seleção
      if (currentProject?.id === projectId) {
        setCurrentProject(undefined);
      }
    } catch (error) {}
    setIsLoading(false);
  };

  // Atualizar projeto (nome e/ou status)
  const handleUpdateProject = async (projectId: number, data: Partial<Project>) => {
    await fetch(`/api/projetos/${projectId}`, {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nome: data.nome,
        status: data.status, // <— enviar status também
      }),
    });

    // Atualiza a lista
    setProjects(prev =>
      prev.map(p =>
        p.id === projectId
          ? {
              ...p,
              nome: data.nome ?? p.nome,
              status: (data.status as ProjectStatus | undefined) ?? p.status,
            }
          : p
      )
    );

    // Atualiza o projeto atual se for ele
    if (currentProject?.id === projectId) {
      setCurrentProject(prev =>
        prev
          ? {
              ...prev,
              nome: data.nome ?? prev.nome,
              status: (data.status as ProjectStatus | undefined) ?? prev.status,
            }
          : prev
      );
    }
  }; // <— ESSA CHAVE FALTAVA



  if (authLoading) {
    return (
      <Layout>
        <div className="min-h-[60vh] grid place-items-center">
          <div className="flex items-center gap-3 text-slate-600">
            <span className="animate-spin inline-block h-5 w-5 rounded-full border-2 border-slate-300 border-t-slate-600" />
            Verificando sessão...
          </div>
        </div>
      </Layout>
    );
  }
  // Se não logado, redireciona para login e guarda a rota atual
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }  
  return (
    <Layout projectSelected={!!currentProject} projectId={currentProject?.id}>
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 mb-10">
          <div>
            <h1 className="text-4xl font-bold text-slate-900 mb-2">
              Gerenciador de Projetos
            </h1>
            <p className="text-lg text-slate-600 max-w-2xl">
              Gerencie seus projetos com automação ROEHN. Cadastre ambientes, areas, circuitos e módulos e gere um relatório completo.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            {currentProject && (
              <button
                onClick={handleExportProject}
                disabled={isExporting}
                className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 flex items-center gap-3 disabled:opacity-50"
              >
                <Download className="w-5 h-5" />
                {isExporting ? 'Exportando...' : 'Exportar JSON'}
              </button>
            )}
            <button
              onClick={() => setShowCreateForm(true)}
              className="bg-slate-900 hover:bg-slate-800 text-white px-8 py-3 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 flex items-center gap-3"
            >
              <Plus className="w-5 h-5" />
              Novo Projeto
            </button>
          </div>
        </div>

        {/* Current Project Alert */}
        <CurrentProjectAlert currentProject={currentProject} />

        {/* Create Project Form */}
        {showCreateForm && (
          <CreateProjectForm 
            onSubmit={handleProjectCreated}
            onCancel={() => setShowCreateForm(false)}
          />
        )}

        {/* Search and Filter Bar */}
        <div className="mb-8 bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search Input */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Buscar projetos por nome..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            
            {/* Status Filter */}
            <div className="flex gap-2 items-center">
              <Filter className="text-slate-400 w-5 h-5" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as ProjectStatus | "TODOS")}
                className="px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="TODOS">Todos os status</option>
                <option value="ATIVO">Ativo</option>
                <option value="INATIVO">Inativo</option>
                <option value="CONCLUIDO">Concluído</option>
              </select>
            </div>
          </div>
          
          {/* Results Counter */}
          <div className="mt-4 text-sm text-slate-600">
            {filteredProjects.length} de {projects.length} projetos encontrados
            {searchTerm && (
              <span> para "{searchTerm}"</span>
            )}
            {statusFilter !== "TODOS" && (
              <span> com status {statusFilter.toLowerCase()}</span>
            )}
          </div>
        </div>

        {/* Projects Grid - Agora com scroll quando necessário */}
        <div className="mb-12 max-h-[70vh] overflow-y-auto pr-2">
          <ProjectGrid
            projects={filteredProjects}
            currentProject={currentProject}
            isLoading={isLoading}
            onSelectProject={handleSelectProject}
            onDeleteProject={handleDeleteProject}
            onUpdateProject={(projectId, data: Partial<Project>) =>
              handleUpdateProject(projectId, data)
            }
          />
        </div>

        {/* Import Section */}
        <ImportProjectSection onProjectImported={loadProjects} />

        {/* Navigation Guide */}
        {currentProject && <NavigationGuide />}
      </div>
    </Layout>
  );
};

export default Dashboard;