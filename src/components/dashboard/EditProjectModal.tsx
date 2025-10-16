import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Save, X } from "lucide-react";
import type { Project, ProjectStatus } from '@/types/project';

type Props = {
  project?: Project;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (data: Partial<Project>) => void;
};

const EditProjectModal: React.FC<Props> = ({
  project,
  isOpen,
  onClose,
  onUpdate
}) => {
  const [name, setName] = useState(project?.nome || "");
  const [status, setStatus] = useState<ProjectStatus>(project?.status ?? "ATIVO");

  useEffect(() => {
    setName(project?.nome || "");
    setStatus(project?.status ?? "ATIVO");
  }, [project]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onUpdate({ nome: name.trim(), status }); // <-- envia status também
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl font-bold text-foreground">
              Editar Projeto
            </DialogTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="rounded-full hover:bg-muted"
              type="button"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="edit-name" className="text-sm font-semibold text-slate-700">
              Nome do Projeto
            </Label>
            <Input
              id="edit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-11 rounded-xl border-border focus:border-blue-500 focus:ring-blue-500/20"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-status" className="text-sm font-semibold text-slate-700">
              Status
            </Label>
            <select
              id="edit-status"
              className="h-11 w-full px-4 rounded-xl border border-border bg-background focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
              value={status}
              onChange={(e) => setStatus(e.target.value as ProjectStatus)}
            >
              <option value="ATIVO">Ativo</option>
              <option value="INATIVO">Inativo</option>
              <option value="CONCLUIDO">Concluído</option>
            </select>
          </div>

          <DialogFooter>
            <div className="flex gap-3 w-full">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                className="flex-1 h-11 rounded-xl border-border hover:bg-muted"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className="flex-1 h-11 bg-blue-600 hover:bg-blue-700 text-white rounded-xl flex items-center justify-center gap-2"
              >
                <Save className="w-4 h-4" />
                Salvar
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default EditProjectModal;
