// src/types/project.ts
export type ProjectStatus = 'ATIVO' | 'INATIVO' | 'CONCLUIDO';

export type Project = {
  id: number;
  nome: string;
  status: ProjectStatus;
  selected?: boolean;
};

import { Cena } from './cena';

export interface Modulo {
  id: number;
  nome: string;
  tipo: string;
}

export interface Area {
  id: number;
  nome: string;
  ambientes: Ambiente[];
}

export interface Ambiente {
  id: number;
  nome: string;
  area: Area;
  circuitos: Circuito[];
  cenas: Cena[];
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

export interface ProjetoTree {
    projeto: {
        id: number;
        nome: string;
    },
    areas: Area[];
    modulos: Modulo[];
}
