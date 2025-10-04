import { useEffect, useMemo, useState, useCallback, useRef } from "react";
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
  modulo_id: number; // ← ADICIONE ESTE CAMPO
  canal: number;
  potencia?: number;
};

// Adicione estas interfaces após as existentes
type UtilizacaoGrupo = {
  grupo: { maxCorrente: number; canais: number[] };
  correnteAtual: number;
  porcentagem: number;
  canaisUtilizados: number[];
};

type BarraProgressoGrupoProps = {
  utilizacao: UtilizacaoGrupo;
  index: number;
  canalSelecionado?: number;
};

// Componente da barra de progresso
const BarraProgressoGrupo = ({ utilizacao, index, canalSelecionado }: BarraProgressoGrupoProps) => {
  const { grupo, correnteAtual, porcentagem, canaisUtilizados } = utilizacao;
  
  // Determinar cor baseada na porcentagem
  const getCorBarra = (porcentagem: number) => {
    if (porcentagem <= 60) return 'bg-green-500';
    if (porcentagem <= 80) return 'bg-yellow-500';
    if (porcentagem <= 95) return 'bg-orange-500';
    return 'bg-red-500';
  };

  const corBarra = getCorBarra(porcentagem);
  const canalNoGrupo = canalSelecionado && grupo.canais.includes(canalSelecionado);

  return (
    <motion.div 
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.1 }}
      className={`p-4 rounded-xl border-2 transition-all duration-300 ${
        canalNoGrupo 
          ? 'border-blue-300 bg-blue-50 shadow-sm' 
          : 'border-slate-200 bg-white'
      }`}
    >
      <div className="flex justify-between items-center mb-3">
        <span className="text-sm font-semibold text-slate-800">
          Grupo {index + 1} • Canais {grupo.canais.join(', ')}
        </span>
        <span className={`text-xs font-bold px-2 py-1 rounded-full ${
          porcentagem > 80 ? 'bg-red-100 text-red-700' : 
          porcentagem > 60 ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'
        }`}>
          {correnteAtual.toFixed(2)}A / {grupo.maxCorrente}A
        </span>
      </div>
      
      {/* Barra de progresso principal */}
      <div className="w-full bg-slate-200 rounded-full h-3 mb-3 overflow-hidden">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(porcentagem, 100)}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className={`h-3 rounded-full ${corBarra}`}
        />
      </div>

      {/* Canais utilizados */}
      <div className="flex items-center justify-between">
        <div className="flex flex-wrap gap-1">
          {grupo.canais.map(canal => {
            const utilizado = canaisUtilizados.includes(canal);
            const selecionado = canal === canalSelecionado;
            
            return (
              <div
                key={canal}
                className={`w-7 h-7 rounded-lg text-xs flex items-center justify-center font-medium transition-all ${
                  selecionado
                    ? 'bg-blue-500 text-white ring-2 ring-blue-300 shadow-sm'
                    : utilizado
                    ? 'bg-slate-600 text-white shadow-sm'
                    : 'bg-slate-200 text-slate-600'
                }`}
                title={`Canal ${canal} - ${utilizado ? 'Utilizado' : 'Disponível'}${
                  selecionado ? ' - Selecionado' : ''
                }`}
              >
                {canal}
              </div>
            );
          })}
        </div>

        {/* Aviso se o canal selecionado está neste grupo */}
        {canalNoGrupo && (
          <div className="text-xs text-blue-600 font-medium flex items-center gap-1">
            <Zap className="w-3 h-3" />
            Afetado
          </div>
        )}
      </div>
    </motion.div>
  );
};

const SecaoUtilizacaoAnimada = ({ 
  children, 
  visivel 
}: { 
  children: React.ReactNode; 
  visivel: boolean;
}) => {
  return (
    <AnimatePresence>
      {visivel && (
        <motion.div
          initial={{ opacity: 0, height: 0, y: -10 }}
          animate={{ opacity: 1, height: "auto", y: 0 }}
          exit={{ opacity: 0, height: 0, y: -10 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="overflow-hidden"
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
};


export default function Vinculacao() {
  const { toast } = useToast();
  const { projeto } = useProject();
  
  // Estados básicos primeiro
  const [projetoSelecionado, setProjetoSelecionado] = useState<boolean | null>(projeto ? true : null);
  const [circuitos, setCircuitos] = useState<Circuito[]>([]);
  const [modulos, setModulos] = useState<Modulo[]>([]);
  const [vinculacoes, setVinculacoes] = useState<Vinculacao[]>([]);
  const [compat, setCompat] = useState<Record<"luz" | "persiana" | "hvac", string[]>>({ luz: [], persiana: [], hvac: [] });
  const [loading, setLoading] = useState(true);
  const [circuitoId, setCircuitoId] = useState<number | "">("");
  const [moduloId, setModuloId] = useState<number | "">("");
  const [canal, setCanal] = useState<number | "">("");
  const [tensao, setTensao] = useState<120 | 220>(120);
  const [modalRestricao, setModalRestricao] = useState<{
    aberto: boolean;
    restricao: RestricaoViolada | null;
    dadosVinculacao: { circuitoId: number; moduloId: number; canal: number } | null;
  }>({
    aberto: false,
    restricao: null,
    dadosVinculacao: null
  });
  const [quadrosEletricos, setQuadrosEletricos] = useState<any[]>([]);
  const [vinculacaoAutoLoading, setVinculacaoAutoLoading] = useState(false);
  const isLocked = projetoSelecionado !== true;
  
  // Refs para controle
  const fetchingRef = useRef(false);
  const initialLoadRef = useRef(false);

  // 1. Primeiro definimos as funções básicas que não dependem de outros hooks
  const getTipoBadge = useCallback((tipo: string) => {
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
  }, []);

  const obterInfoRestricoes = useCallback((moduloTipo: string): JSX.Element => {
    const especificacao = ESPECIFICACOES_MODULOS[moduloTipo];
    if (!especificacao) return <></>;

    return (
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
          <span><strong>{especificacao.correntePorCanal}A</strong> por canal individual</span>
        </div>
        {especificacao.grupos.map((grupo, index) => (
          <div key={index} className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span>
              <strong>Grupo {index + 1}</strong> (canais {grupo.canais.join(', ')}): máximo {grupo.maxCorrente}A
            </span>
          </div>
        ))}
      </div>
    );
  }, []);

  // 2. Funções de cálculo que dependem apenas de estados básicos
  const calcularCorrente = useCallback((potencia?: number): number => {
    if (!potencia || potencia <= 0) return 0;
    const V = tensao || 220;
    return potencia / V;
  }, [tensao]);

  // 3. Memoized values básicos
  const selectedCircuito = useMemo(
    () => circuitos.find((c) => c.id === circuitoId),
    [circuitoId, circuitos],
  );
  
  const modulosFiltrados = useMemo(() => {
    if (!selectedCircuito) return modulos;
    const compatList = compat[selectedCircuito.tipo] || [];
    if (compatList.length === 0) return modulos;
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

  // 4. Funções que dependem dos memoized values básicos
  const calcularUtilizacaoGrupos = useCallback((modulo: Modulo | undefined, circuitoAtual?: Circuito, canalAtual?: number): UtilizacaoGrupo[] => {
    if (!modulo) return [];
    
    const especificacao = ESPECIFICACOES_MODULOS[modulo.tipo];
    if (!especificacao) return [];

    return especificacao.grupos.map(grupo => {
      // FILTRAR PELO ID ESPECÍFICO DO MÓDULO, não apenas pelo tipo
      const vinculacoesDoGrupo = vinculacoes.filter(v => 
        v.modulo_id === modulo.id && // ← AQUI ESTÁ A CORREÇÃO
        grupo.canais.includes(v.canal)
      );

      let correnteTotal = vinculacoesDoGrupo.reduce((total, v) => {
        const potencia = v.potencia || circuitos.find(c => c.id === v.circuito_id)?.potencia || 0;
        return total + calcularCorrente(potencia);
      }, 0);

      // Adicionar corrente do circuito atual se estiver no mesmo grupo
      if (circuitoAtual && canalAtual && grupo.canais.includes(canalAtual)) {
        correnteTotal += calcularCorrente(circuitoAtual.potencia);
      }

      const porcentagem = (correnteTotal / grupo.maxCorrente) * 100;
      
      // Obter canais já utilizados neste grupo
      const canaisUtilizados = vinculacoesDoGrupo.map(v => v.canal);

      return {
        grupo,
        correnteAtual: correnteTotal,
        porcentagem,
        canaisUtilizados
      };
    });
  }, [calcularCorrente, vinculacoes, circuitos]);

  const verificarRestricoes = useCallback((): RestricaoViolada | null => {
    if (!selectedCircuito || !selectedModulo || !canal) return null;

    const especificacao = ESPECIFICACOES_MODULOS[selectedModulo.tipo];
    if (!especificacao) return null;

    const correnteCircuito = calcularCorrente(selectedCircuito.potencia);

    // Verificar restrição por canal individual
    if (correnteCircuito > especificacao.correntePorCanal) {
      return {
        tipo: 'canal',
        mensagem: `O circuito selecionado demanda ${correnteCircuito.toFixed(2)}A, mas o canal suporta apenas ${especificacao.correntePorCanal}A.`,
        correnteAtual: correnteCircuito,
        correnteMaxima: especificacao.correntePorCanal
      };
    }

    // Verificar restrição por grupo
    const grupo = especificacao.grupos.find(g => g.canais.includes(canal as number));
    if (grupo) {
      // FILTRAR PELO ID ESPECÍFICO DO MÓDULO
      const vinculacoesDoModulo = vinculacoes.filter(v => 
        v.modulo_id === selectedModulo.id && // ← AQUI ESTÁ A CORREÇÃO
        grupo.canais.includes(v.canal)
      );

      let correnteTotalGrupo = vinculacoesDoModulo.reduce((total, v) => {
        const potencia = v.potencia || circuitos.find(c => c.id === v.circuito_id)?.potencia || 0;
        return total + calcularCorrente(potencia);
      }, 0);

      // Adicionar o circuito atual que está sendo vinculado
      correnteTotalGrupo += correnteCircuito;

      if (correnteTotalGrupo > grupo.maxCorrente) {
        const correnteAtualSemNovo = correnteTotalGrupo - correnteCircuito;
        return {
          tipo: 'grupo',
          mensagem: `Ao vincular este circuito, a corrente total do grupo será ${correnteTotalGrupo.toFixed(2)}A, excedendo o limite de ${grupo.maxCorrente}A (atualmente: ${correnteAtualSemNovo.toFixed(2)}A).`,
          correnteAtual: correnteTotalGrupo,
          correnteMaxima: grupo.maxCorrente
        };
      }
    }

    return null;
  }, [selectedCircuito, selectedModulo, canal, calcularCorrente, vinculacoes, circuitos]);

  // 5. Memoized values que dependem das funções acima
  const restricao = useMemo(() => verificarRestricoes(), [verificarRestricoes]);

  const utilizacaoGrupos = useMemo(() => 
    calcularUtilizacaoGrupos(selectedModulo, selectedCircuito, canal as number),
    [calcularUtilizacaoGrupos, selectedModulo, selectedCircuito, canal]
  );

  // 6. Função fetchAllData
  const fetchAllData = useCallback(async (showLoading = true) => {
    if (projetoSelecionado !== true) {
      setLoading(false);
      return;
    }
    
    if (fetchingRef.current) return;
    fetchingRef.current = true;

    if (showLoading) setLoading(true);
    
    try {
      const [optRes, listRes, quadrosRes] = await Promise.all([
        fetch("/api/vinculacao/options", { 
          credentials: "same-origin",
          cache: 'no-cache'
        }),
        fetch("/api/vinculacoes", { 
          credentials: "same-origin",
          cache: 'no-cache'
        }),
        fetch("/api/quadros_eletricos", { 
          credentials: "same-origin",
          cache: 'no-cache'
        })
      ]);

      const [optData, listData, quadrosData] = await Promise.all([
        optRes.json().catch(() => ({ ok: false })),
        listRes.json().catch(() => ({ ok: false })),
        quadrosRes.json().catch(() => ({ ok: false }))
      ]);

      if (optData?.ok || optData?.success) {
        setCircuitos(optData?.circuitos || []);
        setModulos(optData?.modulos || []);
        setCompat(optData?.compat || { luz: [], persiana: [], hvac: [] });
      }
      if (listData?.ok || listData?.success) {
        setVinculacoes(listData?.vinculacoes || []);
      }
      if (quadrosData?.ok) {
        setQuadrosEletricos(quadrosData.quadros_eletricos || []);
      }
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Falha ao carregar dados. Tente recarregar a página.",
      });
    } finally {
      if (showLoading) setLoading(false);
      fetchingRef.current = false;
    }
  }, [projetoSelecionado, toast]);

  // 7. Effects
  useEffect(() => {
    try { 
      if (projeto) setProjetoSelecionado(true); 
    } catch {} 
  }, [projeto]);

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

  // Carregamento inicial - apenas uma vez
  useEffect(() => {
    if (projetoSelecionado === true && !initialLoadRef.current) {
      initialLoadRef.current = true;
      fetchAllData();
    }
  }, [projetoSelecionado, fetchAllData]);

  // 8. Funções de manipulação
  const criarVinculacao = async (circuitoId: number, moduloId: number, canal: number) => {
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
        setCanal("");
        // Recarrega sem mostrar loading para evitar flickering
        await fetchAllData(false); // Agora passando false explicitamente
        
        toast({ 
          title: "Sucesso!", 
          description: "Circuito vinculado.",
          duration: 3500,
        });
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!circuitoId || !moduloId || !canal) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Preencha todos os campos para vincular.",
      });
      return;
    }

    if (restricao) {
      setModalRestricao({
        aberto: true,
        restricao,
        dadosVinculacao: {
          circuitoId: circuitoId as number,
          moduloId: moduloId as number,
          canal: canal as number
        }
      });
    } else {
      await criarVinculacao(circuitoId as number, moduloId as number, canal as number);
    }
  };

  const confirmarVinculacaoComRestricao = async () => {
    if (!modalRestricao.dadosVinculacao) return;
    
    const { circuitoId, moduloId, canal } = modalRestricao.dadosVinculacao;
    setModalRestricao({ aberto: false, restricao: null, dadosVinculacao: null });
    await criarVinculacao(circuitoId, moduloId, canal);
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
        await fetchAllData(false); // Passando false explicitamente
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

  // 9. Memoized JSX para evitar re-renderizações desnecessárias
  const limitesEletricosSection = useMemo(() => {
    if (!selectedModulo || !ESPECIFICACOES_MODULOS[selectedModulo.tipo]) return null;
    
    return (
      <SecaoUtilizacaoAnimada visivel={true}>
        <div className="mt-3 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Zap className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h4 className="font-semibold text-blue-900">Limites Elétricos</h4>
              <p className="text-sm text-blue-700">Especificações do módulo</p>
            </div>
          </div>
          {obterInfoRestricoes(selectedModulo.tipo)}
        </div>
      </SecaoUtilizacaoAnimada>
    );
  }, [selectedModulo, obterInfoRestricoes]);

  const utilizacaoGruposSection = useMemo(() => {
    if (!selectedModulo || !ESPECIFICACOES_MODULOS[selectedModulo.tipo] || utilizacaoGrupos.length === 0) return null;
    
    return (
      <SecaoUtilizacaoAnimada visivel={true}>
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <Boxes className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h4 className="font-semibold text-slate-900">Utilização dos Grupos</h4>
              <p className="text-sm text-slate-600">Monitoramento em tempo real</p>
            </div>
          </div>
          
          <div className="space-y-3">
            {utilizacaoGrupos.map((utilizacao, index) => (
              <BarraProgressoGrupo
                key={index}
                utilizacao={utilizacao}
                index={index}
                canalSelecionado={canal as number}
              />
            ))}
          </div>
          
          <div className="pt-3 border-t border-slate-200">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs text-slate-600">
              <div className="flex items-center gap-2 justify-center">
                <div className="w-3 h-3 bg-green-500 rounded"></div>
                <span>Baixa (≤60%)</span>
              </div>
              <div className="flex items-center gap-2 justify-center">
                <div className="w-3 h-3 bg-yellow-500 rounded"></div>
                <span>Moderada (≤80%)</span>
              </div>
              <div className="flex items-center gap-2 justify-center">
                <div className="w-3 h-3 bg-red-500 rounded"></div>
                <span>Alta (&gt;80%)</span>
              </div>
            </div>
          </div>
        </div>
      </SecaoUtilizacaoAnimada>
    );
  }, [selectedModulo, utilizacaoGrupos, canal]);

  const fetchQuadrosEletricos = async () => {
    if (projetoSelecionado !== true) return;
    
    try {
      const res = await fetch("/api/quadros_eletricos", { 
        credentials: "same-origin",
        cache: 'no-cache'
      });
      const data = await res.json();
      
      if (data?.ok) {
        setQuadrosEletricos(data.quadros_eletricos || []);
      }
    } catch (error) {
      console.error("Erro ao carregar quadros elétricos:", error);
    }
  };

  const handleVinculacaoAutomatica = async () => {
    if (quadrosEletricos.length !== 1) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "A vinculação automática só está disponível quando há exatamente um quadro elétrico.",
      });
      return;
    }

    if (!confirm('Deseja realizar a vinculação automática? Esta ação irá vincular circuitos não vinculados aos módulos compatíveis disponíveis.')) {
      return;
    }

    setVinculacaoAutoLoading(true);
    try {
      const res = await fetch("/api/vinculacoes/auto", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
      });

      const data = await res.json().catch(() => null);

      if (res.ok && (data?.ok || data?.success)) {
        await fetchAllData(false);
        toast({
          title: "Vinculação Automática Concluída",
          description: `Foram criadas ${data.vinculacoes_criadas} vinculações automaticamente.`,
          duration: 5000,
        });
      } else {
        toast({
          variant: "destructive",
          title: "Erro",
          description: data?.error || data?.message || "Falha ao realizar vinculação automática.",
        });
      }
    } catch {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Falha ao se conectar ao servidor.",
      });
    } finally {
      setVinculacaoAutoLoading(false);
    }
  };

  
  // 10. Return do componente


  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
        <div className="max-w-7xl mx-auto px-6 py-8">
          {/* Header mantido igual */}

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
                    {quadrosEletricos.length === 1 && (
                      <span className="text-green-600 font-semibold ml-2">• 1 quadro detectado</span>
                    )}
                  </p>
                </div>
              </div>
              <div className="h-1 w-32 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full shadow-sm" />
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              {/* Botão de Vinculação Automática - Só aparece quando há 1 quadro */}
              {quadrosEletricos.length === 1 && (
                <Button
                  onClick={handleVinculacaoAutomatica}
                  disabled={vinculacaoAutoLoading || loading || isLocked}
                  className="group flex items-center gap-2 h-12 px-6 rounded-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white shadow-lg hover:shadow-xl transition-all duration-300"
                >
                  {vinculacaoAutoLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                      Processando...
                    </>
                  ) : (
                    <>
                      <Zap className="h-4 w-4" />
                      Vinculação Automática
                    </>
                  )}
                </Button>
              )}
              <Button
                onClick={() => fetchAllData()}
                variant="outline"
                className="group flex items-center gap-2 h-12 px-6 rounded-full border-slate-200 text-slate-600 hover:text-slate-900 transition-all duration-300"
                disabled={loading}
              >
                <RefreshCcw className={`h-4 w-4 ${loading ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'}`} />
                {loading ? 'Carregando...' : 'Recarregar'}
              </Button>
            </div>
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
                  <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Circuito */}
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
                        className={`
                          mt-2 w-full px-4 rounded-xl border border-slate-200 bg-white 
                          focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all
                          ${circuitosNaoVinculados.length > 5 
                            ? 'max-h-48 overflow-y-auto py-2'  // Scroll se tiver mais de 5 opções
                            : 'h-12'                           // Altura normal se tiver 5 ou menos
                          }
                        `}
                        disabled={isLocked || loading || circuitosNaoVinculados.length === 0}
                      >
                        <option value="">{loading ? "Carregando circuitos..." : "Selecione um circuito"}</option>
                        {!loading && circuitosNaoVinculados.map((c) => {
                          const corrente = calcularCorrente(c.potencia);
                          return (
                            <option key={c.id} value={c.id} className="py-2">
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

                    {/* Módulo */}
                    <div>
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
                      {!loading && projetoSelecionado && modulosFiltrados.length === 0 && (
                        <p className="text-sm text-amber-600 mt-1 flex items-center gap-1">
                          <Sparkles className="w-3 h-3" />
                          Nenhum módulo disponível para vincular.
                        </p>
                      )}
                    </div>

                    {/* Tensão e Canal - Lado a lado */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
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
                            Potência: {selectedCircuito.potencia ?? 0}W<br/>
                            Corrente: {calcularCorrente(selectedCircuito.potencia).toFixed(2)}A
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
                          {!loading && selectedModulo && canaisDisponiveis.map((c) => (
                            <option key={c} value={c}>
                              Canal {c}
                            </option>
                          ))}
                        </select>
                        {!selectedModulo && (
                          <p className="text-sm text-slate-500 mt-1">Selecione um módulo</p>
                        )}
                      </div>
                    </div>

                    {/* Seções de informações - Agora memoizadas */}
                    {limitesEletricosSection}
                    {utilizacaoGruposSection}

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

            {/* Seção de vinculações cadastradas (mantida igual) */}
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

      {/* Modal de Confirmação para Restrição (mantido igual) */}
      {modalRestricao.aberto && modalRestricao.restricao && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <Zap className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900">Atenção: Restrição de Carga</h3>
                <p className="text-slate-600 text-sm">Você está prestes a exceder os limites elétricos</p>
              </div>
            </div>

            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-white text-sm font-bold">!</span>
                </div>
                <div>
                  <p className="text-red-800 font-semibold mb-2">
                    {modalRestricao.restricao.tipo === 'canal' ? 'Limite do Canal Excedido' : 'Limite do Grupo Excedido'}
                  </p>
                  <p className="text-red-700 text-sm mb-2">
                    {modalRestricao.restricao.mensagem}
                  </p>
                  <div className="flex items-center gap-4 text-xs text-red-600">
                    <span>Corrente atual: <strong>{modalRestricao.restricao.correnteAtual.toFixed(2)}A</strong></span>
                    <span>Máximo permitido: <strong>{modalRestricao.restricao.correnteMaxima}A</strong></span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
              <p className="text-amber-800 text-sm flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                <strong>Atenção:</strong> Exceder os limites pode causar superaquecimento, danos ao equipamento ou disparo de proteções.
              </p>
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setModalRestricao({ aberto: false, restricao: null, dadosVinculacao: null })}
                className="flex-1 h-12 rounded-xl border-slate-300 text-slate-700 hover:bg-slate-50"
              >
                Cancelar
              </Button>
              <Button
                onClick={confirmarVinculacaoComRestricao}
                className="flex-1 h-12 bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700 text-white rounded-xl shadow-lg"
              >
                <Zap className="w-4 h-4 mr-2" />
                Vincular Mesmo Assim
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </Layout>
  );
}