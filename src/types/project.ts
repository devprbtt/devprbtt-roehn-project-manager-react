// src/types/project.ts
export type ProjectStatus = 'ATIVO' | 'INATIVO' | 'CONCLUIDO';

export type Project = {
  id: number;
  nome: string;
  status: ProjectStatus;
  selected?: boolean;
};
