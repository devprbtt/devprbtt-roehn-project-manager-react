import type { Ambiente } from './project';

export interface CustomAcao {
  id?: number;
  target_guid: string;
  enable: boolean;
  level: number;
}

export interface Acao {
  id?: number;
  level: number;
  action_type: number;
  target_guid: string;
  custom_acoes: CustomAcao[];
}

export interface Cena {
  id: number;
  guid: string;
  nome: string;
  ambiente_id: number;
  acoes: Acao[];
  ambiente: Ambiente; // Adicionado para incluir os dados do ambiente
}

// Para criação e edição
export type CenaFormData = Omit<Cena, "id" | "guid" | "ambiente">;