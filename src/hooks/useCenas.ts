import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import type { Cena, CenaFormData } from "@/types/cena";

// Chave de query para cenas
const CENA_QUERY_KEY = "cenas";

// --- Funções da API ---

async function fetchAllCenas(): Promise<Cena[]> {
  const response = await fetch(`/api/cenas`);
  if (!response.ok) {
    throw new Error("Falha ao buscar cenas");
  }
  const data = await response.json();
  return data.cenas;
}

async function createCena(cenaData: CenaFormData): Promise<Cena> {
  const response = await fetch("/api/cenas", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(cenaData),
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || "Falha ao criar cena");
  }
  const data = await response.json();
  return data.cena;
}

async function updateCena({ id, ...cenaData }: { id: number } & Partial<CenaFormData>): Promise<Cena> {
  const response = await fetch(`/api/cenas/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(cenaData),
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || "Falha ao atualizar cena");
  }
  const data = await response.json();
  return data.cena;
}

async function deleteCena(id: number): Promise<void> {
  const response = await fetch(`/api/cenas/${id}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || "Falha ao excluir cena");
  }
}

// --- Hooks do React Query ---

export const useCenas = () => {
  return useQuery<Cena[], Error>({
    queryKey: [CENA_QUERY_KEY],
    queryFn: fetchAllCenas,
    staleTime: 1000 * 60 * 5, // 5 minutos
  });
};

export const useCreateCena = () => {
  const queryClient = useQueryClient();
  return useMutation<Cena, Error, CenaFormData>({
    mutationFn: createCena,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CENA_QUERY_KEY] });
      toast({ title: "Sucesso!", description: "Cena criada com sucesso." });
    },
    onError: (error) => {
      toast({
        title: "Erro",
        description: error.message || "Não foi possível criar a cena.",
        variant: "destructive",
      });
    },
  });
};

export const useUpdateCena = () => {
  const queryClient = useQueryClient();
  return useMutation<Cena, Error, { id: number } & Partial<CenaFormData>>({
    mutationFn: updateCena,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CENA_QUERY_KEY] });
      toast({ title: "Sucesso!", description: "Cena atualizada com sucesso." });
    },
    onError: (error) => {
      toast({
        title: "Erro",
        description: error.message || "Não foi possível atualizar a cena.",
        variant: "destructive",
      });
    },
  });
};

export const useDeleteCena = () => {
  const queryClient = useQueryClient();
  return useMutation<void, Error, { id: number }>({
    mutationFn: ({ id }) => deleteCena(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CENA_QUERY_KEY] });
      toast({ title: "Sucesso!", description: "Cena excluída com sucesso." });
    },
    onError: (error) => {
      toast({
        title: "Erro",
        description: error.message || "Não foi possível excluir a cena.",
        variant: "destructive",
      });
    },
  });
};