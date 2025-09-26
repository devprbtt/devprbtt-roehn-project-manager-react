import { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { useProject } from "@/store/project";
import { FileDown, FileOutput, Lightbulb, Blinds, Snowflake, LayoutList, RefreshCcw, Sparkles, KeySquare, Link2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type VincInfo = { modulo_nome: string; canal: number };
type Circuito = { id: number; tipo: "luz" | "persiana" | "hvac"; identificador: string; nome: string; vinculacao?: VincInfo | null; };
type Ambiente = { id: number; nome: string; circuitos: Circuito[] };
type Area = { id: number; nome: string; ambientes: Ambiente[] };
type ProjetoTree = { projeto: { id: number; nome: string } | null; areas: Area[] };
type KeypadButton = { id: number; ordem: number; circuito_id: number | null };
type Keypad = {
  id: number;
  nome: string;
  hsnet: number;
  button_count: number;
  buttons: KeypadButton[];
  ambiente?: { id: number; nome: string; area?: { id: number; nome: string } };
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

  const [data, setData] = useState<ProjetoTree>({ projeto: null, areas: [] });
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
  
  const m4hsnet = "245";
  const m4devid = "1";
  const softwareVersion = "1.0.8.67";

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
      setData({ projeto: json?.projeto || null, areas: json?.areas || [] });
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

  const countCircuitos = (areas: Area[]) => {
    const counts = { luz: 0, persiana: 0, hvac: 0 };
    areas.forEach(area => {
      area.ambientes.forEach(ambiente => {
        ambiente.circuitos.forEach(circuito => {
          if (circuito.tipo in counts) {
            counts[circuito.tipo as keyof typeof counts] += 1;
          }
        });
      });
    });
    return counts;
  };

  const counts = countCircuitos(data.areas);

  const validateAndSubmitRwp = (e: React.FormEvent<HTMLFormElement>) => {
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
    window.open(`/exportar-pdf/${id}`, "_blank");
  };

  const handlePrint = () => { window.print(); };

  return (
    <Layout projectSelected={projetoSelecionado === true}>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 mb-10">
            <div>
              <div className="flex items-center gap-4 mb-4">
                <div className="w-16 h-16 bg-gradient-to-br from-gray-500 to-gray-600 rounded-3xl flex items-center justify-center shadow-lg shadow-blue-500/25">
                  <LayoutList className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h1 className="text-4xl font-bold text-slate-900 mb-2">Visão Geral do Projeto</h1>
                  <p className="text-lg text-slate-600 max-w-2xl">
                    Visualize todos os circuitos, módulos e vinculações do seu projeto.
                  </p>
                </div>
              </div>
              <div className="h-1 w-32 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full shadow-sm" />
            </div>
            <div className="flex flex-col md:flex-row gap-4">
              <Button
                onClick={openPdf}
                className="group flex items-center gap-2 h-12 px-6 rounded-full border border-blue-600 bg-blue-600 hover:bg-blue-700 text-white transition-all duration-300 shadow-lg hover:shadow-xl"
                disabled={isLocked || loading}
              >
                <FileOutput className="h-4 w-4" />
                Gerar AS BUILT
              </Button>
              <Button
                onClick={() => setShowRwp(true)}
                className="group flex items-center gap-2 h-12 px-6 rounded-full border border-blue-600 bg-blue-600 hover:bg-blue-700 text-white transition-all duration-300 shadow-lg hover:shadow-xl"
                disabled={isLocked || loading}
              >
                <FileDown className="h-4 w-4" />
                Gerar RWP
              </Button>
              <Button
                onClick={() => { fetchProjectData(); fetchKeypads(); }}
                variant="outline"
                className="group flex items-center gap-2 h-12 px-6 rounded-full border-slate-200 text-slate-600 hover:text-slate-900 transition-all duration-300"
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
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}>
                <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-xl shadow-slate-900/5">
                  <CardHeader className="pb-6">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-violet-600 rounded-2xl flex items-center justify-center shadow-lg">
                        <LayoutList className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <CardTitle className="text-2xl font-bold text-slate-900">Resumo de Circuitos</CardTitle>
                        <p className="text-slate-600 mt-1">Visão geral dos circuitos cadastrados.</p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="flex flex-col items-center justify-center rounded-xl p-6 bg-slate-50/50">
                      <Lightbulb className="h-8 w-8 text-yellow-500 mb-2" />
                      <div className="text-2xl font-bold text-slate-900">{counts.luz}</div>
                      <div className="text-sm text-slate-600">Circuitos de Luz</div>
                    </div>
                    <div className="flex flex-col items-center justify-center rounded-xl p-6 bg-slate-50/50">
                      <Blinds className="h-8 w-8 text-blue-500 mb-2" />
                      <div className="text-2xl font-bold text-slate-900">{counts.persiana}</div>
                      <div className="text-sm text-slate-600">Circuitos de Persiana</div>
                    </div>
                    <div className="flex flex-col items-center justify-center rounded-xl p-6 bg-slate-50/50">
                      <Snowflake className="h-8 w-8 text-green-500 mb-2" />
                      <div className="text-2xl font-bold text-slate-900">{counts.hvac}</div>
                      <div className="text-sm text-slate-600">Circuitos de HVAC</div>
                    </div>
                    <div className="flex flex-col items-center justify-center rounded-xl p-6 bg-slate-50/50">
                      <KeySquare className="h-8 w-8 text-violet-600 mb-2" />
                      <div className="text-2xl font-bold text-slate-900">{keypadCount}</div>
                      <div className="text-sm text-slate-600">Keypads</div>
                    </div>

                  </CardContent>
                </Card>
              </motion.div>

              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}>
                <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-xl shadow-slate-900/5">
                  <CardHeader className="pb-6">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center shadow-lg">
                        <FileOutput className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <CardTitle className="text-2xl font-bold text-slate-900">Árvore do Projeto</CardTitle>
                        <p className="text-slate-600 mt-1">Estrutura completa do projeto.</p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {data.areas.length === 0 ? (
                      <div className="text-center py-12">
                        <LayoutList className="h-12 w-12 text-slate-400 mx-auto mb-3" />
                        <h4 className="text-xl font-semibold text-slate-900 mb-2">
                          Nenhuma área, ambiente ou circuito cadastrado.
                        </h4>
                        <p className="text-slate-600">
                          Use as páginas "Áreas", "Ambientes" e "Circuitos" para começar a estruturar seu projeto.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        {data.areas.map((area, index) => (
                          <motion.div key={area.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.1 }}>
                            <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                              {area.nome}
                            </h3>
                            <div className="ml-4 mt-2 space-y-4">
                              {area.ambientes.map((ambiente, ambIndex) => (
                                <div key={ambiente.id} className="border-l-2 border-slate-200 pl-4 relative before:content-[''] before:absolute before:left-0 before:top-3 before:w-4 before:h-px before:bg-slate-200">
                                  <h4 className="font-semibold text-slate-700 flex items-center gap-2">
                                    {ambiente.nome}
                                  </h4>
                                  <div className="mt-2 space-y-2">
                                    {ambiente.circuitos.length === 0 ? (
                                      <p className="text-sm text-slate-500 italic">Nenhum circuito neste ambiente.</p>
                                    ) : (
                                      <ul className="space-y-2">
                                        {ambiente.circuitos.map((circuito) => (
                                          <li key={circuito.id} className="text-sm text-slate-600 flex items-center gap-2">
                                            <span className="h-2 w-2 rounded-full bg-slate-400"></span>
                                            {circuito.identificador} - {circuito.nome}
                                            {circuito.vinculacao ? (
                                              <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                                                Vinc. em {circuito.vinculacao.modulo_nome} (Canal {circuito.vinculacao.canal})
                                              </span>
                                            ) : (
                                              <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                                                Não Vinculado
                                              </span>
                                            )}
                                          </li>
                                        ))}
                                      </ul>
                                    )}
                                    {/* Keypads do ambiente */}
                                    {(() => {
                                      const kps = keypads.filter(k => k.ambiente?.id === ambiente.id);
                                      if (kps.length === 0) {
                                        return (
                                          <p className="text-sm text-slate-500 mt-3">
                                            Nenhum keypad neste ambiente.
                                          </p>
                                        );
                                      }
                                      return (
                                        <div className="mt-4">
                                          <h5 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                                            <KeySquare className="h-4 w-4 text-violet-600" />
                                            Keypads
                                          </h5>
                                          <ul className="space-y-2">
                                            {kps.map((k) => {
                                              const linked = k.buttons.filter(b => b.circuito_id != null).length;
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
                                                <li key={k.id} className="text-sm text-slate-600 flex items-center justify-between gap-2">
                                                  <div className="flex items-center gap-2">
                                                    <span className="h-2 w-2 rounded-full bg-violet-400"></span>
                                                    <span className="font-medium text-slate-800">{k.nome}</span>
                                                    <span className="text-xs text-slate-500">HSNET {k.hsnet}</span>
                                                    <span className="text-xs text-slate-500">• {total} tecla(s)</span>
                                                    <span className="text-xs text-slate-500 flex items-center gap-1">
                                                      <Link2 className="h-3 w-3" /> {linked}/{total} vinculadas
                                                    </span>
                                                  </div>
                                                  <Badge className={`text-xs px-2 py-0.5 ${statusClass}`}>
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
                              ))}
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
                  className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
                >
                  <div className="p-6 md:p-8">
                    <h3 className="text-2xl font-bold mb-4">Gerar Arquivo de Configuração (.rwp)</h3>
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

                      <section>
                        <h4 className="text-primary text-sm font-semibold mb-2 border-b pb-1">Informações do Projeto</h4>
                        <div>
                          <Label htmlFor="project_name">Nome do Projeto</Label>
                          <Input id="project_name" name="project_name" value={projectName} onChange={(e) => setProjectName(e.target.value)} required />
                          <p className="text-xs text-muted-foreground mt-1">Será baseado no projeto atual selecionado.</p>
                        </div>
                      </section>

                      <section>
                        <h4 className="text-primary text-sm font-semibold mb-2 border-b pb-1">Informações do Cliente</h4>
                        <div className="grid md:grid-cols-2 gap-3">
                          <div>
                            <Label htmlFor="client_name">Nome do Cliente</Label>
                            <Input id="client_name" name="client_name" value={clientName} onChange={(e) => setClientName(e.target.value)} required />
                          </div>
                          <div>
                            <Label htmlFor="client_email">Email do Cliente</Label>
                            <Input id="client_email" name="client_email" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} />
                          </div>
                          <div>
                            <Label htmlFor="client_phone">Telefone</Label>
                            <Input id="client_phone" name="client_phone" placeholder="(00) 00000-0000" value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} />
                            <p className="text-xs text-muted-foreground mt-1">Digite com DDD; validaremos no envio.</p>
                          </div>
                        </div>
                      </section>

                      <section>
                        <h4 className="text-primary text-sm font-semibold mb-2 border-b pb-1">Configurações Técnicas</h4>
                        <div className="grid md:grid-cols-3 gap-3">
                          <div>
                            <Label htmlFor="timezone_id">Timezone</Label>
                            <Input id="timezone_id" name="timezone_id" value={timezoneId} onChange={(e) => setTimezoneId(e.target.value)} required />
                          </div>
                          <div>
                            <Label htmlFor="lat">Latitude</Label>
                            <Input id="lat" name="lat" value={lat} onChange={(e) => setLat(e.target.value)} />
                          </div>
                          <div>
                            <Label htmlFor="lon">Longitude</Label>
                            <Input id="lon" name="lon" value={lon} onChange={(e) => setLon(e.target.value)} />
                          </div>
                        </div>
                        <div className="grid md:grid-cols-3 gap-3 mt-3">
                          <div>
                            <Label htmlFor="tech_area">Área Técnica</Label>
                            <Input id="tech_area" name="tech_area" value={techArea} onChange={(e) => setTechArea(e.target.value)} required />
                          </div>
                          <div>
                            <Label htmlFor="tech_room">Sala Técnica</Label>
                            <Input id="tech_room" name="tech_room" value={techRoom} onChange={(e) => setTechRoom(e.target.value)} required />
                          </div>
                          <div>
                            <Label htmlFor="board_name">Nome do Quadro</Label>
                            <Input id="board_name" name="board_name" value={boardName} onChange={(e) => setBoardName(e.target.value)} required />
                          </div>
                        </div>
                        <div className="grid md:grid-cols-3 gap-3 mt-3">
                          <div className="md:col-span-1">
                            <Label htmlFor="m4_ip">IP do Módulo M4</Label>
                            <Input id="m4_ip" name="m4_ip" value={m4ip} onChange={(e) => setM4ip(e.target.value)} required />
                          </div>
                        </div>
                      </section>

                      <div className="flex flex-col sm:flex-row justify-end gap-2 mt-6">
                        <Button type="button" variant="ghost" onClick={() => setShowRwp(false)} className="w-full sm:w-auto">
                          Fechar
                        </Button>
                        <Button type="submit" className="w-full sm:w-auto">
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