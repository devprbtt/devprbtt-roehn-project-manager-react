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
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// ---------- Tipos ----------
type AreaLite = { id: number; nome: string };
type Ambiente = { id: number; nome: string; area?: AreaLite };

type Keypad = {
  id: number;
  nome: string;
  hsnet: number;
  color: string;          // <- backend
  button_color: string;   // <- backend
  button_count: number;   // <- backend
  // layout opcional, só como fallback (se vc ainda devolver do back):
  layout?: "ONE" | "TWO" | "FOUR";
  ambiente?: { id: number; nome: string; area?: AreaLite };
};
// 1) Tipos (ou ajuste o tipo atual para este shape)
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

type Cena = {
    id: number;
    nome: string;
    ambiente_id: number;
    ambiente?: {
        id: number;
        nome: string;
        area?: { id: number; nome: string } | null;
    } | null;
};

type ButtonBinding = {
  index: number;
  type: 'circuito' | 'cena' | 'none';
  circuito_id: number | null;
  cena_id: number | null;
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

const LAYOUTS: { label: string; value: "ONE" | "TWO" | "FOUR"; hint: string }[] = [
  { label: "1 tecla", value: "ONE", hint: "Layout 1" },
  { label: "2 teclas", value: "TWO", hint: "Layout 2" },
  { label: "4 teclas", value: "FOUR", hint: "Layout 4" },
];

function layoutToCount(layout?: Keypad["layout"]): number | undefined {
  if (!layout) return undefined;
  if (layout === "ONE") return 1;
  if (layout === "TWO") return 2;
  if (layout === "FOUR") return 4;
  return undefined;
}


// ---------- Componente ----------
export default function Keypads() {
  const { toast } = useToast();
  const { projeto } = useProject();

  // Dados base
  const [ambientes, setAmbientes] = useState<Ambiente[]>([]);
  const [keypads, setKeypads] = useState<Keypad[]>([]);
  const [circuitos, setCircuitos] = useState<Circuito[]>([]);
  const [cenas, setCenas] = useState<Cena[]>([]);

  // Estados de controle
  const [loading, setLoading] = useState(true);
  const [loadingCreate, setLoadingCreate] = useState(false);
  const [projetoSelecionado, setProjetoSelecionado] = useState(false);

  // Form de criação
  const [nome, setNome] = useState("");
  const [hsnet, setHsnet] = useState<number | ''>('');
  const [loadingNextHsnet, setLoadingNextHsnet] = useState(false);
  const [cor, setCor] = useState<(typeof COLORS)[number] | "">("");
  const [corTeclas, setCorTeclas] = useState<(typeof KEYCOLORS)[number] | "">("");
  const [layout, setLayout] = useState<"ONE" | "TWO" | "FOUR" | "">("");
  const [ambienteId, setAmbienteId] = useState<number | "">("");

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

  // options

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
    // Se filtrar por área, restringe ambientes dela
    return list
      .filter(x => (areaIdFilter ? x.areaId === areaIdFilter : true))
      .sort((a,b)=>a.nome.localeCompare(b.nome));
  }, [keypads, areaIdFilter]);

    // Aplicação de filtros/busca
    const filteredKeypads = useMemo(() => {
      const term = q.trim().toLowerCase();
      return keypads.filter(k => {
        // Busca livre
        const matchesQ = !term || [
          k.nome,
          k.ambiente?.nome,
          k.ambiente?.area?.nome,
          String(k.hsnet ?? "")
        ].some(v => String(v ?? "").toLowerCase().includes(term));

        // Área
        const matchesArea = !areaIdFilter || k.ambiente?.area?.id === areaIdFilter;

        // Ambiente
        const matchesAmb = !ambIdFilter || k.ambiente?.id === ambIdFilter;

        // Nº teclas
        const matchesCount = !btnCountFilter || k.button_count === btnCountFilter;

        return matchesQ && matchesArea && matchesAmb && matchesCount;
      });
    }, [keypads, q, areaIdFilter, ambIdFilter, btnCountFilter]);

  useEffect(() => {
    // supondo que você tenha `keypads` no estado
    if (projetoSelecionado && (hsnet === '' || hsnet === undefined || hsnet === null)) {
      fetchNextHsnet();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projetoSelecionado, keypads.length]); // re-sugere quando a quantidade muda


  async function fetchNextHsnet() {
    try {
      setLoadingNextHsnet(true);
      const res = await fetch("/api/keypads/next-hsnet", { credentials: "same-origin" });
      const data = await res.json();
      if (res.ok && data?.ok && typeof data.hsnet === "number") {
        setHsnet(data.hsnet);
      }
    } catch (e) {
      // opcional: toast de aviso
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
        setAmbientes([]); setKeypads([]); setCircuitos([]); setCenas([]);
        return;
      }

      const [ambRes, kpRes, circRes, cenasRes] = await Promise.all([
        fetch('/api/ambientes', { credentials: 'same-origin' }),
        fetch('/api/keypads',   { credentials: 'same-origin' }),
        fetch('/api/circuitos', { credentials: 'same-origin' }),
        fetch('/api/cenas', { credentials: 'same-origin' }),
      ]);

      const [amb, kp, circ, cenasData] = await Promise.all([ambRes.json(), kpRes.json(), circRes.json(), cenasRes.json()]);

      setAmbientes(amb?.ambientes || amb || []);
      setKeypads(kp?.keypads || kp || []);
      setCircuitos(circ?.circuitos || circ || []);
      setCenas(cenasData?.cenas || cenasData || []);
    } catch (err) {
      console.error(err);
      toast({ variant: 'destructive', title: 'Erro', description: 'Falha ao carregar dados.' });
    } finally {
      setLoading(false);
    }
  }

  // --------- Fetch base ----------
  async function checkAndFetch() {
    setLoading(true);
    try {
      const p = await fetch("/api/projeto_atual", { credentials: "same-origin" }).then((r) => r.json());
      if (p?.ok && p?.projeto_atual) {
        setProjetoSelecionado(true);

        const [ambRes, kpRes, circRes, cenasRes] = await Promise.all([
          fetch("/api/ambientes", { credentials: "same-origin" }),
          fetch("/api/keypads", { credentials: "same-origin" }),
          fetch("/api/circuitos", { credentials: "same-origin" }),
          fetch("/api/cenas", { credentials: "same-origin" }),
        ]);

        if (!ambRes.ok || !kpRes.ok || !circRes.ok || !cenasRes.ok) throw new Error("Falha ao carregar dados.");

        const ambData = await ambRes.json();
        const kpData = await kpRes.json();
        const circData = await circRes.json();
        const cenasData = await cenasRes.json();

        setAmbientes(ambData?.ambientes || ambData || []);
        setKeypads(kpData?.keypads || kpData || []);
        setCircuitos(circData?.circuitos || circData || []);
        setCenas(cenasData?.cenas || cenasData || []);
      } else {
        setProjetoSelecionado(false);
        setAmbientes([]);
        setKeypads([]);
        setCircuitos([]);
        setCenas([]);
      }
    } catch (e) {
      console.error(e);
      setProjetoSelecionado(false);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Falha ao carregar dados. Verifique se há um projeto selecionado.",
      });
    } finally {
      setLoading(false);
    }
  }


  type KeypadStatus = "vazio" | "parcial" | "completo";

  function computeKeypadStatus(kp: {
    button_count: number;
    buttons?: { circuito_id?: number | null, cena_id?: number | null }[];
  }): { status: KeypadStatus; linked: number; total: number } {
    const total = kp.button_count || 0;
    const linked = (kp.buttons || []).filter(b => !!b?.circuito_id || !!b?.cena_id).length;
    if (total === 0) return { status: "vazio", linked: 0, total: 0 };
    if (linked === 0) return { status: "vazio", linked, total };
    if (linked === total) return { status: "completo", linked, total };
    return { status: "parcial", linked, total };
  }

  function statusBadgeClasses(status: KeypadStatus) {
    switch (status) {
      case "completo":
        return "bg-emerald-100 text-emerald-800 border border-emerald-200";
      case "parcial":
        return "bg-amber-100 text-amber-800 border border-amber-200";
      case "vazio":
      default:
        return "bg-slate-100 text-slate-700 border border-slate-200";
    }
  }

  function statusLabel(status: KeypadStatus) {
    return status === "completo"
      ? "Completo"
      : status === "parcial"
      ? "Parcial"
      : "Vazio";
  }


  useEffect(() => {
    loadData();
  }, [projeto?.id]); // ou [] se preferir


  // --------- Criação ----------
  function resetForm() {
    setNome("");
    setHsnet("");
    setCor("");
    setCorTeclas("");
    setLayout("");
    setAmbienteId("");
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();

    // helper local para mapear layout -> button_count
    const layoutToCount = (l: string): 1 | 2 | 4 | 0 => {
      const L = String(l || "").toUpperCase();
      if (L === "ONE") return 1 as const;
      if (L === "TWO") return 2 as const;
      if (L === "FOUR") return 4 as const;
      return 0 as const; // inválido
    };

    const count = layoutToCount(layout);
    const hs = Number(hsnet);
    const ambId = Number(ambienteId);

    if (
      !nome.trim() ||
      !cor ||
      !corTeclas ||
      !layout ||
      count === 0 ||
      Number.isNaN(hs) ||
      hs <= 0 ||
      Number.isNaN(ambId) ||
      ambId <= 0
    ) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Preencha todos os campos obrigatórios corretamente.",
      });
      return;
    }

    try {
      setLoadingCreate(true);

      const res = await fetch("/api/keypads", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          nome: nome.trim(),
          hsnet: hs,
          color: cor,                 // esperado pelo backend
          button_color: corTeclas,    // esperado pelo backend
          button_count: count,        // esperado pelo backend
          ambiente_id: ambId,
        }),
      });

      const data = await res.json().catch(() => ({} as any));

      if (!res.ok || !(data?.ok || data?.success)) {
        throw new Error(
          data?.error || data?.message || `Falha na criação (HTTP ${res.status})`
        );
      }

      toast({ title: "Sucesso!", description: "Keypad adicionado." });

      // Limpa o formulário…
      resetForm?.();
      // …e força o campo hsnet a vazio para o auto-suggest preencher o próximo (≥110)
      setHsnet("");

      // Recarrega a lista; um useEffect pode chamar fetchNextHsnet se hsnet estiver vazio
      await checkAndFetch();
    } catch (err: any) {
      console.error(err);
      toast({
        variant: "destructive",
        title: "Erro",
        description: String(err?.message || err),
      });
    } finally {
      setLoadingCreate(false);
    }
  }


  // --------- Exclusão ----------
  async function handleDelete(id: number) {
    if (!confirm("Tem certeza que deseja excluir este keypad?")) return;
    try {
      const res = await fetch(`/api/keypads/${id}`, {
        method: "DELETE",
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok || !(data?.ok || data?.success)) {
        throw new Error(data?.error || data?.message || `Falha ao excluir (HTTP ${res.status})`);
      }

      setKeypads((prev) => prev.filter((k) => k.id !== id));
      toast({ title: "Sucesso!", description: "Keypad excluído." });
    } catch (err: any) {
      console.error(err);
      toast({ variant: "destructive", title: "Erro", description: String(err?.message || err) });
    }
  }

  // --------- Vinculação (modal) ----------
  function openBindings(kp: Keypad) {
    setBindingKeypad(kp);

    const count =
      (typeof kp.button_count === "number" && kp.button_count > 0
        ? kp.button_count
        : layoutToCount(kp.layout)) ?? 0;

    if (count <= 0) {
      toast({
        variant: "destructive",
        title: "Não foi possível abrir o vínculo",
        description: "Layout/quantidade de teclas do keypad é inválido.",
      });
      return;
    }

    const base: ButtonBinding[] = Array.from({ length: count }, (_, i) => ({
      index: i,
      type: 'none',
      circuito_id: null,
      cena_id: null,
    }));
    setButtonBindings(base);

    fetch(`/api/keypads/${kp.id}`, { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (json?.ok && Array.isArray(json.keypad?.buttons)) {
          const buttons = json.keypad.buttons;
          const merged = base.map((b) => {
            const found = buttons.find((x: any) => x.ordem === b.index + 1);
            if (found?.cena_id) {
                return { index: b.index, type: 'cena' as const, cena_id: found.cena_id, circuito_id: null };
            }
            if (found?.circuito_id) {
                return { index: b.index, type: 'circuito' as const, circuito_id: found.circuito_id, cena_id: null };
            }
            return { index: b.index, type: 'none' as const, circuito_id: null, cena_id: null };
          });
          setButtonBindings(merged);
        }
        setBindingsOpen(true);
      })
      .catch(() => setBindingsOpen(true));
  }



  function closeBindings() {
    setBindingsOpen(false);
    setBindingKeypad(null);
    setButtonBindings([]);
    setBindingLoading(false);
  }

  function setBinding(index: number, type: 'circuito' | 'cena', value: number | "") {
    setButtonBindings((prev) =>
      prev.map((b) => {
        if (b.index === index) {
          const newType = value ? type : 'none';
          if (type === 'circuito') {
            return { ...b, type: newType, circuito_id: value ? Number(value) : null, cena_id: null };
          }
          if (type === 'cena') {
            return { ...b, type: newType, cena_id: value ? Number(value) : null, circuito_id: null };
          }
        }
        return b;
      })
    );
  }

  function setBindingType(index: number, type: 'circuito' | 'cena') {
    setButtonBindings((prev) =>
      prev.map((b) =>
        b.index === index
          ? { ...b, type, circuito_id: null, cena_id: null }
          : b
      )
    );
  }

  async function saveBindings() {
    if (!bindingKeypad) return;
    try {
      setBindingLoading(true);

      // 1) Atualiza cada tecla
      await Promise.all(
        buttonBindings.map((b) => {
          const payload: { circuito_id?: number | null, cena_id?: number | null } = {};
          if (b.type === 'circuito') {
            payload.circuito_id = b.circuito_id;
          } else if (b.type === 'cena') {
            payload.cena_id = b.cena_id;
          } else {
            payload.circuito_id = null;
            payload.cena_id = null;
          }

          return fetch(`/api/keypads/${bindingKeypad.id}/buttons/${b.index + 1}`, {
            method: "PUT",
            credentials: "same-origin",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify(payload),
          });
        })
      );

      // 2) Busca esse keypad atualizado
      const res = await fetch(`/api/keypads/${bindingKeypad.id}`, { credentials: "same-origin" });
      const json = await res.json().catch(() => ({} as any));

      if (res.ok && json?.ok && json.keypad) {
        // 3) Atualiza só ele na lista
        setKeypads((prev) => prev.map((k) => (k.id === bindingKeypad.id ? json.keypad : k)));
      } else {
        // fallback: recarrega tudo
        await checkAndFetch();
      }

      toast({ title: "Vinculações salvas!", description: "As teclas foram atualizadas." });
      closeBindings();
    } catch (err: any) {
      console.error(err);
      toast({ variant: "destructive", title: "Erro", description: String(err?.message || err) });
      setBindingLoading(false);
    }
  }


  // ---------- Render ----------
  return (
    <Layout projectSelected={projetoSelecionado}>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
        <div className="max-w-7xl mx-auto px-6 py-8">
          {/* Header */}
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 mb-10">
            <div>
              <div className="flex items-center gap-4 mb-4">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-3xl flex items-center justify-center shadow-lg shadow-blue-500/25">
                  <Keyboard className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h1 className="text-4xl font-bold text-slate-900 mb-2">Gerenciar Keypads</h1>
                  <p className="text-lg text-slate-600 max-w-2xl">
                    Cadastre e gerencie os keypads RQR-K do seu projeto.
                  </p>
                </div>
              </div>
              <div className="h-1 w-32 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full shadow-sm" />
            </div>
          </div>

          {/* Alerta quando não há projeto (somente após loading terminar) */}
          {!projetoSelecionado && !loading && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
              <Alert className="bg-amber-50 border-amber-200 shadow-sm">
                <Sparkles className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-amber-800">
                  Selecione um projeto na página inicial para cadastrar keypads.
                </AlertDescription>
              </Alert>
            </motion.div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Formulário */}
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}>
              <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-xl shadow-slate-900/5">
                <CardHeader className="pb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center shadow-lg">
                      <PlusCircle className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-2xl font-bold text-slate-900">Adicionar Novo Keypad</CardTitle>
                      <p className="text-slate-600 mt-1">Preencha as informações do dispositivo</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <form className="space-y-6" onSubmit={handleCreate}>
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="nome" className="text-sm font-semibold text-slate-700">
                          Nome *
                        </Label>
                        <Input
                          id="nome"
                          value={nome}
                          onChange={(e) => setNome(e.target.value)}
                          placeholder="Ex.: Keypad Sala"
                          required
                          disabled={!projetoSelecionado}
                          className="h-12 px-4 rounded-xl border-slate-200 focus:border-blue-500 focus:ring-blue-500/20"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="hsnet">HSNET *</Label>
                        <div className="flex gap-2">
                          <Input
                            id="hsnet"
                            type="number"
                            value={hsnet}
                            onChange={(e) => setHsnet(Number(e.target.value) || '')}
                            placeholder="Ex.: 110"
                            required
                            className="h-12 px-4 rounded-xl border-slate-200 focus:border-indigo-500 focus:ring-indigo-500/20"
                          />
                          <Button type="button" variant="outline" onClick={fetchNextHsnet} disabled={loadingNextHsnet}>
                            {loadingNextHsnet ? "..." : "Sugerir"}
                          </Button>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">Sugerimos o primeiro HSNET livre a partir de 110.</p>

                      </div>
                    </div>

                    <div className="grid md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="cor" className="text-sm font-semibold text-slate-700">
                          Cor *
                        </Label>
                        <select
                          id="cor"
                          className="h-12 w-full px-4 rounded-xl border border-slate-200 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                          value={cor}
                          onChange={(e) => setCor(e.target.value as any)}
                          required
                          disabled={!projetoSelecionado}
                        >
                          <option value="">Selecione</option>
                          {COLORS.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="cor_teclas" className="text-sm font-semibold text-slate-700">
                          Cor das Teclas *
                        </Label>
                        <select
                          id="cor_teclas"
                          className="h-12 w-full px-4 rounded-xl border border-slate-200 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                          value={corTeclas}
                          onChange={(e) => setCorTeclas(e.target.value as any)}
                          required
                          disabled={!projetoSelecionado}
                        >
                          <option value="">Selecione</option>
                          {KEYCOLORS.map((kc) => (
                            <option key={kc} value={kc}>
                              {kc}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="layout" className="text-sm font-semibold text-slate-700">
                          Layout *
                        </Label>
                        <select
                          id="layout"
                          className="h-12 w-full px-4 rounded-xl border border-slate-200 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                          value={layout}
                          onChange={(e) => setLayout(e.target.value as any)}
                          required
                          disabled={!projetoSelecionado}
                        >
                          <option value="">Selecione</option>
                          {LAYOUTS.map((l) => (
                            <option key={l.value} value={l.value}>
                              {l.label}
                            </option>
                          ))}
                        </select>
                        {layout && (
                          <p className="text-xs text-slate-500 mt-1">
                            {LAYOUTS.find((l) => l.value === layout)?.hint}
                          </p>
                        )}
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="ambiente_id" className="text-sm font-semibold text-slate-700">
                        Ambiente *
                      </Label>
                      <select
                        id="ambiente_id"
                        className="mt-2 h-12 w-full px-4 rounded-xl border border-slate-200 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                        value={ambienteId === "" ? "" : String(ambienteId)}
                        onChange={(e) => {
                          const v = e.target.value;
                          setAmbienteId(v === "" ? "" : Number(v)); // <- evita NaN
                        }}
                        required
                        disabled={!projetoSelecionado || loading || ambientes.length === 0}
                      >
                        <option value="">{loading ? "Carregando ambientes..." : "Selecione um ambiente"}</option>
                        {!loading &&
                          ambientes
                            .slice() // copia para ordenar sem mutar estado
                            .sort((a, b) => a.nome.localeCompare(b.nome))
                            .map((amb) => (
                              <option key={amb.id} value={amb.id}>
                                {amb.nome}
                                {amb.area?.nome ? ` — ${amb.area.nome}` : ""}
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

                    <Button
                      type="submit"
                      className="w-full h-12 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center gap-2"
                      disabled={!projetoSelecionado || loadingCreate}
                    >
                      <PlusCircle className="h-5 w-5" />
                      {loadingCreate ? "Adicionando..." : "Adicionar Keypad"}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </motion.div>

            {/* Lista */}
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}>
              <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-xl shadow-slate-900/5">
                <CardHeader className="pb-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg">
                        <PanelsTopLeft className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <CardTitle className="text-2xl font-bold text-slate-900">Keypads Cadastrados</CardTitle>
                        <p className="text-slate-600 mt-1">Lista com todos os keypads do projeto</p>
                      </div>
                    </div>
                    <Badge className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white text-sm font-medium px-3 py-1">
                      {keypads.length} {keypads.length === 1 ? "keypad" : "keypads"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Filtros */}
                  <div className="mb-4 grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div className="col-span-1">
                      <Input
                        placeholder="Buscar"
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        className="h-10"
                      />
                    </div>

                    <div>
                      <select
                        className="h-10 w-full px-3 rounded-xl border border-slate-200 bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                        value={areaIdFilter === "" ? "" : String(areaIdFilter)}
                        onChange={(e) => {
                          const v = e.target.value ? Number(e.target.value) : "";
                          setAreaIdFilter(v as any);
                          setAmbIdFilter(""); // reset ambiente quando muda área
                        }}
                      >
                        <option value="">Áreas</option>
                        {areaOptions.map(a => (
                          <option key={a.id} value={a.id}>{a.nome}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <select
                        className="h-10 w-full px-3 rounded-xl border border-slate-200 bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                        value={ambIdFilter === "" ? "" : String(ambIdFilter)}
                        onChange={(e) => setAmbIdFilter(e.target.value ? Number(e.target.value) as any : "")}
                        disabled={areaIdFilter === ""}
                        title={areaIdFilter === "" ? "Selecione uma área para filtrar ambientes" : undefined}
                      >
                        <option value="">Ambientes</option>
                        {ambienteOptions.map(amb => (
                          <option key={amb.id} value={amb.id}>{amb.nome}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <select
                        className="h-10 w-full px-3 rounded-xl border border-slate-200 bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                        value={btnCountFilter === "" ? "" : String(btnCountFilter)}
                        onChange={(e) => {
                          const v = e.target.value ? Number(e.target.value) as 1|2|4 : "";
                          setBtnCountFilter(v as any);
                        }}
                      >
                        <option value="">Teclas</option>
                        <option value="1">1 tecla</option>
                        <option value="2">2 teclas</option>
                        <option value="4">4 teclas</option>
                      </select>
                    </div>
                  </div>

                  {/* Contagem de resultados */}
                  <p className="text-sm text-slate-600 mb-2">
                    Mostrando <span className="font-semibold">{filteredKeypads.length}</span> de {keypads.length}
                  </p>

                  {loading ? (
                    <div className="flex flex-col justify-center items-center py-12">
                      <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent mb-4"></div>
                      <p className="text-slate-600 font-medium">Carregando keypads...</p>
                    </div>
                  ) : keypads.length === 0 ? (
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center py-12">

                      <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Keyboard className="h-10 w-10 text-slate-400" />
                      </div>
                      <h4 className="text-xl font-semibold text-slate-900 mb-2">
                        {projetoSelecionado ? "Nenhum keypad cadastrado" : "Selecione um projeto"}
                      </h4>
                      <p className="text-slate-600 max-w-sm mx-auto">
                        {projetoSelecionado
                          ? "Comece adicionando seu primeiro keypad usando o formulário ao lado."
                          : "Selecione um projeto para visualizar e gerenciar os keypads."}
                      </p>
                    </motion.div>
                  ) : (
                    <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                      <AnimatePresence>
                        {filteredKeypads.map((k, index) => (
                          <motion.div
                            key={k.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            transition={{ delay: index * 0.05 }}
                            className="group relative overflow-hidden rounded-2xl border border-slate-200/60 bg-white/60 backdrop-blur-sm p-4 hover:bg-white/80 hover:shadow-lg hover:shadow-slate-900/5 transition-all duration-300"
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1 mr-4">
                                <div className="flex items-center gap-3 mb-2">
                                  <Badge className="text-xs font-medium px-2 py-1 bg-blue-100 text-blue-800">
                                    {k.button_count === 4 ? "4 teclas" : k.button_count === 2 ? "2 teclas" : "1 tecla"}
                                  </Badge>
                                  <span className="text-sm font-mono text-slate-500 bg-slate-100 px-2 py-1 rounded-lg">
                                    HSNET: {k.hsnet}
                                  </span>
                                </div>
                                {/* título e meta */}
                                <div className="flex items-center justify-between gap-3">
                                  <h4 className="font-bold text-slate-900 text-lg">{k.nome}</h4>

                                  {(() => {
                                    const { status, linked, total } = computeKeypadStatus(k);
                                    return (
                                      <span
                                        className={
                                          "inline-flex items-center gap-2 px-2.5 py-1 rounded-lg text-xs font-medium " +
                                          statusBadgeClasses(status)
                                        }
                                        title={`${linked}/${total} teclas vinculadas`}
                                      >
                                        <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
                                        {statusLabel(status)} • {linked}/{total}
                                      </span>
                                    );
                                  })()}
                                </div>


                                <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600 mb-2">
                                  <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                                    Corpo: {k.color}
                                  </span>
                                  <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                                    Teclas: {k.button_color}
                                  </span>
                                </div>

                                <div className="flex items-center gap-2 text-sm text-slate-600">
                                  <DoorOpen className="h-4 w-4 text-slate-400" />
                                  <span className="font-medium">{k.ambiente?.nome || "Sem ambiente"}</span>
                                  {k.ambiente?.area?.nome && (
                                    <>
                                      <span className="text-slate-400">•</span>
                                      <span className="text-slate-500">Área: {k.ambiente.area.nome}</span>
                                    </>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => openBindings(k)}
                                  disabled={!projetoSelecionado}
                                  className="rounded-xl shadow hover:shadow-md"
                                  title="Vincular teclas a circuitos"
                                >
                                  <Link2 className="h-4 w-4 mr-2" />
                                  Vincular Teclas
                                </Button>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => handleDelete(k.id)}
                                  disabled={!projetoSelecionado}
                                  className="opacity-0 group-hover:opacity-100 transition-all duration-300 rounded-xl shadow-lg hover:shadow-xl"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
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
                    <h3 className="text-2xl font-bold">Vincular Teclas</h3>
                    <p className="text-sm text-muted-foreground">
                      {bindingKeypad.nome} — {
                        (bindingKeypad.button_count ?? layoutToCount(bindingKeypad.layout)) === 4 ? "4 teclas" :
                        (bindingKeypad.button_count ?? layoutToCount(bindingKeypad.layout)) === 2 ? "2 teclas" : "1 tecla"
                      }
                    </p>

                  </div>
                  <Button variant="ghost" size="icon" onClick={closeBindings} className="rounded-full">
                    <X className="w-5 h-5" />
                  </Button>
                </div>

                <div className="flex flex-col gap-4 max-h-[50vh] overflow-y-auto pr-2">
                  {buttonBindings.map((b) => (
                    <div key={b.index} className="rounded-xl border border-slate-200 p-4 bg-slate-50/50">
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-sm font-semibold text-slate-700">
                          Tecla {b.index + 1}
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => setBinding(b.index, "")}
                          className="h-8"
                          title="Limpar vinculação"
                        >
                          Limpar
                        </Button>
                      </div>

                      <div className="flex items-center gap-4 mb-2">
                        <Label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name={`binding-type-${b.index}`}
                            checked={b.type === 'circuito' || b.type === 'none'}
                            onChange={() => setBindingType(b.index, 'circuito')}
                          />
                          Circuito
                        </Label>
                        <Label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name={`binding-type-${b.index}`}
                            checked={b.type === 'cena'}
                            onChange={() => setBindingType(b.index, 'cena')}
                          />
                          Cena
                        </Label>
                      </div>

                      {b.type === 'cena' ? (
                        <select
                          value={b.cena_id ?? ''}
                          onChange={(e) => setBinding(b.index, 'cena', e.target.value ? Number(e.target.value) : '')}
                          className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3"
                        >
                          <option value="">— Selecione a Cena —</option>
                          {cenas.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.nome}
                              {c.ambiente?.nome ? ` — ${c.ambiente.nome}` : ''}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <select
                          value={b.circuito_id ?? ''}
                          onChange={(e) => setBinding(b.index, 'circuito', e.target.value ? Number(e.target.value) : '')}
                          className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3"
                        >
                          <option value="">— Não vinculado —</option>
                          {circuitos.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.nome || c.identificador} ({c.tipo})
                              {c.ambiente?.nome ? ` — ${c.ambiente.nome}` : ''}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  ))}
                </div>

                <div className="flex justify-end gap-2 mt-6">
                  <Button type="button" variant="ghost" onClick={closeBindings}>
                    Cancelar
                  </Button>
                  <Button onClick={saveBindings} disabled={bindingLoading}>
                    {bindingLoading ? "Salvando..." : "Salvar"}
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