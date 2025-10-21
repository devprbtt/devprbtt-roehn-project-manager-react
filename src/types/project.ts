// src/types/project.ts
export type ProjectStatus = 'ATIVO' | 'INATIVO' | 'CONCLUIDO';

export type Project = {
  id: number;
  nome: string;
  status: ProjectStatus;
  selected?: boolean;
  data_criacao: string | null;
  data_ativo: string | null;
  data_inativo: string | null;
  data_concluido: string | null;
};

import { Cena } from './cena';

export interface Modulo {
  id: number;
  nome: string;
  tipo: string;
  hsnet?: number;
  quantidade_canais: number;
  vinc_count?: number;
  quadro_eletrico?: {
    id: number;
    nome: string;
  };
  is_controller: boolean;
  is_logic_server: boolean;
  ip_address?: string;
  parent_controller_id?: number | null;
  parent_controller?: {
    id: number;
    nome: string;
  } | null;
}

export interface QuadroEletrico {
  id: number;
  nome: string;
  modulos: {
    id: number;
    nome: string;
    tipo: string;
    quantidade_canais: number;
  }[];
}

export interface Area {
  id: number;
  nome: string;
  ambientes: Ambiente[];
}

export interface Ambiente {
  id: number;
  nome: string;
  area?: Area;
  circuitos: Circuito[];
  cenas: Cena[];
  quadros_eletricos?: QuadroEletrico[];
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
  vinculacao?: {
    modulo_nome: string;
    canal: number;
  } | null;
}

export interface KeypadButton {
    id: number;
    ordem: number;
    circuito_id: number | null;
    cena_id: number | null;
}

export interface Keypad {
    id: number;
    nome: string;
    hsnet: number;
    button_count: number;
    buttons: KeypadButton[];
    ambiente?: { id: number; nome: string; area?: { id: number; nome: string } };
}

export interface ProjetoTree {
    projeto: {
        id: number;
        nome: string;
    },
    areas: Area[];
    modulos: Modulo[];
}
