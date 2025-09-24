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
  ATIVO: "border-emerald-500",
  INATIVO: "border-slate-300",
  CONCLUIDO: "border-amber-500",
};

const statusBadgeClass: Record<ProjectStatus, string> = {
  ATIVO: "bg-emerald-100 text-emerald-800",
  INATIVO: "bg-slate-100 text-slate-700",
  CONCLUIDO: "bg-amber-100 text-amber-800",
};

const statusTriangleClass: Record<ProjectStatus, string> = {
  ATIVO: "border-t-emerald-500",
  INATIVO: "border-t-slate-400",
  CONCLUIDO: "border-t-amber-500",
};

//const statusColors: Record<ProjectStatus, string> = {
//  ATIVO: 'border-green-500',
//  INATIVO: 'border-slate-300',
//  CONCLUIDO: 'border-blue-500',
//};


//const statusStyles: Record<
//  ProjectStatus,
//  { border: string; badge: string }
//> = {
//  Ativo: { border: "border-green-300", badge: "bg-green-100 text-green-800" },
//  Inativo: { border: "border-slate-300", badge: "bg-slate-100 text-slate-700" },
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
          className={`relative overflow-hidden transition-all duration-300 border-2 ${borderClass} ${
            isCurrentProject
              ? "bg-gradient-to-br from-blue-50 to-indigo-50 shadow-lg shadow-blue-500/10"
              : "bg-white hover:shadow-lg shadow-slate-900/5"
          }`}
        >
          {isCurrentProject && (
            <div className={`absolute top-0 right-0 w-0 h-0 border-l-[40px] border-l-transparent border-t-[40px] ${statusTriangleClass[project.status ?? "INATIVO"]}`}>
              <Crown className="absolute -top-8 -right-8 w-4 h-4 text-white transform rotate-45" />
            </div>
          )}

          <CardHeader className="pb-4">
            <div className="flex items-center gap-2 mb-2">
              <FolderOpen className="w-5 h-5 text-slate-600" />
              <h4 className="text-lg font-bold text-slate-900 truncate">{project.nome}</h4>
            </div>

            <div className="flex items-center gap-2 mt-2">
              {isCurrentProject && (
                <Badge className="bg-blue-500 text-white text-xs font-medium">
                  <Crown className="w-3 h-3 mr-1" />
                  Atual
                </Badge>
              )}
              <Badge className={`${badgeClass} text-xs font-medium`}>
                {project.status ?? "INATIVO"}
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="pt-0">
            <div className="flex gap-2">
              {!isCurrentProject ? (
                <Button
                  onClick={onSelect}
                  size="sm"
                  className="flex-1 bg-slate-900 hover:bg-slate-800 text-white rounded-xl h-9 text-xs font-medium"
                >
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  Selecionar
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 border-blue-200 text-blue-700 hover:bg-blue-50 rounded-xl h-9 text-xs font-medium"
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
                className="rounded-xl border-slate-200 hover:bg-slate-50 h-9 px-3"
              >
                <Edit3 className="w-3 h-3" />
              </Button>
              <Button
                onClick={handleDelete}
                size="sm"
                variant="outline"
                className="rounded-xl border-red-200 text-red-600 hover:bg-red-50 h-9 px-3"
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
