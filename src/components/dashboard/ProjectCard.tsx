import React, { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  Edit3,
  Trash2,
  FolderOpen,
  Crown,
} from "lucide-react";
import EditProjectModal from "./EditProjectModal";
import { motion } from "framer-motion";
import type { Project, ProjectStatus } from '@/types/project';

type Props = {
  project: Project;
  isCurrentProject?: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onUpdate: (data: Partial<Project>) => void;
};

const statusBorderClass: Record<ProjectStatus, string> = {
  ATIVO: "border-emerald-500/60",
  INATIVO: "border-muted/60",
  CONCLUIDO: "border-amber-500/60",
};

const statusBadgeClass: Record<ProjectStatus, string> = {
  ATIVO: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-200 dark:bg-emerald-500/20",
  INATIVO: "bg-muted text-muted-foreground dark:bg-muted/40 dark:text-muted-foreground",
  CONCLUIDO: "bg-amber-500/10 text-amber-700 dark:text-amber-200 dark:bg-amber-500/20",
};

const statusTriangleClass: Record<ProjectStatus, string> = {
  ATIVO: "border-t-emerald-500",
  INATIVO: "border-t-slate-400",
  CONCLUIDO: "border-t-amber-500",
};

//const statusColors: Record<ProjectStatus, string> = {
//  ATIVO: 'border-green-500',
//  INATIVO: 'border-border',
//  CONCLUIDO: 'border-blue-500',
//};


//const statusStyles: Record<
//  ProjectStatus,
//  { border: string; badge: string }
//> = {
//  Ativo: { border: "border-green-300", badge: "bg-green-100 text-green-800" },
//  Inativo: { border: "border-border", badge: "bg-muted text-slate-700" },
//  "Concluído": { border: "border-amber-300", badge: "bg-amber-100 text-amber-800" },
//};

const ProjectCard: React.FC<Props> = ({
  project,
  isCurrentProject,
  onSelect,
  onDelete,
  onUpdate,
}) => {
  const [showEditModal, setShowEditModal] = useState(false);

  const handleDelete = () => {
    if (window.confirm(`Tem certeza que deseja excluir o projeto "${project.nome}"?`)) {
      onDelete();
    }
  };

  const borderClass = statusBorderClass[project.status ?? "INATIVO"];
  const badgeClass = statusBadgeClass[project.status ?? "INATIVO"];

  return (
    <>
      <motion.div whileHover={{ y: -4, scale: 1.02 }} transition={{ duration: 0.2 }}>
        <Card
          className={`relative overflow-hidden transition-all duration-300 border ${borderClass} ${
            isCurrentProject
              ? "bg-gradient-to-br from-primary/15 via-primary/10 to-primary/5 dark:from-primary/25 dark:via-primary/15 dark:to-primary/10 shadow-lg shadow-primary/15"
              : "bg-card hover:shadow-lg shadow-primary/5"
          }`}
        >
          {isCurrentProject && (
            <div className={`absolute top-0 right-0 w-0 h-0 border-l-[40px] border-l-transparent border-t-[40px] ${statusTriangleClass[project.status ?? "INATIVO"]}`}>
              <Crown className="absolute -top-8 -right-8 w-4 h-4 text-primary-foreground transform rotate-45" />
            </div>
          )}

          <CardHeader className="pb-4">
            <div className="flex items-center gap-2 mb-2">
              <FolderOpen className="w-5 h-5 text-muted-foreground" />
              <h4 className="text-lg font-bold text-foreground truncate">{project.nome}</h4>
            </div>

            <div className="flex items-center gap-2 mt-2">
              {isCurrentProject && (
                <Badge className="bg-primary text-primary-foreground text-xs font-medium">
                  <Crown className="w-3 h-3 mr-1" />
                  Atual
                </Badge>
              )}
              <Badge className={`${badgeClass} text-xs font-medium`}>
                {project.status ?? "INATIVO"}
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="pt-4">
            <div className="border-t border-border pt-4">
              <div className="text-xs text-muted-foreground space-y-2">
                {project.data_criacao && (
                  <p><b>Criação:</b> {new Date(project.data_criacao).toLocaleDateString()}</p>
                )}
                {project.status === 'ATIVO' && project.data_ativo && (
                  <p><b>Ativo desde:</b> {new Date(project.data_ativo).toLocaleDateString()}</p>
                )}
                {project.status === 'INATIVO' && project.data_inativo && (
                  <p><b>Inativo desde:</b> {new Date(project.data_inativo).toLocaleDateString()}</p>
                )}
                {project.status === 'CONCLUIDO' && project.data_concluido && (
                  <p><b>Concluído em:</b> {new Date(project.data_concluido).toLocaleDateString()}</p>
                )}
              </div>
            </div>

            <div className="flex gap-2 mt-4">
              {!isCurrentProject ? (
                <Button
                  onClick={onSelect}
                  size="sm"
                  className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl h-9 text-xs font-medium"
                >
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  Selecionar
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 border-primary/40 text-primary hover:bg-primary/10 rounded-xl h-9 text-xs font-medium"
                  disabled
                >
                  <Crown className="w-3 h-3 mr-1" />
                  Selecionado
                </Button>
              )}
              <Button
                onClick={() => setShowEditModal(true)}
                size="sm"
                variant="outline"
                className="rounded-xl border-border text-foreground hover:bg-muted h-9 px-3"
              >
                <Edit3 className="w-3 h-3" />
              </Button>
              <Button
                onClick={handleDelete}
                size="sm"
                variant="outline"
                className="rounded-xl border-red-300 text-red-600 hover:bg-red-500/10 h-9 px-3 dark:border-red-500/40 dark:text-red-300"
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <EditProjectModal
        project={project}
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        onUpdate={onUpdate}
      />
    </>
  );
};

export default ProjectCard;
