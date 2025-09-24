import { useEffect, useMemo, useState } from "react";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Trash2, PlusCircle, Zap, DoorOpen, Sparkles, Lightbulb, Blinds, Snowflake, Search, Filter, X } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useProject } from "@/store/project";
import { motion, AnimatePresence } from "framer-motion";


type Ambiente = { id: number; nome: string; area?: { id: number; nome: string } };
type Circuito = {
  id: number;
  identificador: string;
  nome: string;
  tipo: "luz" | "persiana" | "hvac";
  dimerizavel?: boolean; // Novo campo opcional
  ambiente: { id: number; nome: string; area?: { id: number; nome: string } };
  sak?: string | null;
};

export default function Circuitos() {
  const { toast } = useToast();
  const { projeto } = useProject();
  const [ambientes, setAmbientes] = useState<Ambiente[]>([]);
  const [circuitos, setCircuitos] = useState<Circuito[]>([]);
  const [loading, setLoading] = useState(true);
  const [projetoSelecionado, setProjetoSelecionado] = useState(false);
  const [dimerizavel, setDimerizavel] = useState(false);


  // Estados para filtros
  const [searchTerm, setSearchTerm] = useState("");
  const [tipoFilter, setTipoFilter] = useState<"luz" | "persiana" | "hvac" | "todos">("todos");
  const [ambienteFilter, setAmbienteFilter] = useState<number | "todos">("todos");

  // form
  const [identificador, setIdentificador] = useState("");
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState<"luz" | "persiana" | "hvac">("luz");
  const [ambienteId, setAmbienteId] = useState<number | "">("");

  useEffect(() => {
    if (tipo !== 'luz') {
      setDimerizavel(false);
    }
  }, [tipo]); 

  // Circuitos filtrados
  const circuitosFiltrados = useMemo(() => {
    return circuitos.filter(circuito => {
      // Filtro por texto (nome ou identificador)
      const matchesSearch = searchTerm === "" || 
        circuito.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        circuito.identificador.toLowerCase().includes(searchTerm.toLowerCase());
      
      // Filtro por tipo
      const matchesTipo = tipoFilter === "todos" || circuito.tipo === tipoFilter;
      
      // Filtro por ambiente
      const matchesAmbiente = ambienteFilter === "todos" || circuito.ambiente.id === ambienteFilter;
      
      return matchesSearch && matchesTipo && matchesAmbiente;
    });
  }, [circuitos, searchTerm, tipoFilter, ambienteFilter]);


  const checkAndFetchData = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/projeto_atual", {
        credentials: "same-origin",
      });
      const projectData = await response.json();

      if (projectData.ok && projectData.projeto_atual) {
        setProjetoSelecionado(true);
        const [ambRes, circRes] = await Promise.all([
          fetch("/api/ambientes", { credentials: "same-origin" }),
          fetch("/api/circuitos", { credentials: "same-origin" }),
        ]);

        if (!ambRes.ok || !circRes.ok) {
          throw new Error("Falha ao carregar dados");
        }

        const ambData = await ambRes.json();
        const circData = await circRes.json();

        setAmbientes(ambData?.ambientes || ambData || []);
        setCircuitos(circData?.circuitos || circData || []);
      } else {
        setProjetoSelecionado(false);
        setAmbientes([]);
        setCircuitos([]);
      }
    } catch (error) {
      console.error("Erro ao verificar/carregar dados do projeto:", error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Falha ao carregar dados. Verifique se há um projeto selecionado.",
      });
      setProjetoSelecionado(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      console.error("Unhandled promise rejection:", event.reason);
      event.preventDefault();
    };

    window.addEventListener("unhandledrejection", handleUnhandledRejection);

    checkAndFetchData();

    return () => {
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
    };
  }, []);

  const ambienteOptions = useMemo(
    () =>
      ambientes.map((a) => ({
        id: a.id,
        label: a.area?.nome ? `${a.nome} (${a.area.nome})` : a.nome,
      })),
    [ambientes],
  );

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!identificador.trim() || !nome.trim() || !tipo || !ambienteId) {
      toast({ variant: "destructive", title: "Erro", description: "Preencha todos os campos." });
      return;
    }
    try {
      const res = await fetch("/api/circuitos", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          identificador: identificador.trim(),
          nome: nome.trim(),
          tipo,
          dimerizavel: tipo === 'luz' ? dimerizavel : false, // Só envia se for luz
          ambiente_id: ambienteId,
        }),
      });

      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }

      const data = await res.json();

      if (data?.ok || data?.success) {
        // Mantemos o tipo selecionado, apenas resetamos os outros campos
        setIdentificador("");
        setNome("");
        setDimerizavel(false);
       
        //setAmbienteId("");
        checkAndFetchData().catch((error) => {
          console.error("Erro ao recarregar dados:", error);
        });
        toast({ title: "Sucesso!", description: "Circuito adicionado." });
      } else {
        toast({
          variant: "destructive",
          title: "Erro",
          description: data?.error || data?.message || "Falha ao adicionar circuito.",
        });
      }
    } catch (error) {
      console.error("Erro ao criar circuito:", error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Falha ao se conectar ao servidor.",
      });
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Tem certeza que deseja excluir este circuito?")) return;
    try {
      const res = await fetch(`/api/circuitos/${id}`, {
        method: "DELETE",
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });

      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }

      const data = await res.json();

      if (data?.ok || data?.success) {
        setCircuitos((prev) => prev.filter((c) => c.id !== id));
        toast({ title: "Sucesso!", description: "Circuito excluído." });
      } else {
        toast({
          variant: "destructive",
          title: "Erro",
          description: data?.error || data?.message || "Falha ao excluir circuito.",
        });
      }
    } catch (error) {
      console.error("Erro ao excluir circuito:", error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Falha ao se conectar ao servidor.",
      });
    }
  }

  return (
    <Layout projectSelected={projetoSelecionado}>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 mb-10">
            <div>
              <div className="flex items-center gap-4 mb-4">
                <div className="w-16 h-16 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-3xl flex items-center justify-center shadow-lg shadow-blue-500/25">
                  <Zap className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h1 className="text-4xl font-bold text-slate-900 mb-2">Gerenciar Circuitos</h1>
                  <p className="text-lg text-slate-600 max-w-2xl">
                    Cadastre os circuitos elétricos do seu projeto.
                  </p>
                </div>
              </div>
              <div className="h-1 w-32 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full shadow-sm" />
            </div>
          </div>

          {!projetoSelecionado && !loading && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
              <Alert className="bg-amber-50 border-amber-200 shadow-sm">
                <Sparkles className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-amber-800">
                  Selecione um projeto na página inicial para cadastrar circuitos.
                </AlertDescription>
              </Alert>
            </motion.div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Card de Adicionar Circuito */}
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}>
              <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-xl shadow-slate-900/5">
                <CardHeader className="pb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center shadow-lg">
                      <PlusCircle className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-2xl font-bold text-slate-900">Adicionar Novo Circuito</CardTitle>
                      <p className="text-slate-600 mt-1">Preencha as informações do circuito</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <form className="space-y-6" onSubmit={handleCreate}>
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="identificador" className="text-sm font-semibold text-slate-700">
                          Identificador *
                        </Label>
                        <Input
                          id="identificador"
                          placeholder="Ex: C001, L01..."
                          value={identificador}
                          onChange={(e) => setIdentificador(e.target.value)}
                          required
                          disabled={!projetoSelecionado}
                          className="h-12 px-4 rounded-xl border-slate-200 focus:border-blue-500 focus:ring-blue-500/20"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="nome" className="text-sm font-semibold text-slate-700">
                          Nome do Circuito *
                        </Label>
                        <Input
                          id="nome"
                          placeholder="Digite o nome do circuito..."
                          value={nome}
                          onChange={(e) => setNome(e.target.value)}
                          required
                          disabled={!projetoSelecionado}
                          className="h-12 px-4 rounded-xl border-slate-200 focus:border-blue-500 focus:ring-blue-500/20"
                        />
                      </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="tipo" className="text-sm font-semibold text-slate-700">
                          Tipo *
                        </Label>

                        <Select
                          value={tipo}
                          onValueChange={(v) => setTipo(v as "luz" | "persiana" | "hvac")}
                          disabled={!projetoSelecionado}
                        >
                          <SelectTrigger id="tipo" className="h-12 w-full rounded-xl border border-slate-200 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all">
                            <SelectValue placeholder="Selecione o tipo" />
                          </SelectTrigger>

                          <SelectContent className="rounded-xl">
                            <SelectItem value="luz">
                              <div className="flex items-center gap-2">
                                <Lightbulb className="h-4 w-4 text-yellow-500" />
                                <span>Luz</span>
                              </div>
                            </SelectItem>
                            <SelectItem value="persiana">
                              <div className="flex items-center gap-2">
                                <Blinds className="h-4 w-4 text-blue-500" />
                                <span>Persiana</span>
                              </div>
                            </SelectItem>
                            <SelectItem value="hvac">
                              <div className="flex items-center gap-2">
                                <Snowflake className="h-4 w-4 text-green-500" />
                                <span>HVAC</span>
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {tipo === 'luz' && (
                        <div className="flex items-center space-x-2 p-3 bg-slate-50 rounded-xl border border-slate-200">
                          <input
                            type="checkbox"
                            id="dimerizavel"
                            checked={dimerizavel}
                            onChange={(e) => setDimerizavel(e.target.checked)}
                            className="h-4 w-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                          />
                          <label htmlFor="dimerizavel" className="text-sm font-medium text-slate-700 flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-blue-500" />
                            Circuito dimerizável
                          </label>
                        </div>
                      )}

                      <div className="space-y-2">
                        <Label htmlFor="ambiente_id" className="text-sm font-semibold text-slate-700">
                          Ambiente *
                        </Label>
                        <select
                          id="ambiente_id"
                          className="h-12 w-full px-4 rounded-xl border border-slate-200 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                          value={ambienteId as any}
                          onChange={(e) => setAmbienteId(Number(e.target.value))}
                          required
                          disabled={!projetoSelecionado || loading || ambientes.length === 0}
                        >
                          <option value="">{loading ? "Carregando ambientes..." : "Selecione um ambiente"}</option>
                          {!loading && ambienteOptions.map((opt) => (
                            <option key={opt.id} value={opt.id}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                        {!loading && projetoSelecionado && ambientes.length === 0 && (
                          <p className="text-sm text-amber-600 mt-1 flex items-center gap-1">
                            <Sparkles className="w-3 h-3" />
                            Nenhum ambiente disponível. Crie ambientes primeiro.
                          </p>
                        )}
                      </div>
                    </div>

                    <Button
                      type="submit"
                      className="w-full h-12 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center gap-2"
                      disabled={!projetoSelecionado || loading || ambientes.length === 0}
                    >
                      <PlusCircle className="h-5 w-5" />
                      Adicionar Circuito
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </motion.div>

            {/* Card de Circuitos Cadastrados com Filtros */}
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}>
              <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-xl shadow-slate-900/5">
                <CardHeader className="pb-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-2xl flex items-center justify-center shadow-lg">
                        <Zap className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <CardTitle className="text-2xl font-bold text-slate-900">Circuitos Cadastrados</CardTitle>
                        <p className="text-slate-600 mt-1">Lista de todos os circuitos</p>
                      </div>
                    </div>
                    <Badge className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white text-sm font-medium px-3 py-1">
                      {circuitosFiltrados.length} de {circuitos.length} {circuitos.length === 1 ? "circuito" : "circuitos"}
                    </Badge>
                  </div>
                  
                  {/* Barra de Filtros */}
                  <div className="mt-6 space-y-4">
                    {/* Filtro de Busca por Texto */}
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                      <Input
                        placeholder="Buscar por nome ou identificador..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 pr-10 h-10 rounded-xl border-slate-200 focus:border-blue-500"
                      />
                      {searchTerm && (
                        <button
                          onClick={() => setSearchTerm("")}
                          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    
                    {/* Filtros de Tipo e Ambiente */}
                    <div className="grid grid-cols-2 gap-3">
                      {/* Filtro por Tipo */}
                      <div className="space-y-1">
                        <Label htmlFor="filtro-tipo" className="text-xs font-medium text-slate-600">
                          Tipo
                        </Label>
                        <Select value={tipoFilter} onValueChange={(v: any) => setTipoFilter(v)}>
                          <SelectTrigger id="filtro-tipo" className="h-9 text-sm rounded-xl">
                            <SelectValue placeholder="Todos os tipos" />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl">
                            <SelectItem value="todos">Todos os tipos</SelectItem>
                            <SelectItem value="luz">Luz</SelectItem>
                            <SelectItem value="persiana">Persiana</SelectItem>
                            <SelectItem value="hvac">HVAC</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      {/* Filtro por Ambiente */}
                      <div className="space-y-1">
                        <Label htmlFor="filtro-ambiente" className="text-xs font-medium text-slate-600">
                          Ambiente
                        </Label>
                        <Select 
                          value={ambienteFilter === "todos" ? "todos" : ambienteFilter.toString()} 
                          onValueChange={(v) => setAmbienteFilter(v === "todos" ? "todos" : parseInt(v))}
                        >
                          <SelectTrigger id="filtro-ambiente" className="h-9 text-sm rounded-xl">
                            <SelectValue placeholder="Todos os ambientes" />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl">
                            <SelectItem value="todos">Todos os ambientes</SelectItem>
                            {ambientes.map(ambiente => (
                              <SelectItem key={ambiente.id} value={ambiente.id.toString()}>
                                {ambiente.nome}
                                {ambiente.area && ` (${ambiente.area.nome})`}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    
                    {/* Botão para limpar todos os filtros */}
                    {(searchTerm || tipoFilter !== "todos" || ambienteFilter !== "todos") && (
                      <div className="flex justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSearchTerm("");
                            setTipoFilter("todos");
                            setAmbienteFilter("todos");
                          }}
                          className="h-8 text-xs rounded-lg gap-1"
                        >
                          <X className="w-3 h-3" />
                          Limpar filtros
                        </Button>
                      </div>
                    )}
                  </div>
                </CardHeader>
                
                <CardContent>
                  {loading ? (
                    <div className="flex flex-col justify-center items-center py-12">
                      <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent mb-4"></div>
                      <p className="text-slate-600 font-medium">Carregando circuitos...</p>
                    </div>
                  ) : circuitos.length === 0 ? (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-center py-12"
                    >
                      <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Zap className="h-10 w-10 text-slate-400" />
                      </div>
                      <h4 className="text-xl font-semibold text-slate-900 mb-2">
                        {projetoSelecionado ? "Nenhum circuito cadastrado" : "Selecione um projeto"}
                      </h4>
                      <p className="text-slate-600 max-w-sm mx-auto">
                        {projetoSelecionado
                          ? "Comece adicionando seu primeiro circuito usando o formulário ao lado."
                          : "Selecione um projeto para visualizar e gerenciar os circuitos."}
                      </p>
                    </motion.div>
                  ) : circuitosFiltrados.length === 0 ? (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-center py-12"
                    >
                      <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Search className="h-10 w-10 text-slate-400" />
                      </div>
                      <h4 className="text-xl font-semibold text-slate-900 mb-2">
                        Nenhum circuito encontrado
                      </h4>
                      <p className="text-slate-600 max-w-sm mx-auto">
                        Tente ajustar os filtros de busca para encontrar o que procura.
                      </p>
                    </motion.div>
                  ) : (
                    <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                      <AnimatePresence>
                        {circuitosFiltrados.map((c, index) => (
                          <motion.div
                            key={c.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            transition={{ delay: index * 0.05 }}
                            className="group relative overflow-hidden rounded-2xl border border-slate-200/60 bg-white/60 backdrop-blur-sm p-4 hover:bg-white/80 hover:shadow-lg hover:shadow-slate-900/5 transition-all duration-300"
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1 mr-4">
                                <div className="flex items-center gap-3 mb-2">
                                  <Badge
                                    className={`text-xs font-medium px-2 py-1 flex items-center gap-1 ${
                                      c.tipo === "luz"
                                        ? dimerizavel 
                                          ? "bg-purple-100 text-purple-800" // Cor diferente para dimerizável
                                          : "bg-yellow-100 text-yellow-800"
                                        : c.tipo === "persiana"
                                          ? "bg-blue-100 text-blue-800"
                                          : "bg-green-100 text-green-800"
                                    }`}
                                  >
                                    {c.tipo === "luz" ? (
                                      <Lightbulb className="h-3 w-3" />
                                    ) : c.tipo === "persiana" ? (
                                      <Blinds className="h-3 w-3" />
                                    ) : (
                                      <Snowflake className="h-3 w-3" />
                                    )}
                                    {c.tipo.toUpperCase()}
                                    {c.tipo === "luz" && c.dimerizavel && (
                                      <Sparkles className="h-3 w-3 ml-1" />
                                    )}
                                  </Badge>

                                  <span className="text-sm font-mono text-slate-500 bg-slate-100 px-2 py-1 rounded-lg">
                                    {c.identificador}
                                  </span>
                                </div>
                                <h4 className="font-bold text-slate-900 text-lg mb-2">{c.nome}</h4>
                                <div className="flex items-center gap-2 text-sm text-slate-600 mb-2">
                                  <DoorOpen className="h-4 w-4 text-slate-400" />
                                  <span className="font-medium">{c.ambiente?.nome}</span>
                                  {c.ambiente?.area?.nome && (
                                    <>
                                      <span className="text-slate-400">•</span>
                                      <span className="text-slate-500">Área: {c.ambiente.area.nome}</span>
                                    </>
                                  )}
                                </div>
                                <div className="text-xs text-slate-500">
                                  <span className="font-medium">SAK: </span>
                                  {c.tipo !== "hvac" ? (
                                    (c.sak ?? <span className="italic opacity-60">Não definido</span>)
                                  ) : (
                                    <span className="opacity-60">Não aplicável</span>
                                  )}
                                  {c.tipo === "luz" && (
                                    <>
                                      <span className="mx-2">•</span>
                                      <span className="font-medium">Tipo: </span>
                                      {c.dimerizavel ? "Dimmer" : "ON/OFF"}
                                    </>
                                  )}
                                </div>
                              </div>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => handleDelete(c.id)}
                                disabled={!projetoSelecionado}
                                className="opacity-0 group-hover:opacity-100 transition-all duration-300 rounded-xl shadow-lg hover:shadow-xl"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </motion.div>
                        ))}
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