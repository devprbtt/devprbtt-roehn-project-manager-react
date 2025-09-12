import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Skeleton } from "@/components/ui/skeleton";
import ProjectCard from "./ProjectCard";

type Project = {
  id: number;
  nome: string;
};

type Props = {
  projects: Project[];
  currentProject?: Project;
  isLoading: boolean;
  onSelectProject: (project: Project) => void;
  onDeleteProject: (projectId: number) => void;
  onUpdateProject: (projectId: number, data: Partial<Project>) => void;
};

const ProjectGrid: React.FC<Props> = ({
  projects,
  currentProject,
  isLoading,
  onSelectProject,
  onDeleteProject,
  onUpdateProject
}) => {
  if (isLoading) {
    return (
      <div className="mb-12">
        <h3 className="text-2xl font-bold text-slate-900 mb-6">Seus Projetos</h3>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array(6).fill(0).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl p-6 shadow-sm">
              <Skeleton className="h-6 w-3/4 mb-3" />
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-4 w-2/3 mb-4" />
              <div className="flex gap-2">
                <Skeleton className="h-9 w-20" />
                <Skeleton className="h-9 w-16" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mb-12">
      <h3 className="text-2xl font-bold text-slate-900 mb-6">Seus Projetos</h3>
      {projects.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-16"
        >
          <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-3xl text-slate-400">📁</span>
          </div>
          <h4 className="text-xl font-semibold text-slate-900 mb-2">Nenhum projeto encontrado</h4>
          <p className="text-slate-600 max-w-md mx-auto">
            Comece criando seu primeiro projeto. Clique no botão "Novo Projeto" para começar.
          </p>
        </motion.div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence>
            {projects.map((project, index) => (
              <motion.div
                key={project.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ delay: index * 0.1 }}
              >
                <ProjectCard
                  project={project}
                  isCurrentProject={currentProject?.id === project.id}
                  onSelect={() => onSelectProject(project)}
                  onDelete={() => onDeleteProject(project.id)}
                  onUpdate={(data) => onUpdateProject(project.id, data)}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
};

export default ProjectGrid;