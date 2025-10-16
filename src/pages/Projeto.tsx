import { useEffect, useMemo, useState } from "react";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useProject } from "@/store/project";
import {
  FileDown, FileOutput, Lightbulb, Blinds, Snowflake, LayoutList,
  RefreshCcw, Sparkles, KeySquare, Link2, Film, Cpu
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { ProjetoTree, Keypad, Area } from "@/types/project";
import NavigationButtons from "@/components/NavigationButtons";

type QuadroOption = {
  id: number;
  label: string;
};

export default function Projeto() {
  const { projeto } = useProject();
  const [keypads, setKeypads] = useState<Keypad[]>([]);
  const [projetoSelecionado, setProjetoSelecionado] = useState<boolean | null>(projeto ? true : null);
  const isLocked = projetoSelecionado !== true;
  
  // Sincroniza com o store quando hidratar
  useEffect(() => {
    try { if (projeto) setProjetoSelecionado(true); } catch {}
  }, [projeto]);

  // Confirma via sessão quando ainda não sabemos (estado null)
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

  const { toast } = useToast();

  const [data, setData] = useState<ProjetoTree>({ projeto: null, areas: [], modulos: [] });
  const [loading, setLoading] = useState(true);

  // Form de download .rwp
  const [showRwp, setShowRwp] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [timezoneId, setTimezoneId] = useState("America/Bahia");
  const [lat, setLat] = useState("0.0");
  const [lon, setLon] = useState("0.0");
  const [techArea, setTechArea] = useState("Área Técnica");
  const [techRoom, setTechRoom] = useState("Sala Técnica");
  const [boardName, setBoardName] = useState("Quadro Elétrico");
  const [m4ip, setM4ip] = useState("192.168.5.30");
  const [m4QuadroId, setM4QuadroId] = useState<string>("");
  
  const m4hsnet = "245";
  const m4devid = "1";
  const softwareVersion = "1.0.8.67";

  const quadroOptions = useMemo<QuadroOption[]>(() => {
    const options: QuadroOption[] = [];
    (data?.areas || []).forEach((area: Area) => {
      (area?.ambientes || []).forEach((ambiente) => {
        (ambiente?.quadros_eletricos || []).forEach((quadro) => {
          options.push({
            id: quadro.id,
            label: `${area.nome} • ${ambiente.nome} • ${quadro.nome}`,
          });
        });
      });
    });
    return options.sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
  }, [data]);

  const countKeypads = (all: Keypad[]) => all.length;
  const keypadCount = countKeypads(keypads);

  const fetchKeypads = async () => {
    if (projetoSelecionado !== true) return;
    try {
      const res = await fetch("/api/keypads", { credentials: "same-origin" });
      const json = await res.json();
      setKeypads(json?.keypads || []);
    } catch {
      // silencioso para não poluir o toast do projeto
    }
  };

  useEffect(() => {
    fetchProjectData();
    fetchKeypads();
  }, [projetoSelecionado]);

  const fetchProjectData = async () => {
    if (projetoSelecionado !== true) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/projeto_tree", { credentials: "same-origin" });
      const json = await res.json();
      setData({ projeto: json?.projeto || null, areas: json?.areas || [], modulos: json?.modulos || [] });
      if (json?.projeto?.nome) setProjectName(json.projeto.nome);
    } catch {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Falha ao carregar dados do projeto. Verifique sua conexão ou se a API está no ar.",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjectData();
  }, [projetoSelecionado]);

  useEffect(() => {
    if (!quadroOptions.length) {
      if (m4QuadroId !== "") setM4QuadroId("");
      return;
    }
    const hasSelection = quadroOptions.some((option) => String(option.id) === m4QuadroId);
    if (!hasSelection) {
      setM4QuadroId(String(quadroOptions[0].id));
    }
  }, [quadroOptions, m4QuadroId]);

  const stats = useMemo(() => {
    const newStats = { luz: 0, persiana: 0, hvac: 0, cenas: 0, modulos: 0 };
    if (!data || !data.areas) return newStats;

    data.areas.forEach(area => {
      area.ambientes.forEach(ambiente => {
        newStats.cenas += ambiente.cenas?.length || 0;
        ambiente.circuitos.forEach(circuito => {
          if (circuito.tipo === 'luz' || circuito.tipo === 'persiana' || circuito.tipo === 'hvac') {
            newStats[circuito.tipo] += 1;
          }
        });
      });
    });

    newStats.modulos = data.modulos?.length || 0;

    return newStats;
  }, [data]);

  const validateAndSubmitRwp = (e: React.FormEvent<HTMLFormElement>) => {
    if (quadroOptions.length > 0 && !m4QuadroId) {
      e.preventDefault();
      toast({
        variant: "destructive",
        title: "Selecione um quadro",
        description: "Escolha em qual quadro elétrico o módulo M4 será colocado.",
      });
      return;
    }
    const numbers = clientPhone.replace(/\D/g, "");
    if (numbers.length < 10) {
      e.preventDefault();
      toast({ variant: "destructive", title: "Telefone inválido", description: "Use DDD + número (mínimo 10 dígitos)." });
      return;
    }
    const ipPattern = /^((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    if (!ipPattern.test(m4ip)) {
      e.preventDefault();
      toast({ variant: "destructive", title: "IP inválido", description: "Insira um endereço IP válido para o Módulo M4." });
      return;
    }
    const hidden = document.createElement("input");
    hidden.type = "hidden";
    hidden.name = "client_phone_clean";
    hidden.value = numbers;
    e.currentTarget.appendChild(hidden);
  };
  
  const openPdf = () => {
    const id = data.projeto?.id;
    if (!id) return;

    const now = new Date();
    const clientTimestamp = now.toISOString();
    const timezoneOffset = now.getTimezoneOffset();

    const url = `/exportar-pdf/${id}?client_timestamp=${encodeURIComponent(clientTimestamp)}&tz_offset=${timezoneOffset}`;
    
    window.open(url, "_blank");
  };

  const handlePrint = () => { window.print(); };

  const circuitTypeConfig: { [key: string]: { icon: React.ElementType; label: string; color: string } } = {
    luz: { icon: Lightbulb, label: "Luz", color: "text-yellow-500" },
    persiana: { icon: Blinds, label: "Persianas", color: "text-blue-500" },
    hvac: { icon: Snowflake, label: "Climatização", color: "text-green-500" },
  };

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
          {/* Header */}
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 mb-8">
            <div>
              <div className="flex items-center gap-4 mb-4">
                <div className="w-14 h-14 sm:w-16 sm:h-16 bg-gradient-to-br from-gray-500 to-gray-600 rounded-3xl flex items-center justify-center shadow-lg shadow-blue-500/25">
                  <LayoutList className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
                </div>
                <div>
                  <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-2">Visão Geral do Projeto</h1>
                  <p className="text-base sm:text-lg text-slate-600 max-w-2xl">
                    Visualize todos os circuitos, módulos e vinculações do seu projeto.
                  </p>
                </div>
              </div>
              <div className="h-1 w-32 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full shadow-sm" />
            </div>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 w-full sm:w-auto">
              <Button
                onClick={openPdf}
                className="group flex items-center justify-center gap-2 h-12 px-4 sm:px-6 rounded-full border border-blue-600 bg-blue-600 hover:bg-blue-700 text-white transition-all duration-300 shadow-lg hover:shadow-xl text-sm sm:text-base"
                disabled={isLocked || loading}
              >
                <FileOutput className="h-4 w-4" />
                Gerar AS BUILT
              </Button>
              <Button
                onClick={() => setShowRwp(true)}
                className="group flex items-center justify-center gap-2 h-12 px-4 sm:px-6 rounded-full border border-blue-600 bg-blue-600 hover:bg-blue-700 text-white transition-all duration-300 shadow-lg hover:shadow-xl text-sm sm:text-base"
                disabled={isLocked || loading}
              >
                <FileDown className="h-4 w-4" />
                Gerar RWP
              </Button>
              <Button
                onClick={() => { fetchProjectData(); fetchKeypads(); }}
                variant="outline"
                className="group flex items-center justify-center gap-2 h-12 px-4 sm:px-6 rounded-full border-slate-200 text-slate-600 hover:text-slate-900 transition-all duration-300 text-sm sm:text-base"
              >
                <RefreshCcw className="h-4 w-4 group-hover:rotate-180 transition-transform duration-500" />
                Recarregar
              </Button>
            </div>
          </div>

          {projetoSelecionado === false && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
              <Alert className="bg-amber-50 border-amber-200 shadow-sm">
                <Sparkles className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-amber-800">
                  Selecione um projeto na página inicial para visualizar os detalhes.
                </AlertDescription>
              </Alert>
            </motion.div>
          )}

          {loading ? (
            <div className="flex flex-col justify-center items-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent mb-4"></div>
              <p className="text-slate-600 font-medium">Carregando dados do projeto...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
              {/* Card de Resumo de Circuitos - PRIMEIRO no mobile */}
              <motion.div 
                initial={{ opacity: 0, y: 20 }} 
                animate={{ opacity: 1, y: 0 }} 
                className="order-1 lg:order-1"
              >
                <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-xl shadow-slate-900/5">
                  <CardHeader className="pb-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-purple-500 to-violet-600 rounded-2xl flex items-center justify-center shadow-lg">
                        <LayoutList className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                      </div>
                      <div>
                        <CardTitle className="text-xl sm:text-2xl font-bold text-slate-900">Resumo de Circuitos</CardTitle>
                        <p className="text-slate-600 text-sm sm:text-base mt-1">Visão geral dos circuitos cadastrados.</p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
                    <div className="flex flex-col items-center justify-center rounded-xl p-3 sm:p-4 bg-slate-50/50">
                      <Lightbulb className="h-6 w-6 sm:h-8 sm:w-8 text-yellow-500 mb-2" />
                      <div className="text-xl sm:text-2xl font-bold text-slate-900">{stats.luz}</div>
                      <div className="text-xs sm:text-sm text-slate-600">Luz</div>
                    </div>
                    <div className="flex flex-col items-center justify-center rounded-xl p-3 sm:p-4 bg-slate-50/50">
                      <Blinds className="h-6 w-6 sm:h-8 sm:w-8 text-blue-500 mb-2" />
                      <div className="text-xl sm:text-2xl font-bold text-slate-900">{stats.persiana}</div>
                      <div className="text-xs sm:text-sm text-slate-600">Persiana</div>
                    </div>
                    <div className="flex flex-col items-center justify-center rounded-xl p-3 sm:p-4 bg-slate-50/50">
                      <Snowflake className="h-6 w-6 sm:h-8 sm:w-8 text-green-500 mb-2" />
                      <div className="text-xl sm:text-2xl font-bold text-slate-900">{stats.hvac}</div>
                      <div className="text-xs sm:text-sm text-slate-600">HVAC</div>
                    </div>
                    <div className="flex flex-col items-center justify-center rounded-xl p-3 sm:p-4 bg-slate-50/50">
                      <KeySquare className="h-6 w-6 sm:h-8 sm:w-8 text-violet-600 mb-2" />
                      <div className="text-xl sm:text-2xl font-bold text-slate-900">{keypadCount}</div>
                      <div className="text-xs sm:text-sm text-slate-600">Keypads</div>
                    </div>
                    <div className="flex flex-col items-center justify-center rounded-xl p-3 sm:p-4 bg-slate-50/50">
                      <Cpu className="h-6 w-6 sm:h-8 sm:w-8 text-slate-500 mb-2" />
                      <div className="text-xl sm:text-2xl font-bold text-slate-900">{stats.modulos}</div>
                      <div className="text-xs sm:text-sm text-slate-600">Módulos</div>
                    </div>
                    <div className="flex flex-col items-center justify-center rounded-xl p-3 sm:p-4 bg-slate-50/50">
                      <Film className="h-6 w-6 sm:h-8 sm:w-8 text-red-500 mb-2" />
                      <div className="text-xl sm:text-2xl font-bold text-slate-900">{stats.cenas}</div>
                      <div className="text-xs sm:text-sm text-slate-600">Cenas</div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Card de Árvore do Projeto - SEGUNDO no mobile */}
              <motion.div 
                initial={{ opacity: 0, y: 20 }} 
                animate={{ opacity: 1, y: 0 }} 
                transition={{ delay: 0.1 }}
                className="order-2 lg:order-2"
              >
                <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-xl shadow-slate-900/5">
                  <CardHeader className="pb-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center shadow-lg">
                        <FileOutput className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                      </div>
                      <div>
                        <CardTitle className="text-xl sm:text-2xl font-bold text-slate-900">Árvore do Projeto</CardTitle>
                        <p className="text-slate-600 text-sm sm:text-base mt-1">Estrutura completa do projeto.</p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {data.areas.length === 0 ? (
                      <div className="text-center py-8">
                        <LayoutList className="h-10 w-10 sm:h-12 sm:w-12 text-slate-400 mx-auto mb-3" />
                        <h4 className="text-lg font-semibold text-slate-900 mb-2">
                          Nenhuma área, ambiente ou circuito cadastrado.
                        </h4>
                        <p className="text-slate-600 text-sm">
                          Use as páginas "Áreas", "Ambientes" e "Circuitos" para começar a estruturar seu projeto.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-4 sm:space-y-6 max-h-80 sm:max-h-96 overflow-y-auto pr-2">
                        {data.areas.map((area, index) => (
                          <motion.div key={area.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.1 }}>
                            <h3 className="font-bold text-base sm:text-lg text-slate-800 flex items-center gap-2">
                              {area.nome}
                            </h3>
                            <div className="ml-3 sm:ml-4 mt-2 space-y-3 sm:space-y-4">
                              {area.ambientes.map((ambiente) => {
                                const groupedCircuits = ambiente.circuitos.reduce((acc, circuito) => {
                                  const type = circuito.tipo || 'outros';
                                  if (!acc[type]) {
                                    acc[type] = [];
                                  }
                                  acc[type].push(circuito);
                                  return acc;
                                }, {} as Record<string, typeof ambiente.circuitos>);

                                return (
                                <div key={ambiente.id} className="border-l-2 border-slate-200 pl-3 sm:pl-4 relative before:content-[''] before:absolute before:left-0 before:top-3 before:w-3 sm:before:w-4 before:h-px before:bg-slate-200">
                                  <h4 className="font-semibold text-slate-700 flex items-center gap-2 text-sm sm:text-base">
                                    {ambiente.nome}
                                  </h4>
                                  <div className="mt-2 sm:mt-3 space-y-3 sm:space-y-4">
                                    {ambiente.circuitos.length === 0 ? (
                                      <p className="text-xs sm:text-sm text-slate-500 italic">Nenhum circuito neste ambiente.</p>
                                    ) : (
                                      Object.entries(groupedCircuits).map(([type, circuits]) => {
                                        const config = circuitTypeConfig[type] || { icon: LayoutList, label: type.charAt(0).toUpperCase() + type.slice(1), color: "text-slate-500" };
                                        const Icon = config.icon;
                                        return (
                                          <div key={type}>
                                            <h5 className={`font-semibold text-slate-800 flex items-center gap-2 text-xs sm:text-sm`}>
                                              <Icon className={`h-3 w-3 sm:h-4 sm:w-4 ${config.color}`} />
                                              {config.label}
                                            </h5>
                                            <ul className="space-y-1 sm:space-y-2 mt-1 sm:mt-2 pl-4 sm:pl-6">
                                              {circuits.map((circuito) => (
                                                <li key={circuito.id} className="text-xs sm:text-sm text-slate-600 flex items-center gap-2 flex-wrap">
                                                  <span className="h-1.5 w-1.5 rounded-full bg-slate-400"></span>
                                                  <span className="font-medium">{circuito.identificador}</span>
                                                  <span>-</span>
                                                  <span className="flex-1 min-w-0 truncate">{circuito.nome}</span>
                                                  {circuito.vinculacao ? (
                                                    <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 whitespace-nowrap">
                                                      Vinc. em {circuito.vinculacao.modulo_nome} (Canal {circuito.vinculacao.canal})
                                                    </span>
                                                  ) : (
                                                    <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 whitespace-nowrap">
                                                      Não Vinculado
                                                    </span>
                                                  )}
                                                </li>
                                              ))}
                                            </ul>
                                          </div>
                                        );
                                      })
                                    )}
                                    {/* Keypads do ambiente */}
                                    {(() => {
                                      const kps = keypads.filter(k => k.ambiente?.id === ambiente.id);
                                      if (kps.length === 0) return null;
                                      
                                      return (
                                        <div className="mt-3 sm:mt-4">
                                          <h5 className="text-xs sm:text-sm font-semibold text-slate-800 mb-2 flex items-center gap-2">
                                            <KeySquare className="h-3 w-3 sm:h-4 sm:w-4 text-violet-600" />
                                            Keypads
                                          </h5>
                                          <ul className="space-y-1 sm:space-y-2 pl-4 sm:pl-6">
                                            {kps.map((k) => {
                                              const linked = k.buttons.filter(b => b.circuito_id != null || b.cena_id != null).length;
                                              const total = k.button_count || k.buttons.length || 0;
                                              let statusLabel = "Vazio";
                                              let statusClass = "bg-red-100 text-red-700";
                                              if (linked > 0 && linked < total) {
                                                statusLabel = "Parcial";
                                                statusClass = "bg-yellow-100 text-yellow-800";
                                              } else if (total > 0 && linked === total) {
                                                statusLabel = "Completo";
                                                statusClass = "bg-green-100 text-green-700";
                                              }
                                              return (
                                                <li key={k.id} className="text-xs sm:text-sm text-slate-600 flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-2">
                                                  <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="h-2 w-2 rounded-full bg-violet-400"></span>
                                                    <span className="font-medium text-slate-800">{k.nome}</span>
                                                    <span className="text-xs text-slate-500">HSNET {k.hsnet}</span>
                                                    <span className="text-xs text-slate-500">• {total} tecla(s)</span>
                                                    <span className="text-xs text-slate-500 flex items-center gap-1">
                                                      <Link2 className="h-3 w-3" /> {linked}/{total} vinculadas
                                                    </span>
                                                  </div>
                                                  <Badge className={`text-xs px-2 py-0.5 ${statusClass} self-start sm:self-auto`}>
                                                    {statusLabel}
                                                  </Badge>
                                                </li>
                                              );
                                            })}
                                          </ul>
                                        </div>
                                      );
                                    })()}
                                  </div>
                                </div>
                              )})}
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            </div>
          )}

          <NavigationButtons previousPath="/cenas" />

          {/* Modal do Gerador de RWP */}
          <AnimatePresence>
            {showRwp && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
              >
                <motion.div
                  initial={{ y: -50, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: -50, opacity: 0 }}
                  className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
                >
                  <div className="p-4 sm:p-6 md:p-8">
                    <h3 className="text-xl sm:text-2xl font-bold mb-4">Gerar Arquivo de Configuração (.rwp)</h3>
                    <p className="text-sm text-muted-foreground mb-6">
                      Preencha os dados técnicos para gerar o arquivo de configuração do projeto.
                    </p>
                    <form 
                      method="POST" 
                      action="/roehn/import" 
                      encType="multipart/form-data" 
                      target="_blank" 
                      onSubmit={validateAndSubmitRwp}
                      className="space-y-6"
                    >
                      <input type="hidden" name="m4_hsnet" value={m4hsnet} />
                      <input type="hidden" name="m4_devid" value={m4devid} />
                      <input type="hidden" name="software_version" value={softwareVersion} />
                      <input type="hidden" name="m4_quadro_id" value={m4QuadroId} />

                      <section>
                        <h4 className="text-primary text-sm font-semibold mb-2 border-b pb-1">Informações do Projeto</h4>
                        <div>
                          <Label htmlFor="project_name">Nome do Projeto</Label>
                          <Input id="project_name" name="project_name" value={projectName} onChange={(e) => setProjectName(e.target.value)} required className="text-sm" />
                          <p className="text-xs text-muted-foreground mt-1">Será baseado no projeto atual selecionado.</p>
                        </div>
                      </section>

                      <section>
                        <h4 className="text-primary text-sm font-semibold mb-2 border-b pb-1">Informações do Cliente</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <Label htmlFor="client_name">Nome do Cliente</Label>
                            <Input id="client_name" name="client_name" value={clientName} onChange={(e) => setClientName(e.target.value)} required className="text-sm" />
                          </div>
                          <div>
                            <Label htmlFor="client_email">Email do Cliente</Label>
                            <Input id="client_email" name="client_email" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} className="text-sm" />
                          </div>
                          <div className="md:col-span-2">
                            <Label htmlFor="client_phone">Telefone</Label>
                            <Input id="client_phone" name="client_phone" placeholder="(00) 00000-0000" value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} className="text-sm" />
                            <p className="text-xs text-muted-foreground mt-1">Digite com DDD; validaremos no envio.</p>
                          </div>
                        </div>
                      </section>

                      <section>
                        <h4 className="text-primary text-sm font-semibold mb-2 border-b pb-1">Configurações Técnicas</h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div>
                            <Label htmlFor="timezone_id">Timezone</Label>
                            <Input id="timezone_id" name="timezone_id" value={timezoneId} onChange={(e) => setTimezoneId(e.target.value)} required className="text-sm" />
                          </div>
                          <div>
                            <Label htmlFor="lat">Latitude</Label>
                            <Input id="lat" name="lat" value={lat} onChange={(e) => setLat(e.target.value)} className="text-sm" />
                          </div>
                          <div>
                            <Label htmlFor="lon">Longitude</Label>
                            <Input id="lon" name="lon" value={lon} onChange={(e) => setLon(e.target.value)} className="text-sm" />
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
                          <div>
                            <Label htmlFor="tech_area">Área Técnica</Label>
                            <Input id="tech_area" name="tech_area" value={techArea} onChange={(e) => setTechArea(e.target.value)} required className="text-sm" />
                          </div>
                          <div>
                            <Label htmlFor="tech_room">Sala Técnica</Label>
                            <Input id="tech_room" name="tech_room" value={techRoom} onChange={(e) => setTechRoom(e.target.value)} required className="text-sm" />
                          </div>
                          <div>
                            <Label htmlFor="board_name">Nome do Quadro</Label>
                            <Input id="board_name" name="board_name" value={boardName} onChange={(e) => setBoardName(e.target.value)} required className="text-sm" />
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
                          <div className="md:col-span-3">
                            <Label htmlFor="m4_quadro_id">Quadro do Módulo M4</Label>
                            {quadroOptions.length > 0 ? (
                              <div className="space-y-2">
                                <Select value={m4QuadroId} onValueChange={setM4QuadroId}>
                                  <SelectTrigger id="m4_quadro_id" className="text-sm">
                                    <SelectValue placeholder="Selecione um quadro" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {quadroOptions.map((option) => (
                                      <SelectItem key={option.id} value={String(option.id)}>
                                        {option.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <p className="text-xs text-muted-foreground">
                                  O módulo M4 será configurado dentro do quadro escolhido.
                                </p>
                              </div>
                            ) : (
                              <p className="text-sm text-muted-foreground">
                                Nenhum quadro cadastrado. O M4 permanecerá no quadro técnico padrão.
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
                          <div className="md:col-span-1">
                            <Label htmlFor="m4_ip">IP do Módulo M4</Label>
                            <Input id="m4_ip" name="m4_ip" value={m4ip} onChange={(e) => setM4ip(e.target.value)} required className="text-sm" />
                          </div>
                        </div>
                      </section>

                      <div className="flex flex-col sm:flex-row justify-end gap-2 mt-6">
                        <Button type="button" variant="ghost" onClick={() => setShowRwp(false)} className="w-full sm:w-auto order-2 sm:order-1">
                          Fechar
                        </Button>
                        <Button type="submit" className="w-full sm:w-auto order-1 sm:order-2">
                          <FileDown className="h-4 w-4 mr-2" />
                          Gerar e Baixar
                        </Button>
                      </div>
                    </form>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </Layout>
  );
}
