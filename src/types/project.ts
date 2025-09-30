// src/types/project.ts
export type ProjectStatus = 'ATIVO' | 'INATIVO' | 'CONCLUIDO';

export type Project = {
  id: number;
  nome: string;
  status: ProjectStatus;
  selected?: boolean;
};

export interface Area {
  id: number;
  nome: string;
}

export interface Ambiente {
  id: number;
  nome: string;
  area: Area;
}

export interface Circuito {
  id: number;
  identificador: string;
  nome: string;
  tipo: "luz" | "persiana" | "hvac";
  dimerizavel?: boolean;
  potencia?: number;
  ambiente: Ambiente;
  sak?: string | null;
}
