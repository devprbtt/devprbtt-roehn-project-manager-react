import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Sparkles, Lightbulb, Blinds, Snowflake } from "lucide-react";

type Circuito = {
  id: number;
  identificador: string;
  nome: string;
  tipo: "luz" | "persiana" | "hvac";
  dimerizavel?: boolean;
  potencia?: number;
  ambiente: { id: number; nome: string; area?: { id: number; nome: string } };
  sak?: string | null;
};

type Ambiente = {
  id: number;
  nome: string;
  area?: { id: number; nome: string };
};

interface CircuitEditModalProps {
  circuito: Circuito | null;
  ambientes: Ambiente[];
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedCircuito: Circuito) => void;
}

const CircuitEditModal = ({ circuito, ambientes, isOpen, onClose, onSave }: CircuitEditModalProps) => {
  const { toast } = useToast();
  const [identificador, setIdentificador] = useState("");
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState<"luz" | "persiana" | "hvac">("luz");
  const [ambienteId, setAmbienteId] = useState<number | "">("");
  const [dimerizavel, setDimerizavel] = useState(false);
  const [potencia, setPotencia] = useState<string>("");
  const onlyInts = (v: string) => v.replace(/[^\d]/g, "");

  useEffect(() => {
    if (circuito) {
      setIdentificador(circuito.identificador);
      setNome(circuito.nome);
      setTipo(circuito.tipo);
      setAmbienteId(circuito.ambiente.id);
      setDimerizavel(circuito.dimerizavel || false);
      setPotencia(circuito.potencia?.toString() || "");
    }
  }, [circuito]);

  const handleSave = async () => {
    if (!circuito) return;

    if (!identificador.trim() || !nome.trim() || !tipo || !ambienteId) {
      toast({ variant: "destructive", title: "Erro", description: "Preencha todos os campos." });
      return;
    }

    const updatedCircuito = {
      ...circuito,
      identificador: identificador.trim(),
      nome: nome.trim(),
      tipo,
      dimerizavel: tipo === 'luz' ? dimerizavel : false,
      potencia: potencia === "" ? undefined : parseInt(potencia, 10),
      ambiente: { ...circuito.ambiente, id: Number(ambienteId) },
    };

    try {
      const res = await fetch(`/api/circuitos/${circuito.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identificador: updatedCircuito.identificador,
          nome: updatedCircuito.nome,
          tipo: updatedCircuito.tipo,
          dimerizavel: updatedCircuito.dimerizavel,
          potencia: updatedCircuito.potencia,
          ambiente_id: updatedCircuito.ambiente.id,
        }),
      });

      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }

      const data = await res.json();
      if (data.ok) {
        onSave(updatedCircuito);
        toast({ title: "Sucesso!", description: "Circuito atualizado." });
        onClose();
      } else {
        toast({ variant: "destructive", title: "Erro", description: data.error || "Falha ao atualizar circuito." });
      }
    } catch (error) {
      console.error("Erro ao atualizar circuito:", error);
      toast({ variant: "destructive", title: "Erro", description: "Falha ao se conectar ao servidor." });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar Circuito</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-identificador">Identificador</Label>
              <Input id="edit-identificador" value={identificador} onChange={(e) => setIdentificador(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-nome">Nome</Label>
              <Input id="edit-nome" value={nome} onChange={(e) => setNome(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-tipo">Tipo</Label>
              <Select value={tipo} onValueChange={(v) => setTipo(v as any)}>
                <SelectTrigger id="edit-tipo">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="luz"><div className="flex items-center gap-2"><Lightbulb className="h-4 w-4" /><span>Luz</span></div></SelectItem>
                  <SelectItem value="persiana"><div className="flex items-center gap-2"><Blinds className="h-4 w-4" /><span>Persiana</span></div></SelectItem>
                  <SelectItem value="hvac"><div className="flex items-center gap-2"><Snowflake className="h-4 w-4" /><span>HVAC</span></div></SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-ambiente">Ambiente</Label>
              <Select value={ambienteId.toString()} onValueChange={(v) => setAmbienteId(Number(v))}>
                <SelectTrigger id="edit-ambiente">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ambientes.map((a) => (
                    <SelectItem key={a.id} value={a.id.toString()}>
                      {a.area?.nome ? `${a.nome} (${a.area.nome})` : a.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 items-center">
            {tipo === 'luz' && (
              <div className="flex items-center space-x-2">
                <input type="checkbox" id="edit-dimerizavel" checked={dimerizavel} onChange={(e) => setDimerizavel(e.target.checked)} />
                <Label htmlFor="edit-dimerizavel" className="flex items-center gap-2"><Sparkles className="w-4 h-4" />Dimerizável</Label>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="edit-potencia">Potência (W)</Label>
              <Input id="edit-potencia" value={potencia} onChange={(e) => setPotencia(onlyInts(e.target.value))} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
          </DialogClose>
          <Button onClick={handleSave}>Salvar Alterações</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CircuitEditModal;