import { useEffect, useMemo, useState } from "react";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { useProject } from "@/store/project";
import {
  Link2,
  Trash2,
  Plug,
  PlusCircle,
  Zap,
  Boxes,
  Sparkles,
  RefreshCcw,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";

// Adicione estas interfaces e constantes no início do arquivo, após as importações

type EspecificacaoModulo = {
  correntePorCanal: number;
  grupos: { maxCorrente: number; canais: number[] }[];
};

const ESPECIFICACOES_MODULOS: Record<string, EspecificacaoModulo> = {
  RL12: {
    correntePorCanal: 2.5,
    grupos: [
      { maxCorrente: 8.0, canais: [1, 2, 3, 4] },
      { maxCorrente: 8.0, canais: [5, 6, 7, 8] },
      { maxCorrente: 8.0, canais: [9, 10, 11, 12] }
    ]
  },
  DIM8: {
    correntePorCanal: 2.5,
    grupos: [
      { maxCorrente: 8.0, canais: [1, 2, 3, 4] },
      { maxCorrente: 8.0, canais: [5, 6, 7, 8] }
    ]
  },
  LX4: {
    correntePorCanal: 2.5,
    grupos: [
      { maxCorrente: 5.0, canais: [1, 2, 3, 4] },
      { maxCorrente: 5.0, canais: [5, 6, 7, 8] }
    ]
  }
};

type RestricaoViolada = {
  tipo: 'canal' | 'grupo';
  mensagem: string;
  correnteAtual: number;
  correnteMaxima: number;
};

type Circuito = {
  id: number;
  identificador: string;
  nome: string;
  tipo: "luz" | "persiana" | "hvac";
  dimerizavel?: boolean;
  potencia?: number; // NOVO CAMPO
  area_nome?: string;
  ambiente_nome?: string;
  vinculado?: boolean;
};

type Modulo = {
  id: number;
  nome: string;
  tipo: string;
  canais_disponiveis: number[];
  quantidade_canais?: number;
};

type Vinculacao = {
  id: number;
  circuito_id: number;
  identificador: string;
  circuito_nome: string;
  area_nome: string;
  ambiente_nome: string;
  modulo_nome: string;
  modulo_tipo: string;
  canal: number;
};

export default function Vinculacao() {
  const { toast } = useToast();
  const { projeto } = useProject();
  const [projetoSelecionado, setProjetoSelecionado] = useState<boolean | null>(projeto ? true : null);
  const isLocked = projetoSelecionado !== true;
  // Mantém em sincronia com o store quando hidratar
  useEffect(() => {
    try { if (projeto) setProjetoSelecionado(true); } catch {}
  }, [projeto]);

  // Confirma na sessão quando ainda não sabemos
  useEffect(() => {
    const checkProject = async () => {
      try {
        if (projetoSelecionado !== null) return;
        const res = await fetch("/api/projeto_atual", { credentials: "same-origin" });
        const data = await res.json();
        setProjetoSelecionado(!!(data?.ok && data?.projeto_atual));
      } catch {
        setProjetoSelecionado(false);
      }
    };
    checkProject();
  }, [projetoSelecionado]);


  const [circuitos, setCircuitos] = useState<Circuito[]>([]);
  const [modulos, setModulos] = useState<Modulo[]>([]);
  const [vinculacoes, setVinculacoes] = useState<Vinculacao[]>([]);
  const [compat, setCompat] = useState<Record<"luz" | "persiana" | "hvac", string[]>>({ luz: [], persiana: [], hvac: [] });
  const [loading, setLoading] = useState(true);

  // form
  const [circuitoId, setCircuitoId] = useState<number | "">("");
  const [moduloId, setModuloId] = useState<number | "">("");
  const [canal, setCanal] = useState<number | "">("");
  const [tensao, setTensao] = useState<120 | 220>(120);


  const selectedCircuito = useMemo(
    () => circuitos.find((c) => c.id === circuitoId),
    [circuitoId, circuitos],
  );
  
  const modulosFiltrados = useMemo(() => {
    if (!selectedCircuito) return modulos;
    const compatList = compat[selectedCircuito.tipo] || [];
    if (compatList.length === 0) return modulos; // fallback: não filtra quando o backend não trouxe compat
    return modulos.filter(m => compatList.includes(m.tipo));
  }, [selectedCircuito, modulos, compat]);


  const selectedModulo = useMemo(
    () => modulos.find((m) => m.id === moduloId),
    [moduloId, modulos],
  );

  const canaisDisponiveis = useMemo(
    () => selectedModulo?.canais_disponiveis || [],
    [selectedModulo],
  );

  const circuitosNaoVinculados = useMemo(() => {
    const circuitosVinculadosIds = new Set(vinculacoes.map(v => v.circuito_id));
    return circuitos.filter(c => !circuitosVinculadosIds.has(c.id));
  }, [circuitos, vinculacoes]);

  const fetchAllData = async () => {
    if (projetoSelecionado !== true) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [optRes, listRes] = await Promise.all([
        fetch("/api/vinculacao/options", { credentials: "same-origin" }),
        fetch("/api/vinculacoes", { credentials: "same-origin" }),
      ]);

      const optData = await optRes.json();
      const listData = await listRes.json();

      if (optData?.ok || optData?.success) {
        setCircuitos(optData?.circuitos || []);
        setModulos(optData?.modulos || []);
        setCompat(optData?.compat || { luz: [], persiana: [], hvac: [] });
      }
      if (listData?.ok || listData?.success) {
        setVinculacoes(listData?.vinculacoes || []);
      }
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Falha ao carregar dados. Tente recarregar a página.",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, [projetoSelecionado]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!circuitoId || !moduloId || !canal) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Preencha todos os campos para vincular.",
      });
      return;
    }
    // Verificar restrições antes de criar
    const restricao = verificarRestricoes();
    const hadRestriction = Boolean(restricao);

    setLoading(true);
    try {
      const res = await fetch("/api/vinculacoes", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          circuito_id: circuitoId,
          modulo_id: moduloId,
          canal: canal,
        }),
      });

      const data = await res.json().catch(() => null);

      if (res.ok && (data?.ok || data?.success)) {
        setCircuitoId("");
        setModuloId("");
        setCanal("");
        await fetchAllData();
        toast({ title: "Sucesso!", description: "Circuito vinculado." });
        if (hadRestriction) {
          toast({
            title: "Vinculado com restrição",
            description: [
              "A vinculação foi criada com sucesso.",
              restricao?.mensagem ?? "Atenção aos limites elétricos deste módulo/canal/grupo.",
            ].join(" "),
            variant: "destructive", // ou "default" se preferir menos agressivo
            duration: 7000,
          });
        } else {
          toast({
            title: "Vinculação criada",
            description: "O circuito foi vinculado ao módulo/canal selecionado.",
            duration: 3500,
          });
        }

      } else {
        toast({
          variant: "destructive",
          title: "Erro",
          description: data?.error || data?.message || "Falha ao vincular circuito.",
        });
      }
    } catch {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Falha ao se conectar ao servidor.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Tem certeza que deseja excluir esta vinculação?")) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/vinculacoes/${id}`, {
        method: "DELETE",
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });

      const data = await res.json().catch(() => null);

      if (res.ok && (data?.ok || data?.success)) {
        await fetchAllData();
        toast({ title: "Sucesso!", description: "Vinculação excluída." });
      } else {
        toast({
          variant: "destructive",
          title: "Erro",
          description: data?.error || data?.message || "Falha ao excluir vinculação.",
        });
      }
    } catch {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Falha ao se conectar ao servidor.",
      });
    } finally {
      setLoading(false);
    }
  };

  const getTipoBadge = (tipo: string) => {
    switch (tipo) {
      case "luz":
        return { label: "💡 Luz", color: "bg-yellow-100 text-yellow-800" };
      case "persiana":
        return { label: "🪟 Persiana", color: "bg-blue-100 text-blue-800" };
      case "hvac":
        return { label: "❄️ HVAC", color: "bg-green-100 text-green-800" };
      default:
        return { label: tipo, color: "bg-slate-100 text-slate-800" };
    }
  };

  // Dentro do componente Vinculacao, antes do return

  const calcularCorrente = (potencia?: number): number => {
    if (!potencia || potencia <= 0) return 0;
    const V = tensao || 220; // usa a tensão selecionada
    return potencia / V;
  };


  const verificarRestricoes = (): RestricaoViolada | null => {
    if (!selectedCircuito || !selectedModulo || !canal) return null;

    const especificacao = ESPECIFICACOES_MODULOS[selectedModulo.tipo];
    if (!especificacao) return null;

    const correnteCircuito = calcularCorrente(selectedCircuito.potencia);

    // Verificar restrição por canal individual
    if (correnteCircuito > especificacao.correntePorCanal) {
      return {
        tipo: 'canal',
        mensagem: `Corrente do circuito (${correnteCircuito.toFixed(2)}A) excede o máximo do canal (${especificacao.correntePorCanal}A)`,
        correnteAtual: correnteCircuito,
        correnteMaxima: especificacao.correntePorCanal
      };
    }

    // Verificar restrição por grupo
    const grupo = especificacao.grupos.find(g => g.canais.includes(canal as number));
    if (grupo) {
      // Calcular corrente total do grupo
      const vinculacoesDoModulo = vinculacoes.filter(v => 
        v.modulo_tipo === selectedModulo.tipo && 
        grupo.canais.includes(v.canal)
      );

      let correnteTotalGrupo = vinculacoesDoModulo.reduce((total, v) => {
        const circuito = circuitos.find(c => c.id === v.circuito_id);
        return total + (circuito ? calcularCorrente(circuito.potencia) : 0);
      }, 0);

      // Adicionar o circuito atual que está sendo vinculado
      correnteTotalGrupo += correnteCircuito;

      if (correnteTotalGrupo > grupo.maxCorrente) {
        return {
          tipo: 'grupo',
          mensagem: `Corrente total do grupo (${correnteTotalGrupo.toFixed(2)}A) excede o máximo permitido (${grupo.maxCorrente}A)`,
          correnteAtual: correnteTotalGrupo,
          correnteMaxima: grupo.maxCorrente
        };
      }
    }

    return null;
  };

  const obterInfoRestricoes = (moduloTipo: string): string => {
    const especificacao = ESPECIFICACOES_MODULOS[moduloTipo];
    if (!especificacao) return '';

    const gruposInfo = especificacao.grupos.map((grupo, index) => 
      `Grupo ${index + 1} (canais ${grupo.canais.join(',')}): máximo ${grupo.maxCorrente}A`
    ).join('; ');

    return `${especificacao.correntePorCanal}A por canal; ${gruposInfo}`;
  };  
  const restricao = verificarRestricoes();

  return (
    <Layout projectSelected={projetoSelecionado === true}>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 mb-10">
            <div>
              <div className="flex items-center gap-4 mb-4">
                <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-3xl flex items-center justify-center shadow-lg shadow-blue-500/25">
                  <Link2 className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h1 className="text-4xl font-bold text-slate-900 mb-2">Gerenciar Vinculações</h1>
                  <p className="text-lg text-slate-600 max-w-2xl">
                    Conecte circuitos aos canais de seus módulos físicos.
                  </p>
                </div>
              </div>
              <div className="h-1 w-32 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full shadow-sm" />
            </div>
            <Button
              onClick={fetchAllData}
              variant="outline"
              className="group flex items-center gap-2 h-12 px-6 rounded-full border-slate-200 text-slate-600 hover:text-slate-900 transition-all duration-300"
            >
              <RefreshCcw className="h-4 w-4 group-hover:rotate-180 transition-transform duration-500" />
              Recarregar
            </Button>
          </div>

          {projetoSelecionado === false && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
              <Alert className="bg-amber-50 border-amber-200 shadow-sm">
                <Sparkles className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-amber-800">
                  Selecione um projeto na página inicial para gerenciar as vinculações.
                </AlertDescription>
              </Alert>
            </motion.div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}>
              <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-xl shadow-slate-900/5">
                <CardHeader className="pb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center shadow-lg">
                      <Plug className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-2xl font-bold text-slate-900">Nova Vinculação</CardTitle>
                      <p className="text-slate-600 mt-1">Conecte um circuito a um módulo</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleCreate} className="space-y-6">
                    <div>
                      <Label htmlFor="circuito" className="text-sm font-semibold text-slate-700">
                        Circuito *
                      </Label>
                      <select
                        id="circuito"
                        value={circuitoId as any}
                        onChange={(e) => {
                          setCircuitoId(Number(e.target.value));
                          setModuloId("");
                          setCanal("");
                        }}
                        required
                        className="mt-2 h-12 w-full px-4 rounded-xl border border-slate-200 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                        disabled={isLocked || loading || circuitosNaoVinculados.length === 0}
                      >
                        <option value="">{loading ? "Carregando circuitos..." : "Selecione um circuito"}</option>
                        {!loading && circuitosNaoVinculados.map((c) => {
                          const corrente = calcularCorrente(c.potencia);
                          return (
                            <option key={c.id} value={c.id}>
                              {c.identificador} — {c.nome} ({c.ambiente_nome}) - {c.potencia}W ({corrente.toFixed(2)}A)
                            </option>
                          );
                        })}
                      </select>
                      {!loading && projetoSelecionado && circuitosNaoVinculados.length === 0 && (
                        <p className="text-sm text-amber-600 mt-1 flex items-center gap-1">
                          <Sparkles className="w-3 h-3" />
                          Nenhum circuito disponível para vincular.
                        </p>
                      )}
                    </div>
                    <div className="mt-2">
                      <Label htmlFor="tensao" className="text-sm font-semibold text-slate-700">
                        Tensão de Cálculo *
                      </Label>
                      <select
                        id="tensao"
                        value={tensao}
                        onChange={(e) => setTensao(Number(e.target.value) as 120 | 220)}
                        className="mt-2 h-12 w-full px-4 rounded-xl border border-slate-200 bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                        disabled={isLocked || loading}
                      >
                        <option value={220}>220 V</option>
                        <option value={120}>120 V</option>
                      </select>
                      {selectedCircuito && (
                        <p className="text-xs text-slate-600 mt-2">
                          Potência do circuito: {selectedCircuito.potencia ?? 0} W • Corrente estimada:{" "}
                          {(() => {
                            const a = calcularCorrente(selectedCircuito.potencia);
                            return a ? `${a.toFixed(2)} A @ ${tensao} V` : "—";
                          })()}
                        </p>
                      )}
                    </div>

                    <div className="mt-2">
                      <Label htmlFor="modulo" className="text-sm font-semibold text-slate-700">
                        Módulo *
                      </Label>
                      <select
                        id="modulo"
                        value={moduloId as any}
                        onChange={(e) => {
                          setModuloId(Number(e.target.value));
                          setCanal("");
                        }}
                        required
                        className="mt-2 h-12 w-full px-4 rounded-xl border border-slate-200 bg-white focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all"
                        disabled={isLocked || loading || modulosFiltrados.length === 0}
                      >
                        <option value="">{loading ? "Carregando módulos..." : "Selecione um módulo"}</option>
                        {!loading && modulosFiltrados.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.nome} ({m.tipo} - {m.quantidade_canais} canais)
                          </option>
                        ))}
                      </select>
                      {selectedModulo && ESPECIFICACOES_MODULOS[selectedModulo.tipo] && (
                        <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                          <p className="text-sm text-blue-800 font-medium">
                            ⚡ Restrições: {obterInfoRestricoes(selectedModulo.tipo)}
                          </p>
                        </div>
                      )}
                      {!loading && projetoSelecionado && modulosFiltrados.length === 0 && (
                        <p className="text-sm text-amber-600 mt-1 flex items-center gap-1">
                          <Sparkles className="w-3 h-3" />
                          Nenhum módulo disponível para vincular.
                        </p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="canal" className="text-sm font-semibold text-slate-700">
                        Canal *
                      </Label>
                      <select
                        id="canal"
                        value={canal as any}
                        onChange={(e) => setCanal(Number(e.target.value))}
                        required
                        className="mt-2 h-12 w-full px-4 rounded-xl border border-slate-200 bg-white focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all"
                        disabled={!selectedModulo || canaisDisponiveis.length === 0}
                      >
                        <option value="">Selecione um canal</option>
                        {!loading && canaisDisponiveis.map((c) => (
                          <option key={c} value={c}>
                            Canal {c}
                          </option>
                        ))}
                      </select>
                      {!selectedModulo && (
                        <p className="text-sm text-slate-500 mt-1">Selecione um módulo para ver os canais.</p>
                      )}
                    </div>
                    <Button
                      type="submit"
                      className={`w-full h-12 ${
                        restricao 
                          ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600' 
                          : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700'
                      } text-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center gap-2`}
                      disabled={isLocked || loading || !selectedCircuito || !selectedModulo || canaisDisponiveis.length === 0}
                    >
                      <Plug className="h-5 w-5" />
                      {restricao ? 'Vincular (Com Restrição)' : 'Vincular Circuito'}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}>
              <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-xl shadow-slate-900/5">
                <CardHeader className="pb-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg">
                        <Link2 className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <CardTitle className="text-2xl font-bold text-slate-900">Vinculações Cadastradas</CardTitle>
                        <p className="text-slate-600 mt-1">Lista de todas as vinculações do projeto</p>
                      </div>
                    </div>
                    <Badge className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white text-sm font-medium px-3 py-1">
                      {vinculacoes.length} {vinculacoes.length === 1 ? "vinculação" : "vinculações"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="flex flex-col justify-center items-center py-12">
                      <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent mb-4"></div>
                      <p className="text-slate-600 font-medium">Carregando vinculações...</p>
                    </div>
                  ) : vinculacoes.length === 0 ? (
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center py-12">
                      <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Link2 className="h-10 w-10 text-slate-400" />
                      </div>
                      <h4 className="text-xl font-semibold text-slate-900 mb-2">
                        {projetoSelecionado === true ? "Nenhuma vinculação cadastrada" : "Selecione um projeto"}
                      </h4>
                      <p className="text-slate-600 max-w-sm mx-auto">
                        {projetoSelecionado
                          ? "Comece adicionando a primeira vinculação usando o formulário ao lado."
                          : "Selecione um projeto para visualizar e gerenciar as vinculações."}
                      </p>
                    </motion.div>
                  ) : (
                    <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
                      <AnimatePresence>
                        {vinculacoes.map((v, index) => {
                          const badge = getTipoBadge(v.modulo_tipo);
                          return (
                            <motion.div
                              key={v.id}
                              initial={{ opacity: 0, y: 20 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -20 }}
                              transition={{ delay: index * 0.05 }}
                              className="group relative overflow-hidden rounded-2xl border border-slate-200/60 bg-white/60 backdrop-blur-sm p-4 hover:bg-white/80 hover:shadow-lg hover:shadow-slate-900/5 transition-all duration-300"
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex-1 mr-4">
                                  <div className="flex items-center gap-3 mb-2">
                                    <Badge className={`text-xs font-medium px-2 py-1 ${badge.color}`}>
                                      {badge.label.toUpperCase()}
                                    </Badge>
                                    <span className="text-sm font-mono text-slate-500 bg-slate-100 px-2 py-1 rounded-lg">
                                      Canal {v.canal}
                                    </span>
                                  </div>
                                  <h4 className="font-bold text-slate-900 text-lg mb-1">{v.circuito_nome}</h4>
                                  <p className="text-sm text-slate-600 mb-1">
                                    <span className="font-medium">Identificador:</span> {v.identificador}
                                  </p>
                                  <p className="text-sm text-slate-600 mb-1">
                                    <span className="font-medium">Módulo:</span> {v.modulo_nome}
                                  </p>
                                  <p className="text-sm text-slate-500">
                                    {v.area_nome} &gt; {v.ambiente_nome}
                                  </p>
                                </div>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => handleDelete(v.id)}
                                  disabled={loading}
                                  className="opacity-0 group-hover:opacity-100 transition-all duration-300 rounded-xl shadow-lg hover:shadow-xl"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </motion.div>
                          );
                        })}
                      </AnimatePresence>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </div>
    </Layout>
  );
}