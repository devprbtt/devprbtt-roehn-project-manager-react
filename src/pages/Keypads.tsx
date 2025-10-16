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
  Search,
  Pencil,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import NavigationButtons from "@/components/NavigationButtons";
import KeypadEditModal from "@/components/KeypadEditModal";

// ---------- Tipos ----------
type AreaLite = { id: number; nome: string };
type Ambiente = { id: number; nome: string; area?: AreaLite };

type Keypad = {
  id: number;
  nome: string;
  hsnet: number;
  color: string;
  button_color: string;
  button_count: number;
  layout?: "ONE" | "TWO" | "FOUR";
  ambiente?: { id: number; nome: string; area?: AreaLite };
  buttons?: ButtonBinding[];
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
  engraver_text: string | null;
  icon?: string | null;
  is_rocker: boolean;
  rocker_style: 'up-down' | 'left-right' | 'previous-next';
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

  // Modal de edição
  const [editingKeypad, setEditingKeypad] = useState<Keypad | null>(null);

  // Filtros
  const [searchTerm, setSearchTerm] = useState("");
  const [ambienteFilter, setAmbienteFilter] = useState<number | "todos">("todos");
  const [teclasFilter, setTeclasFilter] = useState<1 | 2 | 4 | "todos">("todos");

  // Aplicação de filtros/busca
  const filteredKeypads = useMemo(() => {
    return keypads.filter(keypad => {
      const matchesSearch = searchTerm === "" ||
        keypad.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        String(keypad.hsnet).includes(searchTerm.toLowerCase()) ||
        (keypad.ambiente && keypad.ambiente.nome.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (keypad.ambiente?.area && keypad.ambiente.area.nome.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesAmbiente = ambienteFilter === "todos" || keypad.ambiente?.id === ambienteFilter;
      const matchesTeclas = teclasFilter === "todos" || keypad.button_count === teclasFilter;

      return matchesSearch && matchesAmbiente && matchesTeclas;
    });
  }, [keypads, searchTerm, ambienteFilter, teclasFilter]);

  useEffect(() => {
    if (projetoSelecionado && (hsnet === '' || hsnet === undefined || hsnet === null)) {
      fetchNextHsnet();
    }
  }, [projetoSelecionado, keypads.length]);

  async function fetchNextHsnet() {
    try {
      setLoadingNextHsnet(true);
      const res = await fetch("/api/keypads/next-hsnet", { credentials: "same-origin" });
      const data = await res.json();
      if (res.ok && data?.ok && typeof data.hsnet === "number") {
        setHsnet(data.hsnet);
      }
    } catch (e) {
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
        return "bg-muted text-slate-700 border border-border";
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
  }, [projeto?.id]);

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

    const layoutToCount = (l: string): 1 | 2 | 4 | 0 => {
      const L = String(l || "").toUpperCase();
      if (L === "ONE") return 1 as const;
      if (L === "TWO") return 2 as const;
      if (L === "FOUR") return 4 as const;
      return 0 as const;
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
          color: cor,
          button_color: corTeclas,
          button_count: count,
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
      resetForm?.();
      setHsnet("");
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

  // --------- Edição (modal) ----------
  function openEditModal(kp: Keypad) {
    setEditingKeypad(kp);
  }

  function closeEditModal() {
    setEditingKeypad(null);
  }

  function handleUpdateKeypad(updatedKeypad: Keypad) {
    setKeypads((prev) =>
      prev.map((k) => (k.id === updatedKeypad.id ? { ...k, ...updatedKeypad } : k))
    );
    closeEditModal();
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
      engraver_text: null,
      icon: null,
      is_rocker: false,
      rocker_style: 'up-down',
    }));
    setButtonBindings(base);

    fetch(`/api/keypads/${kp.id}`, { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (json?.ok && Array.isArray(json.keypad?.buttons)) {
          const buttons = json.keypad.buttons;
          const merged = base.map((b) => {
            const found = buttons.find((x: any) => x.ordem === b.index + 1);
            if (!found) {
              return b;
            }

            const rocker_style_from_api = found.rocker_style;
            const new_rocker_style: ButtonBinding['rocker_style'] =
              rocker_style_from_api === 'left-right' || rocker_style_from_api === 'previous-next'
                ? rocker_style_from_api
                : 'up-down';

            const baseReturn = {
              ...b,
              engraver_text: found.engraver_text,
              icon: found.icon,
              is_rocker: !!found.is_rocker,
              rocker_style: new_rocker_style,
            };

            if (found.cena_id) {
              return {
                ...baseReturn,
                type: 'cena' as const,
                cena_id: found.cena_id,
                circuito_id: null,
              };
            }
            if (found.circuito_id) {
              return {
                ...baseReturn,
                type: 'circuito' as const,
                circuito_id: found.circuito_id,
                cena_id: null,
              };
            }

            return {
              ...baseReturn,
              type: 'none' as const,
            };
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

      await Promise.all(
        buttonBindings.map((b) => {
          const payload: { circuito_id?: number | null, cena_id?: number | null, engraver_text?: string | null, icon?: string | null, is_rocker?: boolean, rocker_style?: 'up-down' | 'left-right' | 'previous-next' } = {};
          if (b.type === 'circuito') {
            payload.circuito_id = b.circuito_id;
          } else if (b.type === 'cena') {
            payload.cena_id = b.cena_id;
          } else {
            payload.circuito_id = null;
            payload.cena_id = null;
          }
          payload.engraver_text = b.engraver_text;
          payload.icon = b.icon;
          payload.is_rocker = b.is_rocker;
          payload.rocker_style = b.rocker_style;

          return fetch(`/api/keypads/${bindingKeypad.id}/buttons/${b.index + 1}`, {
            method: "PUT",
            credentials: "same-origin",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify(payload),
          });
        })
      );

      const res = await fetch(`/api/keypads/${bindingKeypad.id}`, { credentials: "same-origin" });
      const json = await res.json().catch(() => ({} as any));

      if (res.ok && json?.ok && json.keypad) {
        setKeypads((prev) => prev.map((k) => (k.id === bindingKeypad.id ? json.keypad : k)));
      } else {
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
    <Layout>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 dark:from-background dark:via-background/40 dark:to-primary/25">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
          {/* Header */}
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 mb-8">
            <div>
              <div className="flex items-center gap-4 mb-4">
                <div className="w-14 h-14 sm:w-16 sm:h-16 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-3xl flex items-center justify-center shadow-lg shadow-blue-500/25">
                  <Keyboard className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
                </div>
                <div>
                  <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-2">Gerenciar Keypads</h1>
                  <p className="text-base sm:text-lg text-muted-foreground max-w-2xl">
                    Cadastre e gerencie os keypads RQR-K do seu projeto.
                  </p>
                </div>
              </div>
              <div className="h-1 w-32 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full shadow-sm" />
            </div>
          </div>

          {/* Alerta quando não há projeto */}
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

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
            {/* Formulário */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }} 
              animate={{ opacity: 1, y: 0 }} 
              className="order-1 lg:order-1"
            >
              <Card className="bg-card/95 backdrop-blur-sm border border-border shadow-xl shadow-primary/10 dark:bg-card/85 dark:shadow-primary/20">
                <CardHeader className="pb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center shadow-lg">
                      <PlusCircle className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-xl sm:text-2xl font-bold text-foreground">Adicionar Novo Keypad</CardTitle>
                      <p className="text-muted-foreground text-sm sm:text-base mt-1">Preencha as informações do dispositivo</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <form className="space-y-6" onSubmit={handleCreate}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                          className="h-12 px-4 rounded-xl border-border focus:border-blue-500 focus:ring-blue-500/20"
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
                            className="h-12 px-4 rounded-xl border-border focus:border-indigo-500 focus:ring-indigo-500/20"
                          />
                          <Button type="button" variant="outline" onClick={fetchNextHsnet} disabled={loadingNextHsnet} className="h-12">
                            {loadingNextHsnet ? "..." : "Sugerir"}
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground/90 mt-1">Sugerimos o primeiro HSNET livre a partir de 110.</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="cor" className="text-sm font-semibold text-slate-700">
                          Cor *
                        </Label>
                        <select
                          id="cor"
                          className="h-12 w-full px-4 rounded-xl border border-border bg-background focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
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
                          className="h-12 w-full px-4 rounded-xl border border-border bg-background focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
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
                          className="h-12 w-full px-4 rounded-xl border border-border bg-background focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
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
                          <p className="text-xs text-muted-foreground/90 mt-1">
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
                        className="mt-2 h-12 w-full px-4 rounded-xl border border-border bg-background focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                        value={ambienteId === "" ? "" : String(ambienteId)}
                        onChange={(e) => {
                          const v = e.target.value;
                          setAmbienteId(v === "" ? "" : Number(v));
                        }}
                        required
                        disabled={!projetoSelecionado || loading || ambientes.length === 0}
                      >
                        <option value="">{loading ? "Carregando ambientes..." : "Selecione um ambiente"}</option>
                        {!loading &&
                          ambientes
                            .slice()
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
            <motion.div 
              initial={{ opacity: 0, y: 20 }} 
              animate={{ opacity: 1, y: 0 }} 
              transition={{ delay: 0.1 }}
              className="order-2 lg:order-2"
            >
              <Card className="bg-card/95 backdrop-blur-sm border border-border shadow-xl shadow-primary/10 dark:bg-card/85 dark:shadow-primary/20">
                <CardHeader className="pb-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg">
                        <PanelsTopLeft className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                      </div>
                      <div>
                        <CardTitle className="text-xl sm:text-2xl font-bold text-foreground">Keypads Cadastrados</CardTitle>
                        <p className="text-muted-foreground text-sm sm:text-base mt-1">Lista com todos os keypads do projeto</p>
                      </div>
                    </div>
                    <Badge className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white text-xs sm:text-sm font-medium px-2 sm:px-3 py-1">
                      {keypads.length} {keypads.length === 1 ? "keypad" : "keypads"}
                    </Badge>
                  </div>

                  {/* Barra de Filtros */}
                  <div className="mt-4 sm:mt-6 space-y-3 sm:space-y-4">
                    {/* Filtro de Busca por Texto */}
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground/80 w-4 h-4" />
                      <Input
                        placeholder="Buscar por nome, HSNET, etc..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 pr-10 h-10 rounded-xl border-border focus:border-blue-500"
                      />
                      {searchTerm && (
                        <button
                          onClick={() => setSearchTerm("")}
                          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground/80 hover:text-muted-foreground"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    {/* Filtros de Ambiente e Teclas */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Filtro por Ambiente */}
                      <div className="space-y-1">
                        <Label htmlFor="filtro-ambiente" className="text-xs font-medium text-muted-foreground">
                          Ambiente
                        </Label>
                        <Select
                          value={ambienteFilter === "todos" ? "todos" : String(ambienteFilter)}
                          onValueChange={(v) => setAmbienteFilter(v === "todos" ? "todos" : Number(v))}
                        >
                          <SelectTrigger id="filtro-ambiente" className="h-9 text-sm rounded-xl">
                            <SelectValue placeholder="Todos os ambientes" />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl">
                            <SelectItem value="todos">Todos os ambientes</SelectItem>
                            {ambientes
                              .sort((a,b) => a.nome.localeCompare(b.nome))
                              .map(ambiente => (
                                <SelectItem key={ambiente.id} value={String(ambiente.id)}>
                                  {ambiente.nome}
                                  {ambiente.area && ` (${ambiente.area.nome})`}
                                </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Filtro por Quantidade de Teclas */}
                      <div className="space-y-1">
                        <Label htmlFor="filtro-teclas" className="text-xs font-medium text-muted-foreground">
                          Nº de Teclas
                        </Label>
                        <Select
                          value={teclasFilter === "todos" ? "todos" : String(teclasFilter)}
                          onValueChange={(v) => setTeclasFilter(v === "todos" ? "todos" : Number(v) as 1 | 2 | 4)}
                        >
                          <SelectTrigger id="filtro-teclas" className="h-9 text-sm rounded-xl">
                            <SelectValue placeholder="Todas" />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl">
                            <SelectItem value="todos">Todas as teclas</SelectItem>
                            <SelectItem value="1">1 Tecla</SelectItem>
                            <SelectItem value="2">2 Teclas</SelectItem>
                            <SelectItem value="4">4 Teclas</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Botão para limpar todos os filtros */}
                    {(searchTerm || ambienteFilter !== "todos" || teclasFilter !== "todos") && (
                      <div className="flex justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSearchTerm("");
                            setAmbienteFilter("todos");
                            setTeclasFilter("todos");
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
                    <div className="flex flex-col justify-center items-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-4 border-blue-500 border-t-transparent mb-3"></div>
                      <p className="text-muted-foreground font-medium">Carregando keypads...</p>
                    </div>
                  ) : keypads.length === 0 ? (
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center py-8">
                      <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                        <Keyboard className="h-8 w-8 text-muted-foreground/80" />
                      </div>
                      <h4 className="text-lg font-semibold text-foreground mb-2">
                        {projetoSelecionado ? "Nenhum keypad cadastrado" : "Selecione um projeto"}
                      </h4>
                      <p className="text-muted-foreground max-w-sm mx-auto text-sm">
                        {projetoSelecionado
                          ? "Comece adicionando seu primeiro keypad usando o formulário ao lado."
                          : "Selecione um projeto para visualizar e gerenciar os keypads."}
                      </p>
                    </motion.div>
                  ) : (
                    <div className="space-y-3 max-h-80 sm:max-h-96 overflow-y-auto pr-2">
                      <AnimatePresence>
                        {filteredKeypads.map((k, index) => (
                          <motion.div
                            key={k.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            transition={{ delay: index * 0.05 }}
                            className="group relative overflow-hidden rounded-2xl border border-border bg-card/85 backdrop-blur-sm p-3 sm:p-4 hover:bg-card/90 hover:shadow-lg hover:shadow-slate-900/5 transition-all duration-300"
                          >
                            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                              <div className="flex-1">
                                <div className="flex flex-wrap items-center gap-2 mb-2">
                                  <Badge className="text-xs font-medium px-2 py-1 bg-blue-100 text-primary">
                                    {k.button_count === 4 ? "4 teclas" : k.button_count === 2 ? "2 teclas" : "1 tecla"}
                                  </Badge>
                                  <span className="text-xs font-mono text-muted-foreground/90 bg-muted px-2 py-1 rounded-lg">
                                    HSNET: {k.hsnet}
                                  </span>
                                </div>
                                
                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
                                  <h4 className="font-bold text-foreground text-base sm:text-lg">{k.nome}</h4>
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

                                <div className="flex flex-wrap items-center gap-1 text-xs sm:text-sm text-muted-foreground mb-2">
                                  <span className="px-2 py-0.5 rounded-full bg-muted text-slate-700">
                                    Corpo: {k.color}
                                  </span>
                                  <span className="px-2 py-0.5 rounded-full bg-muted text-slate-700">
                                    Teclas: {k.button_color}
                                  </span>
                                </div>

                                <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
                                  <DoorOpen className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground/80" />
                                  <span className="font-medium">{k.ambiente?.nome || "Sem ambiente"}</span>
                                  {k.ambiente?.area?.nome && (
                                    <>
                                      <span className="text-muted-foreground/80">•</span>
                                      <span className="text-muted-foreground/90">Área: {k.ambiente.area.nome}</span>
                                    </>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-1 sm:gap-2 self-end sm:self-auto">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => openBindings(k)}
                                  disabled={!projetoSelecionado}
                                  className="rounded-xl shadow hover:shadow-md h-8 w-8 sm:h-9 sm:w-auto p-0 sm:px-3 sm:py-2"
                                  title="Vincular teclas a circuitos"
                                >
                                  <Link2 className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
                                  <span className="hidden sm:inline">Vincular</span>
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => openEditModal(k)}
                                  disabled={!projetoSelecionado}
                                  className="rounded-xl shadow hover:shadow-md h-8 w-8 p-0 sm:h-9 sm:w-9"
                                  title="Editar keypad"
                                >
                                  <Pencil className="h-3 w-3 sm:h-4 sm:w-4" />
                                </Button>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => handleDelete(k.id)}
                                  disabled={!projetoSelecionado}
                                  className="rounded-xl shadow-lg hover:shadow-xl h-8 w-8 p-0 sm:h-9 sm:w-9"
                                >
                                  <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
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

          <NavigationButtons previousPath="/vinculacao" nextPath="/cenas" />
        </div>

        {/* Modal de Edição */}
        <KeypadEditModal
          isOpen={!!editingKeypad}
          onClose={closeEditModal}
          onSave={handleUpdateKeypad}
          keypad={editingKeypad}
          ambientes={ambientes}
        />

        {/* Modal de Vinculação */}
        <AnimatePresence>
          {bindingsOpen && bindingKeypad && (
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
                className="bg-card p-4 sm:p-6 md:p-8 rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-xl sm:text-2xl font-bold">Vincular Teclas</h3>
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
                    <div key={b.index} className="rounded-xl border border-border p-3 sm:p-4 bg-slate-50/50">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
                        <div className="text-sm font-semibold text-slate-700">
                          Tecla {b.index + 1}
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => setBinding(b.index, b.type === 'cena' ? 'cena' : 'circuito', '')}
                          className="h-8 text-xs"
                          title="Limpar vinculação"
                        >
                          Limpar
                        </Button>
                      </div>

                      <div className="flex items-center gap-4 mb-2">
                        <Label className="flex items-center gap-2 cursor-pointer text-sm">
                          <input
                            type="radio"
                            name={`binding-type-${b.index}`}
                            checked={b.type === 'circuito' || b.type === 'none'}
                            onChange={() => setBindingType(b.index, 'circuito')}
                          />
                          Circuito
                        </Label>
                        <Label className="flex items-center gap-2 cursor-pointer text-sm">
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
                          className="mt-1 h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
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
                          className="mt-1 h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
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

                      {/* Restante do código do modal de vinculação permanece igual */}
                      <div className="mt-2">
                        <Label className="text-sm font-medium text-muted-foreground">Tipo de Rótulo</Label>
                        <div className="flex items-center gap-4 mt-1">
                          <Label className="flex items-center gap-2 cursor-pointer text-sm">
                            <input
                              type="radio"
                              name={`label-type-${b.index}`}
                              checked={!b.icon}
                              onChange={() => {
                                setButtonBindings((prev) =>
                                  prev.map((binding) =>
                                    binding.index === b.index ? { ...binding, icon: null } : binding
                                  )
                                );
                              }}
                            />
                            Texto
                          </Label>
                          <Label className="flex items-center gap-2 cursor-pointer text-sm">
                            <input
                              type="radio"
                              name={`label-type-${b.index}`}
                              checked={!!b.icon}
                              onChange={() => {
                                setButtonBindings((prev) =>
                                  prev.map((binding) =>
                                    binding.index === b.index ? { ...binding, engraver_text: null, icon: 'hvac' } : binding
                                  )
                                );
                              }}
                            />
                            Ícone
                          </Label>
                        </div>
                      </div>

                      {b.icon ? (
                        <div className="mt-2">
                          <Label htmlFor={`icon-select-${b.index}`} className="text-sm font-medium text-muted-foreground">
                            Ícone
                          </Label>
                          <Select
                            value={b.icon}
                            onValueChange={(value) => {
                              setButtonBindings((prev) =>
                                prev.map((binding) =>
                                  binding.index === b.index ? { ...binding, icon: value } : binding
                                )
                              );
                            }}
                          >
                            <SelectTrigger id={`icon-select-${b.index}`} className="mt-1 h-10 w-full rounded-xl border border-border bg-background px-3 text-sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="abajour">Abajour</SelectItem>
                              <SelectItem value="arandela">Arandela</SelectItem>
                              <SelectItem value="bright">Bright</SelectItem>
                              <SelectItem value="cascata">Cascata</SelectItem>
                              <SelectItem value="churrasco">Churrasco</SelectItem>
                              <SelectItem value="clean room">Clean Room</SelectItem>
                              <SelectItem value="concierge">Concierge</SelectItem>
                              <SelectItem value="curtains">Curtains</SelectItem>
                              <SelectItem value="curtains preset 1">Curtains Preset 1</SelectItem>
                              <SelectItem value="curtains preset 2">Curtains Preset 2</SelectItem>
                              <SelectItem value="day">Day</SelectItem>
                              <SelectItem value="dim penumbra">Dim Penumbra</SelectItem>
                              <SelectItem value="dinner">Dinner</SelectItem>
                              <SelectItem value="do not disturb">Do Not Disturb</SelectItem>
                              <SelectItem value="door">Door</SelectItem>
                              <SelectItem value="doorbell">Doorbell</SelectItem>
                              <SelectItem value="fan">Fan</SelectItem>
                              <SelectItem value="fireplace">Fireplace</SelectItem>
                              <SelectItem value="garage">Garage</SelectItem>
                              <SelectItem value="gate">Gate</SelectItem>
                              <SelectItem value="good night">Good Night</SelectItem>
                              <SelectItem value="gym1">Gym 1</SelectItem>
                              <SelectItem value="gym2">Gym 2</SelectItem>
                              <SelectItem value="gym3">Gym 3</SelectItem>
                              <SelectItem value="hvac">HVAC</SelectItem>
                              <SelectItem value="irrigação">Irrigação</SelectItem>
                              <SelectItem value="jardim1">Jardim 1</SelectItem>
                              <SelectItem value="jardim2">Jardim 2</SelectItem>
                              <SelectItem value="lampada">Lampada</SelectItem>
                              <SelectItem value="laundry">Laundry</SelectItem>
                              <SelectItem value="leaving">Leaving</SelectItem>
                              <SelectItem value="light preset 1">Light Preset 1</SelectItem>
                              <SelectItem value="light preset 2">Light Preset 2</SelectItem>
                              <SelectItem value="lower shades">Lower Shades</SelectItem>
                              <SelectItem value="luminaria de piso">Luminaria de Piso</SelectItem>
                              <SelectItem value="medium">Medium</SelectItem>
                              <SelectItem value="meeting">Meeting</SelectItem>
                              <SelectItem value="movie">Movie</SelectItem>
                              <SelectItem value="music">Music</SelectItem>
                              <SelectItem value="night">Night</SelectItem>
                              <SelectItem value="onoff">On/Off</SelectItem>
                              <SelectItem value="padlock">Padlock</SelectItem>
                              <SelectItem value="party">Party</SelectItem>
                              <SelectItem value="pendant">Pendant</SelectItem>
                              <SelectItem value="piscina 1">Piscina 1</SelectItem>
                              <SelectItem value="piscina 2">Piscina 2</SelectItem>
                              <SelectItem value="pizza">Pizza</SelectItem>
                              <SelectItem value="raise shades">Raise Shades</SelectItem>
                              <SelectItem value="reading">Reading</SelectItem>
                              <SelectItem value="shades">Shades</SelectItem>
                              <SelectItem value="shades preset 1">Shades Preset 1</SelectItem>
                              <SelectItem value="shades preset 2">Shades Preset 2</SelectItem>
                              <SelectItem value="spot">Spot</SelectItem>
                              <SelectItem value="steam room">Steam Room</SelectItem>
                              <SelectItem value="turned off">Turned Off</SelectItem>
                              <SelectItem value="tv">TV</SelectItem>
                              <SelectItem value="volume">Volume</SelectItem>
                              <SelectItem value="welcome">Welcome</SelectItem>
                              <SelectItem value="wine">Wine</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      ) : (
                        <div className="mt-2">
                          <Label htmlFor={`engraver-text-${b.index}`} className="text-sm font-medium text-muted-foreground">
                            Texto do Botão
                          </Label>
                          <Input
                            id={`engraver-text-${b.index}`}
                            value={b.engraver_text ?? ''}
                            onChange={(e) => {
                              const text = e.target.value.slice(0, 7);
                              setButtonBindings((prev) =>
                                prev.map((binding) =>
                                  binding.index === b.index ? { ...binding, engraver_text: text, icon: null } : binding
                                )
                              );
                            }}
                            maxLength={7}
                            placeholder="Max 7 chars"
                            className="mt-1 h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
                          />
                        </div>
                      )}

                      <div className="mt-2 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id={`is-rocker-${b.index}`}
                            checked={b.is_rocker}
                            onChange={(e) => {
                              const is_rocker = e.target.checked;
                              setButtonBindings((prev) =>
                                prev.map((binding) =>
                                  binding.index === b.index ? { ...binding, is_rocker } : binding
                                )
                              );
                            }}
                          />
                          <Label htmlFor={`is-rocker-${b.index}`} className="text-sm font-medium text-muted-foreground">
                            É Rocker?
                          </Label>
                        </div>
                        {b.is_rocker && (
                          <div className="flex items-center gap-2">
                            <Label className="text-sm font-medium text-muted-foreground">Estilo:</Label>
                            <Select
                              value={b.rocker_style}
                              onValueChange={(value: 'up-down' | 'left-right') => {
                                setButtonBindings((prev) =>
                                  prev.map((binding) =>
                                    binding.index === b.index ? { ...binding, rocker_style: value } : binding
                                  )
                                );
                              }}
                            >
                              <SelectTrigger className="h-8 text-sm rounded-lg w-[120px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="up-down">Sobe/Desce</SelectItem>
                                <SelectItem value="left-right">Esq/Dir</SelectItem>
                                <SelectItem value="previous-next">Ant/Prox</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex flex-col sm:flex-row justify-end gap-2 mt-6">
                  <Button type="button" variant="ghost" onClick={closeBindings} className="order-2 sm:order-1">
                    Cancelar
                  </Button>
                  <Button onClick={saveBindings} disabled={bindingLoading} className="order-1 sm:order-2">
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
