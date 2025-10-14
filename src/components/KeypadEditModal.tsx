import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

type Keypad = {
  id: number;
  nome: string;
  hsnet: number;
  color: string;
  button_color: string;
  button_count: number;
  ambiente?: { id: number; nome: string; area?: { id: number; nome: string } };
};

type Ambiente = {
  id: number;
  nome: string;
  area?: { id: number; nome: string };
};

interface KeypadEditModalProps {
  keypad: Keypad | null;
  ambientes: Ambiente[];
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedKeypad: Keypad) => void;
}

const COLORS = [
  "WHITE", "BRASS", "BRUSHED BLACK", "BLACK", "BRONZE", "NICKEL", "SILVER", "TITANIUM"
] as const;

const KEYCOLORS = ["WHITE", "BLACK"] as const;

const KeypadEditModal = ({ keypad, ambientes, isOpen, onClose, onSave }: KeypadEditModalProps) => {
  const { toast } = useToast();
  const [nome, setNome] = useState("");
  const [hsnet, setHsnet] = useState<number | ''>('');
  const [color, setColor] = useState<(typeof COLORS)[number] | "">("");
  const [buttonColor, setButtonColor] = useState<(typeof KEYCOLORS)[number] | "">("");
  const [ambienteId, setAmbienteId] = useState<number | "">("");

  useEffect(() => {
    if (keypad) {
      setNome(keypad.nome);
      setHsnet(keypad.hsnet);
      setColor(keypad.color as any);
      setButtonColor(keypad.button_color as any);
      setAmbienteId(keypad.ambiente?.id || "");
    }
  }, [keypad]);

  const handleSave = async () => {
    if (!keypad) return;

    if (!nome.trim() || !hsnet || !color || !buttonColor || !ambienteId) {
      toast({ variant: "destructive", title: "Erro", description: "Preencha todos os campos." });
      return;
    }

    const selectedAmbiente = ambientes.find(a => a.id === Number(ambienteId));
    const updatedKeypad = {
      ...keypad,
      nome: nome.trim(),
      hsnet: Number(hsnet),
      color,
      button_color: buttonColor,
      ambiente: selectedAmbiente,
    };

    try {
      const res = await fetch(`/api/keypads/${keypad.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: updatedKeypad.nome,
          color: updatedKeypad.color,
          button_color: updatedKeypad.button_color,
          ambiente_id: Number(ambienteId),
        }),
      });

      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }

      const data = await res.json();
      if (data.ok) {
        onSave(updatedKeypad as Keypad);
        toast({ title: "Sucesso!", description: "Keypad atualizado." });
        onClose();
      } else {
        toast({ variant: "destructive", title: "Erro", description: data.error || "Falha ao atualizar keypad." });
      }
    } catch (error) {
      console.error("Erro ao atualizar keypad:", error);
      toast({ variant: "destructive", title: "Erro", description: "Falha ao se conectar ao servidor." });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar Keypad</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-nome">Nome</Label>
              <Input id="edit-nome" value={nome} onChange={(e) => setNome(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-hsnet">HSNET</Label>
              <Input id="edit-hsnet" type="number" value={hsnet} disabled />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-color">Cor</Label>
              <select id="edit-color" value={color} onChange={(e) => setColor(e.target.value as any)} className="w-full h-10 border rounded-md px-2">
                <option value="">Selecione</option>
                {COLORS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-button-color">Cor das Teclas</Label>
              <select id="edit-button-color" value={buttonColor} onChange={(e) => setButtonColor(e.target.value as any)} className="w-full h-10 border rounded-md px-2">
                <option value="">Selecione</option>
                {KEYCOLORS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-ambiente">Ambiente</Label>
            <select id="edit-ambiente" value={ambienteId.toString()} onChange={(e) => setAmbienteId(Number(e.target.value))} className="w-full h-10 border rounded-md px-2">
              {ambientes.map((a) => (
                <option key={a.id} value={a.id.toString()}>
                  {a.area?.nome ? `${a.nome} (${a.area.nome})` : a.nome}
                </option>
              ))}
            </select>
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

export default KeypadEditModal;