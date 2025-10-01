import { useEffect, useMemo, useState } from "react";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useProject } from "@/store/project";
import {
  PlusCircle,
  Trash2,
  Keyboard,
  PanelsTopLeft,
  Sparkles,
  DoorOpen,
  Link2,
  X,
  Edit,
  RefreshCw,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// ---------- Tipos ----------
type AreaLite = { id: number; nome: string };
type Ambiente = { id: number; nome: string; area?: AreaLite };

type KeypadButton = {
    id: number;
    ordem: number;
    circuito_id: number | null;
};

type Keypad = {
  id: number;
  nome: string;
  hsnet: number;
  color: string;
  button_color: string;
  button_count: number;
  ambiente?: { id: number; nome: string; area?: AreaLite };
  buttons: KeypadButton[];
};

type Circuito = {
  id: number;
  identificador: string;
  nome: string | null;
  tipo: 'luz' | 'persiana' | 'hvac';
  ambiente?: {
    id: number;
    nome: string;
    area?: { id: number; nome: string } | null;
  } | null;
};


type ButtonBinding = {
  index: number;
  circuito_id: number | null;
};

const COLORS = [
  "WHITE",
  "BRASS",
  "BRUSHED BLACK",
  "BLACK",
  "BRONZE",
  "NICKEL",
  "SILVER",
  "TITANIUM",
] as const;

const KEYCOLORS = ["WHITE", "BLACK"] as const;

const BUTTON_COUNTS: { label: string; value: 1 | 2 | 4 }[] = [
  { label: "1 tecla", value: 1 },
  { label: "2 teclas", value: 2 },
  { label: "4 teclas", value: 4 },
];


// ---------- Componente ----------
export default function Keypads() {
  const { toast } = useToast();
  const { projeto } = useProject();

  // Dados base
  const [ambientes, setAmbientes] = useState<Ambiente[]>([]);
  const [keypads, setKeypads] = useState<Keypad[]>([]);
  const [circuitos, setCircuitos] = useState<Circuito[]>([]);

  // Estados de controle
  const [loading, setLoading] = useState(true);
  const [loadingSubmit, setLoadingSubmit] = useState(false);
  const [projetoSelecionado, setProjetoSelecionado] = useState(false);
  const [selectedKeypadId, setSelectedKeypadId] = useState<number | null>(null);

  // Form
  const [form, setForm] = useState({
      nome: "",
      hsnet: '' as number | '',
      color: "" as (typeof COLORS)[number] | "",
      button_color: "" as (typeof KEYCOLORS)[number] | "",
      button_count: '' as 1 | 2 | 4 | '',
      ambiente_id: '' as number | '',
  });
  const [loadingNextHsnet, setLoadingNextHsnet] = useState(false);

  // Modal de vinculação
  const [bindingsOpen, setBindingsOpen] = useState(false);
  const [bindingLoading, setBindingLoading] = useState(false);
  const [bindingKeypad, setBindingKeypad] = useState<Keypad | null>(null);
  const [buttonBindings, setButtonBindings] = useState<ButtonBinding[]>([]);

  // Filtros
  const [q, setQ] = useState("");
  const [areaIdFilter, setAreaIdFilter] = useState<number | "">("");
  const [ambIdFilter, setAmbIdFilter] = useState<number | "">("");
  const [btnCountFilter, setBtnCountFilter] = useState<1 | 2 | 4 | "">("");

  const isEditing = selectedKeypadId !== null;

  // Popula o formulário quando um keypad é selecionado
  useEffect(() => {
    if (isEditing) {
      const keypad = keypads.find(k => k.id === selectedKeypadId);
      if (keypad) {
        setForm({
          nome: keypad.nome,
          hsnet: keypad.hsnet,
          color: keypad.color as any,
          button_color: keypad.button_color as any,
          button_count: keypad.button_count as any,
          ambiente_id: keypad.ambiente?.id ?? '',
        });
      }
    } else {
      resetForm();
    }
  }, [selectedKeypadId, keypads, isEditing]);

  // Opções únicas de Área/Ambiente a partir dos keypads
  const areaOptions = useMemo(() => {
    const map = new Map<number, string>();
    keypads.forEach(k => {
      const a = k.ambiente?.area;
      if (a?.id) map.set(a.id, a.nome);
    });
    return Array.from(map, ([id, nome]) => ({ id, nome })).sort((a,b)=>a.nome.localeCompare(b.nome));
  }, [keypads]);

  const ambienteOptions = useMemo(() => {
    const list: { id:number; nome:string; areaId:number }[] = [];
    const seen = new Set<number>();
    keypads.forEach(k => {
      const amb = k.ambiente;
      if (amb?.id && !seen.has(amb.id)) {
        list.push({ id: amb.id, nome: amb.nome, areaId: amb.area?.id ?? 0 });
        seen.add(amb.id);
      }
    });
    return list
      .filter(x => (areaIdFilter ? x.areaId === areaIdFilter : true))
      .sort((a,b)=>a.nome.localeCompare(b.nome));
  }, [keypads, areaIdFilter]);

  const filteredKeypads = useMemo(() => {
    const term = q.trim().toLowerCase();
    return keypads.filter(k => {
      const matchesQ = !term || [
        k.nome,
        k.ambiente?.nome,
        k.ambiente?.area?.nome,
        String(k.hsnet ?? "")
      ].some(v => String(v ?? "").toLowerCase().includes(term));
      const matchesArea = !areaIdFilter || k.ambiente?.area?.id === areaIdFilter;
      const matchesAmb = !ambIdFilter || k.ambiente?.id === ambIdFilter;
      const matchesCount = !btnCountFilter || k.button_count === btnCountFilter;
      return matchesQ && matchesArea && matchesAmb && matchesCount;
    });
  }, [keypads, q, areaIdFilter, ambIdFilter, btnCountFilter]);

  useEffect(() => {
    if (projetoSelecionado && !isEditing && form.hsnet === '') {
      fetchNextHsnet();
    }
  }, [projetoSelecionado, isEditing, form.hsnet]);

  async function fetchNextHsnet() {
    try {
      setLoadingNextHsnet(true);
      const res = await fetch("/api/keypads/next-hsnet", { credentials: "same-origin" });
      const data = await res.json();
      if (res.ok && data?.ok && typeof data.hsnet === "number") {
        setForm(prev => ({ ...prev, hsnet: data.hsnet }));
      }
    } catch (e) {
      // ignore
    } finally {
      setLoadingNextHsnet(false);
    }
  }
  
  async function loadData() {
    setLoading(true);
    try {
      const p = await fetch('/api/projeto_atual', { credentials: 'same-origin' }).then(r=>r.json()).catch(()=>null);
      const temProjeto = !!(p?.ok && p?.projeto_atual);
      setProjetoSelecionado(temProjeto);

      if (!temProjeto) {
        setAmbientes([]); setKeypads([]); setCircuitos([]);
        return;
      }

      const [ambRes, kpRes, circRes] = await Promise.all([
        fetch('/api/ambientes', { credentials: 'same-origin' }),
        fetch('/api/keypads',   { credentials: 'same-origin' }),
        fetch('/api/circuitos', { credentials: 'same-origin' }),
      ]);

      const [amb, kp, circ] = await Promise.all([ambRes.json(), kpRes.json(), circRes.json()]);

      setAmbientes(amb?.ambientes || amb || []);
      setKeypads(kp?.keypads || kp || []);
      setCircuitos(circ?.circuitos || circ || []);
    } catch (err) {
      console.error(err);
      toast({ variant: 'destructive', title: 'Erro', description: 'Falha ao carregar dados.' });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [projeto?.id]);

  type KeypadStatus = "vazio" | "parcial" | "completo";

  function computeKeypadStatus(kp: Keypad): { status: KeypadStatus; linked: number; total: number } {
    const total = kp.button_count || 0;
    const linked = (kp.buttons || []).filter(b => !!b?.circuito_id).length;
    if (total === 0) return { status: "vazio", linked: 0, total: 0 };
    if (linked === 0) return { status: "vazio", linked, total };
    if (linked === total) return { status: "completo", linked, total };
    return { status: "parcial", linked, total };
  }

  function statusBadgeClasses(status: KeypadStatus) {
    switch (status) {
      case "completo": return "bg-emerald-100 text-emerald-800 border border-emerald-200";
      case "parcial": return "bg-amber-100 text-amber-800 border border-amber-200";
      default: return "bg-slate-100 text-slate-700 border border-slate-200";
    }
  }

  function statusLabel(status: KeypadStatus) {
    return status === "completo" ? "Completo" : status === "parcial" ? "Parcial" : "Vazio";
  }

  function resetForm() {
    setForm({
        nome: "", hsnet: '', color: "", button_color: "",
        button_count: '', ambiente_id: '',
    });
    setSelectedKeypadId(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const { nome, hsnet, color, button_color, button_count, ambiente_id } = form;
    if (!nome.trim() || !hsnet || !color || !button_color || !button_count || !ambiente_id) {
      toast({ variant: "destructive", title: "Erro", description: "Preencha todos os campos obrigatórios." });
      return;
    }

    const payload = {
      nome: nome.trim(),
      hsnet: Number(hsnet),
      color,
      button_color,
      button_count: Number(button_count),
      ambiente_id: Number(ambiente_id),
    };

    const url = isEditing ? `/api/keypads/${selectedKeypadId}` : "/api/keypads";
    const method = isEditing ? "PUT" : "POST";

    try {
      setLoadingSubmit(true);
      const res = await fetch(url, {
        method,
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.error || "Falha ao salvar keypad.");

      toast({ title: "Sucesso!", description: `Keypad ${isEditing ? 'atualizado' : 'criado'}.` });
      resetForm();
      await loadData();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Erro", description: String(err?.message || err) });
    } finally {
      setLoadingSubmit(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Tem certeza que deseja excluir este keypad?")) return;
    try {
      const res = await fetch(`/api/keypads/${id}`, { method: "DELETE", credentials: "same-origin" });
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.error || "Falha ao excluir.");

      if (selectedKeypadId === id) resetForm();
      await loadData();
      toast({ title: "Sucesso!", description: "Keypad excluído." });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Erro", description: String(err?.message || err) });
    }
  }

  function openBindings(kp: Keypad) {
    setBindingKeypad(kp);
    const base: ButtonBinding[] = Array.from({ length: kp.button_count }, (_, i) => {
        const existing = kp.buttons.find(b => b.ordem === i + 1);
        return { index: i, circuito_id: existing?.circuito_id ?? null };
    });
    setButtonBindings(base);
    setBindingsOpen(true);
  }

  function closeBindings() {
    setBindingsOpen(false);
    setBindingKeypad(null);
    setButtonBindings([]);
    setBindingLoading(false);
  }

  function setBinding(index: number, value: number | "") {
    setButtonBindings(prev =>
      prev.map(b => (b.index === index ? { ...b, circuito_id: value ? Number(value) : null } : b))
    );
  }

  async function saveBindings() {
    if (!bindingKeypad) return;
    try {
      setBindingLoading(true);
      await Promise.all(
        buttonBindings.map(b =>
          fetch(`/api/keypads/${bindingKeypad.id}/buttons/${b.index + 1}`, {
            method: "PUT",
            credentials: "same-origin",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify({ circuito_id: b.circuito_id }),
          })
        )
      );
      await loadData();
      toast({ title: "Vinculações salvas!", description: "As teclas foram atualizadas." });
      closeBindings();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Erro", description: String(err?.message || err) });
    } finally {
        setBindingLoading(false);
    }
  }

  return (
    <Layout projectSelected={projetoSelecionado}>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex items-center gap-4 mb-10">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-3xl flex items-center justify-center shadow-lg shadow-blue-500/25">
              <Keyboard className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-bold text-slate-900">Gerenciar Keypads</h1>
              <p className="text-lg text-slate-600">Cadastre, edite e vincule os keypads RQR-K do seu projeto.</p>
            </div>
          </div>

          {!projetoSelecionado && !loading && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
              <Alert className="bg-amber-50 border-amber-200 shadow-sm">
                <Sparkles className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-amber-800">
                  Selecione um projeto na página inicial para gerenciar keypads.
                </AlertDescription>
              </Alert>
            </motion.div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Coluna do Formulário */}
            <motion.div
                className="lg:col-span-4"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
            >
              <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-xl shadow-slate-900/5 sticky top-24">
                <CardHeader className="pb-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className={`w-12 h-12 bg-gradient-to-br ${isEditing ? 'from-orange-500 to-amber-500' : 'from-green-500 to-emerald-600'} rounded-2xl flex items-center justify-center shadow-lg`}>
                            {isEditing ? <Edit className="w-6 h-6 text-white" /> : <PlusCircle className="w-6 h-6 text-white" />}
                        </div>
                        <div>
                            <CardTitle className="text-2xl font-bold text-slate-900">{isEditing ? 'Editar Keypad' : 'Novo Keypad'}</CardTitle>
                            <p className="text-slate-600 mt-1">{isEditing ? 'Altere as informações do dispositivo.' : 'Preencha os dados para criar.'}</p>
                        </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <form className="space-y-4" onSubmit={handleSubmit}>
                    <div className="grid grid-cols-1 gap-4">
                      <div className="space-y-1">
                        <Label htmlFor="nome">Nome *</Label>
                        <Input id="nome" value={form.nome} onChange={e => setForm({...form, nome: e.target.value})} placeholder="Ex: Keypad da Suíte" required disabled={!projetoSelecionado} />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="hsnet">HSNET *</Label>
                        <div className="flex gap-2">
                          <Input id="hsnet" type="number" value={form.hsnet} onChange={e => setForm({...form, hsnet: Number(e.target.value) || ''})} placeholder="Ex: 110" required />
                          <Button type="button" variant="outline" size="icon" onClick={fetchNextHsnet} disabled={loadingNextHsnet}><RefreshCw className={`h-4 w-4 ${loadingNextHsnet ? 'animate-spin' : ''}`} /></Button>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <Label htmlFor="color">Corpo *</Label>
                        <select id="color" className="w-full h-10 px-3 rounded-md border border-slate-200 bg-white" value={form.color} onChange={e => setForm({...form, color: e.target.value as any})} required>
                          <option value="">Selecione</option>
                          {COLORS.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="button_color">Teclas *</Label>
                        <select id="button_color" className="w-full h-10 px-3 rounded-md border border-slate-200 bg-white" value={form.button_color} onChange={e => setForm({...form, button_color: e.target.value as any})} required>
                          <option value="">Selecione</option>
                          {KEYCOLORS.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1">
                        <div className="space-y-1">
                            <Label>Layout *</Label>
                            <div className="flex gap-2">
                                {BUTTON_COUNTS.map(bc => (
                                    <Button key={bc.value} type="button" variant={form.button_count === bc.value ? 'default' : 'outline'} className="flex-1" onClick={() => setForm({...form, button_count: bc.value})}>
                                        {bc.label}
                                    </Button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor="ambiente_id">Ambiente *</Label>
                      <select id="ambiente_id" className="w-full h-10 px-3 rounded-md border border-slate-200 bg-white" value={form.ambiente_id} onChange={e => setForm({...form, ambiente_id: Number(e.target.value) || ''})} required disabled={!projetoSelecionado || loading}>
                        <option value="">{loading ? "Carregando..." : "Selecione"}</option>
                        {ambientes.sort((a,b) => a.nome.localeCompare(b.nome)).map(amb => (
                          <option key={amb.id} value={amb.id}>{amb.nome}{amb.area?.nome ? ` (${amb.area.nome})` : ""}</option>
                        ))}
                      </select>
                    </div>

                    <div className="flex flex-col gap-2 pt-2">
                        <Button type="submit" className="w-full" disabled={!projetoSelecionado || loadingSubmit}>
                            {loadingSubmit ? "Salvando..." : (isEditing ? 'Salvar Alterações' : 'Criar Keypad')}
                        </Button>
                        {isEditing && (
                            <Button type="button" variant="ghost" className="w-full" onClick={resetForm}>
                                Limpar (Criar Novo)
                            </Button>
                        )}
                    </div>
                  </form>
                </CardContent>
              </Card>
            </motion.div>

            {/* Coluna da Lista */}
            <motion.div
                className="lg:col-span-8"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
            >
              <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-xl shadow-slate-900/5">
                <CardHeader className="pb-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg">
                                <PanelsTopLeft className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <CardTitle className="text-2xl font-bold text-slate-900">Keypads Cadastrados</CardTitle>
                                <p className="text-slate-600 mt-1">Selecione um keypad para editar ou vincular suas teclas.</p>
                            </div>
                        </div>
                        <Badge className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white text-sm font-medium px-3 py-1">
                          {keypads.length} {keypads.length === 1 ? "keypad" : "keypads"}
                        </Badge>
                    </div>
                </CardHeader>
                <CardContent>
                  <div className="mb-4 grid grid-cols-1 md:grid-cols-4 gap-3">
                    <Input placeholder="Buscar..." value={q} onChange={(e) => setQ(e.target.value)} className="md:col-span-2 h-10" />
                    <select className="h-10 w-full px-3 rounded-md border" value={areaIdFilter} onChange={e => { setAreaIdFilter(Number(e.target.value) || ""); setAmbIdFilter(""); }}>
                      <option value="">Todas as Áreas</option>
                      {areaOptions.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
                    </select>
                    <select className="h-10 w-full px-3 rounded-md border" value={ambIdFilter} onChange={e => setAmbIdFilter(Number(e.target.value) || "")}>
                      <option value="">Todos os Ambientes</option>
                      {ambienteOptions.map(amb => <option key={amb.id} value={amb.id}>{amb.nome}</option>)}
                    </select>
                  </div>

                  <p className="text-sm text-slate-600 mb-2">Mostrando <span className="font-semibold">{filteredKeypads.length}</span> de {keypads.length}</p>

                  {loading ? (
                    <div className="text-center py-12"><div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent mx-auto mb-4"></div><p>Carregando...</p></div>
                  ) : keypads.length === 0 ? (
                    <div className="text-center py-12"><Keyboard className="h-12 w-12 text-slate-300 mx-auto mb-4" /><h4 className="text-xl font-semibold">Nenhum keypad cadastrado</h4><p className="text-slate-500">Use o formulário ao lado para criar.</p></div>
                  ) : (
                    <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-2">
                      <AnimatePresence>
                        {filteredKeypads.map((k, index) => {
                            const { status, linked, total } = computeKeypadStatus(k);
                            return (
                                <motion.div
                                    key={k.id}
                                    layout
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -20 }}
                                    transition={{ delay: index * 0.03 }}
                                    onClick={() => setSelectedKeypadId(k.id)}
                                    className={`group relative overflow-hidden rounded-xl border p-4 transition-all duration-300 cursor-pointer ${selectedKeypadId === k.id ? 'bg-blue-50 border-blue-400 shadow-md' : 'bg-white/60 hover:bg-slate-50'}`}
                                >
                                    <div className="flex items-start justify-between">
                                    <div className="flex-1 mr-4">
                                        <div className="flex items-center justify-between gap-3 mb-1">
                                            <h4 className="font-bold text-slate-900 text-lg">{k.nome}</h4>
                                            <span className={`inline-flex items-center gap-2 px-2 py-0.5 rounded-lg text-xs font-medium ${statusBadgeClasses(status)}`} title={`${linked}/${total} vinculadas`}>
                                                <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
                                                {statusLabel(status)} • {linked}/{total}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2 text-sm text-slate-600">
                                            <DoorOpen className="h-4 w-4 text-slate-400" />
                                            <span className="font-medium">{k.ambiente?.nome || "-"}</span>
                                            {k.ambiente?.area?.nome && <><span className="text-slate-400">•</span><span className="text-slate-500">{k.ambiente.area.nome}</span></>}
                                        </div>
                                        <div className="text-sm font-mono text-slate-500 mt-1">HSNET: {k.hsnet}</div>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); openBindings(k); }} className="rounded-lg shadow-sm"><Link2 className="h-4 w-4 mr-1.5" />Vincular</Button>
                                        <Button variant="destructive" size="icon" onClick={(e) => { e.stopPropagation(); handleDelete(k.id); }} className="rounded-lg shadow-sm h-9 w-9"><Trash2 className="h-4 w-4" /></Button>
                                    </div>
                                    </div>
                                </motion.div>
                            )
                        })}
                      </AnimatePresence>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>

        {/* Modal de Vinculação */}
        <AnimatePresence>
          {bindingsOpen && bindingKeypad && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
            >
              <motion.div
                initial={{ y: -50, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -50, opacity: 0 }}
                className="bg-white p-6 md:p-8 rounded-3xl shadow-2xl w-full max-w-2xl"
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-2xl font-bold">Vincular Teclas: {bindingKeypad.nome}</h3>
                    <p className="text-sm text-muted-foreground">{bindingKeypad.button_count} Teclas</p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={closeBindings} className="rounded-full"><X className="w-5 h-5" /></Button>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  {buttonBindings.map((b) => (
                    <div key={b.index} className="rounded-xl border p-4 bg-slate-50/50">
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-sm font-semibold">Tecla {b.index + 1}</div>
                        <Button type="button" size="sm" variant="ghost" onClick={() => setBinding(b.index, "")}>Limpar</Button>
                      </div>

                      <Label className="text-xs text-slate-600">Circuito</Label>
                      <select
                        value={b.circuito_id ?? ''}
                        onChange={(e) => setBinding(b.index, e.target.value ? Number(e.target.value) : '')}
                        className="mt-1 h-10 w-full rounded-xl border bg-white px-3"
                      >
                        <option value="">— Não vinculado —</option>
                        {circuitos.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.nome || c.identificador} ({c.tipo})
                            {c.ambiente?.nome ? ` — ${c.ambiente.nome}` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>

                <div className="flex justify-end gap-2 mt-6">
                  <Button type="button" variant="ghost" onClick={closeBindings}>Cancelar</Button>
                  <Button onClick={saveBindings} disabled={bindingLoading}>
                    {bindingLoading ? "Salvando..." : "Salvar Vinculações"}
                  </Button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Layout>
  );
}