import { useEffect, useMemo, useState } from "react";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { useProject } from "@/store/project";
import { Printer, FileDown, FileOutput, Lightbulb, Blinds, Snowflake } from "lucide-react";

type VincInfo = { modulo_nome: string; canal: number };
type Circuito = {
  id: number;
  tipo: "luz" | "persiana" | "hvac";
  identificador: string;
  nome: string;
  vinculacao?: VincInfo | null;
};
type Ambiente = { id: number; nome: string; circuitos: Circuito[] };
type Area = { id: number; nome: string; ambientes: Ambiente[] };

type ProjetoTree = {
  projeto: { id: number; nome: string } | null;
  areas: Area[];
};

export default function Projeto() {
  const { projeto } = useProject();
  const projetoSelecionado = !!projeto?.id;
  const { toast } = useToast();

  const [data, setData] = useState<ProjetoTree>({ projeto: null, areas: [] });
  const [loading, setLoading] = useState(true);

  // Modal .RWP
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

  const fetchTree = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/projeto_tree", { credentials: "same-origin" });
      const json = await res.json();
      setData({
        projeto: json?.projeto || null,
        areas: json?.areas || [],
      });
      if (json?.projeto?.nome) setProjectName(json.projeto.nome);
    } catch {
      toast({ variant: "destructive", title: "Erro", description: "Falha ao carregar o projeto." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (projetoSelecionado) fetchTree();
  }, [projetoSelecionado]);

  const printFooter = useMemo(() => {
    const now = new Date();
    const fmt = now.toLocaleDateString("pt-BR") + " às " + now.toLocaleTimeString("pt-BR");
    const name = data.projeto?.nome || "";
    return `Relatório gerado em ${fmt} | Projeto: ${name} | Roehn Automação Residencial`;
  }, [data.projeto?.nome]);

  const TipoIcon = (t: Circuito["tipo"]) =>
    t === "luz" ? <Lightbulb className="h-4 w-4 text-orange-500 inline" /> :
    t === "persiana" ? <Blinds className="h-4 w-4 text-black inline" /> :
    <Snowflake className="h-4 w-4 text-blue-500 inline" />;

  function handlePrint() {
    window.print();
  }

  function openPdf() {
    const id = data.projeto?.id;
    if (!id) return;
    // abre o AS BUILT (PDF) em nova guia (mantém fluxo legado)
    window.open(`/exportar-pdf/${id}`, "_blank");
  }

  // Validações do modal .rwp (espelhando o legado)
  function validateAndSubmitRwp(e: React.FormEvent<HTMLFormElement>) {
    // telefone: apenas dígitos, mínimo 10
    const numbers = clientPhone.replace(/\D/g, "");
    if (numbers.length < 10) {
      e.preventDefault();
      toast({ variant: "destructive", title: "Telefone inválido", description: "Use DDD + número (mínimo 10 dígitos)." });
      return;
    }
    // ip
    const ipPattern = /^((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    if (!ipPattern.test(m4ip)) {
      e.preventDefault();
      toast({ variant: "destructive", title: "IP inválido", description: "Insira um endereço IP válido para o Módulo M4." });
      return;
    }
    // cria campo oculto client_phone_clean
    const hidden = document.createElement("input");
    hidden.type = "hidden";
    hidden.name = "client_phone_clean";
    hidden.value = numbers;
    e.currentTarget.appendChild(hidden);
  }

  return (
    <Layout projectSelected={projetoSelecionado}>
      <div className="max-w-6xl mx-auto print:max-w-full">
        <div className="flex items-center justify-between mb-4 no-print">
          <h2 className="text-2xl font-bold">Visualizar Projeto Completo{data.projeto?.nome ? `: ${data.projeto.nome}` : ""}</h2>
          <div className="flex flex-wrap gap-2">
            <Button onClick={openPdf}>
              <FileDown className="h-4 w-4 mr-2" />
              Gerar AS BUILT
            </Button>
            <Button variant="secondary" onClick={() => setShowRwp(true)}>
              <FileOutput className="h-4 w-4 mr-2" />
              Gerar Arquivo .rwp
            </Button>
            <Button variant="outline" onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-2" />
              Imprimir Resumo
            </Button>
          </div>
        </div>

        {!projetoSelecionado && (
          <Alert className="mb-6">
            <AlertDescription>Nenhum projeto selecionado. Volte à página inicial para selecionar ou criar um projeto.</AlertDescription>
          </Alert>
        )}

        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : data.areas.length === 0 ? (
          <p className="text-muted-foreground">Nenhuma área/ambiente/circuito cadastrado.</p>
        ) : (
          <div className="space-y-6">
            {data.areas.map(area => (
              <Card key={area.id} className="border-0 shadow-sm rounded-3xl">
                <CardHeader className="border-0">
                  <h3 className="text-xl font-semibold">Área: {area.nome}</h3>
                </CardHeader>
                <CardContent>
                  {area.ambientes.map(amb => (
                    <div key={amb.id} className="mb-6">
                      <h4 className="text-base font-medium mb-2">Ambiente: {amb.nome}</h4>
                      <div className="overflow-x-auto rounded-lg border">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-left border-b bg-muted/40">
                              <th className="py-2 px-3">Tipo</th>
                              <th className="py-2 px-3">Identificador</th>
                              <th className="py-2 px-3">Nome do Circuito</th>
                              <th className="py-2 px-3">Módulo</th>
                              <th className="py-2 px-3">Canal</th>
                            </tr>
                          </thead>
                          <tbody>
                            {amb.circuitos.map(c => (
                              <tr key={c.id} className="border-b">
                                <td className="py-2 px-3">
                                  {TipoIcon(c.tipo)}{" "}
                                  {c.tipo === "luz" ? "Luz" : c.tipo === "persiana" ? "Persiana" : "HVAC"}
                                </td>
                                <td className="py-2 px-3">{c.identificador}</td>
                                <td className="py-2 px-3">{c.nome}</td>
                                <td className="py-2 px-3">
                                  {c.vinculacao ? c.vinculacao.modulo_nome : <span className="text-red-600">-</span>}
                                </td>
                                <td className="py-2 px-3">
                                  {c.vinculacao ? c.vinculacao.canal : <span className="text-red-600">-</span>}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Rodapé de impressão */}
        <div className="print:block hidden mt-6 text-xs text-center text-muted-foreground">
          {printFooter}
        </div>
      </div>

      {/* Modal simples para .rwp */}
      {showRwp && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
          <div className="bg-white w-full max-w-3xl rounded-2xl shadow-lg overflow-hidden">
            <div className="px-6 py-4 bg-primary text-primary-foreground flex items-center justify-between">
              <h5 className="font-semibold">Gerar Projeto Roehn (.rwp)</h5>
              <button className="text-primary-foreground/80 hover:text-white" onClick={() => setShowRwp(false)}>✕</button>
            </div>
            <div className="p-6">
              <form
                method="POST"
                action="/roehn/import"
                encType="multipart/form-data"
                target="_blank"
                onSubmit={validateAndSubmitRwp}
                className="space-y-6"
              >
                {/* Hidden: parâmetros fixos */}
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
                      <Input id="client_name" name="client_name" value={clientName} onChange={(e) => setClientName(e.target.value)} required autoComplete="name" />
                    </div>
                    <div>
                      <Label htmlFor="client_email">Email do Cliente</Label>
                      <Input id="client_email" name="client_email" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)}  autoComplete="name"/>
                    </div>
                    <div>
                      <Label htmlFor="client_phone">Telefone</Label>
                      <Input id="client_phone" name="client_phone" placeholder="(00) 00000-0000" value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} autoComplete="name" />
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

                <div className="flex justify-end gap-2">
                  <Button type="button" variant="secondary" onClick={() => setShowRwp(false)}>Fechar</Button>
                  <Button type="submit">
                    <FileDown className="h-4 w-4 mr-2" />
                    Gerar e Baixar
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
