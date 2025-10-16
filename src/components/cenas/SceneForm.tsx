import { useEffect, useMemo, useRef, useState } from "react";
import { useForm, useFieldArray, Controller, useWatch, UseFormGetValues, UseFormSetValue } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Command, CommandInput, CommandEmpty, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useCreateCena, useUpdateCena } from "@/hooks/useCenas";
import type { Cena, Acao, CenaFormData } from "@/types/cena";
import type { Circuito, Ambiente, Area } from "@/types/project";
import { PlusCircle, Trash2, FolderPlus, Lightbulb, Blinds, Check, ChevronsUpDown } from "lucide-react";

// --- Zod Schema for Validation ---
const customAcaoSchema = z.object({
  target_guid: z.string(),
  enable: z.boolean(),
  level: z.number().min(0).max(100),
});

const acaoSchema = z.object({
  level: z.number().min(0).max(100),
  action_type: z.number(), // 0 for circuit, 7 for room
  target_guid: z.string().min(1, "O alvo é obrigatório"),
  custom_acoes: z.array(customAcaoSchema),
});

const cenaSchema = z.object({
  nome: z.string().min(2, { message: "O nome deve ter pelo menos 2 caracteres." }),
  ambiente_id: z.coerce.number({ required_error: "É obrigatório selecionar um ambiente." }).min(1, "É obrigatório selecionar um ambiente."),
  scene_movers: z.boolean().optional(),
  acoes: z.array(acaoSchema),
});

// --- Types for Props ---
interface CustomActionItemProps {
    actionIndex: number;
    customIndex: number;
    control: any;
    circuit: Circuito;
}
interface CustomActionsArrayProps {
    actionIndex: number;
    control: any;
    getValues: UseFormGetValues<CenaFormData>;
    projectCircuits: Circuito[];
    targetAmbienteId: string | null;
}

interface ActionItemProps {
    index: number;
    control: any;
    getValues: UseFormGetValues<CenaFormData>;
    setValue: UseFormSetValue<CenaFormData>;
    remove: (index: number) => void;
    projectCircuits: Circuito[];
    projectAmbientes: (Ambiente & { area: Area })[];
}

interface SceneFormProps {
  scene?: Cena | null;
  projectCircuits: Circuito[];
  projectAmbientes: (Ambiente & { area: Area })[];
  onSuccess: () => void;
}

// --- Sub-components ---

const CustomActionItem = ({ actionIndex, customIndex, control, circuit }: CustomActionItemProps) => {
    const isEnabled = useWatch({
      control,
      name: `acoes.${actionIndex}.custom_acoes.${customIndex}.enable`,
    });

    return (
      <div className="flex items-center gap-4 p-2 border-b">
        <FormField
          control={control}
          name={`acoes.${actionIndex}.custom_acoes.${customIndex}.enable`}
          render={({ field }) => (
            <FormItem className="flex items-center space-x-2 space-y-0">
              <FormControl>
                <Checkbox checked={field.value} onCheckedChange={field.onChange} />
              </FormControl>
              <FormLabel className="text-sm font-medium !mt-0">
                {circuit.nome}
              </FormLabel>
            </FormItem>
          )}
        />
        <Controller
          name={`acoes.${actionIndex}.custom_acoes.${customIndex}.level`}
          control={control}
          render={({ field: { onChange, value } }) => (
            <div className="flex-1 flex items-center gap-3">
              <Slider
                value={[value]}
                onValueChange={(vals) => onChange(vals[0])}
                max={100}
                step={1}
                disabled={!isEnabled}
              />
              <span className="text-xs font-mono w-10 text-right">
                {value}%
              </span>
            </div>
          )}
        />
      </div>
    );
  };

const CustomActionsArray = ({ actionIndex, control, getValues, projectCircuits, targetAmbienteId }: CustomActionsArrayProps) => {
    const { fields, replace } = useFieldArray({
      control,
      name: `acoes.${actionIndex}.custom_acoes`,
    });

    useEffect(() => {
      if (!targetAmbienteId) {
        replace([]);
        return;
      }

      const circuitsInRoom = projectCircuits.filter(
        (c) => c.ambiente.id === Number(targetAmbienteId) && c.tipo === 'luz'
      );

      const existingCustomActions = getValues(`acoes.${actionIndex}.custom_acoes`) || [];
      const newCustomActions = circuitsInRoom.map(circuit => {
        const existing = existingCustomActions.find(ca => ca.target_guid === String(circuit.id));
        return existing || {
          target_guid: String(circuit.id),
          enable: true,
          level: 50,
        };
      });

      replace(newCustomActions);

    }, [targetAmbienteId, projectCircuits, replace, actionIndex, getValues]);

    if (!targetAmbienteId) return null;

    return (
      <div className="mt-4 space-y-3 p-3 bg-muted rounded-lg">
        <h4 className="text-sm font-semibold text-muted-foreground">Configurações Individuais do Grupo</h4>
        {fields.map((field, customIndex) => {
          const customAction = getValues(`acoes.${actionIndex}.custom_acoes.${customIndex}`);
          const circuit = projectCircuits.find(c => String(c.id) === customAction.target_guid);
          if (!circuit) return null;

          return (
            <CustomActionItem
                key={field.id}
                actionIndex={actionIndex}
                customIndex={customIndex}
                control={control}
                circuit={circuit}
            />
          );
        })}
      </div>
    );
  };

const ActionItem = ({ index, control, getValues, setValue, remove, projectCircuits, projectAmbientes }: ActionItemProps) => {
    const allActions = useWatch({ control, name: "acoes" });
    const currentAction = allActions[index];
    const [open, setOpen] = useState(false);
    const isInitialMount = useRef(true);

    // Sincroniza os sliders individuais com o master, ignorando a primeira renderização
    useEffect(() => {
        if (isInitialMount.current) {
            isInitialMount.current = false;
            return;
        }

        if (currentAction.action_type === 7) {
            const customActions = getValues(`acoes.${index}.custom_acoes`);
            if (customActions) {
                customActions.forEach((_, customIndex) => {
                    setValue(`acoes.${index}.custom_acoes.${customIndex}.level`, currentAction.level);
                });
            }
        }
    }, [currentAction.level]);

    const getTargetName = (action: Partial<Acao>): string => {
        if (!action.target_guid) return "Selecione...";
        if (action.action_type === 0) { // Circuit
            const circuit = projectCircuits.find(c => String(c.id) === String(action.target_guid));
            if (!circuit) return "Circuito não encontrado";
            if (circuit.tipo === 'hvac') return `Circuito Inválido (HVAC): ${circuit.nome}`;
            return `${circuit.nome} (${circuit.identificador})`;
        }
        if (action.action_type === 7) { // Room
            const ambiente = projectAmbientes.find(a => String(a.id) === String(action.target_guid));
            return ambiente ? `Todas as luzes - ${ambiente.nome}` : "Ambiente não encontrado";
        }
        return "Desconhecido";
    }

    const availableCircuits = useMemo(() => {
        const selectedCircuitIds = allActions
            .filter((act, actIndex) => act.action_type === 0 && actIndex !== index && act.target_guid)
            .map(act => act.target_guid);

        return projectCircuits.filter(
            c => c.tipo !== 'hvac' && !selectedCircuitIds.includes(String(c.id))
        );
    }, [allActions, projectCircuits, index]);

    return (
        <div className="p-4 mb-4 border rounded-lg space-y-4 bg-slate-50">
            <div className="flex justify-between items-start">
                <div className="flex-1 space-y-2">
                    <FormField
                        control={control}
                        name={`acoes.${index}.target_guid`}
                        render={({ field }) => (
                        <FormItem className="flex flex-col">
                            <FormLabel>Alvo da Ação</FormLabel>
                            {currentAction.action_type === 7 ? (
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Selecione o alvo...">
                                                {getTargetName(currentAction)}
                                            </SelectValue>
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        {projectAmbientes.map(a => (
                                        <SelectItem key={a.id} value={String(a.id)}>
                                            Todas as Luzes - {a.nome} ({a.area.nome})
                                        </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            ) : (
                                <Popover open={open} onOpenChange={setOpen}>
                                    <PopoverTrigger asChild>
                                        <FormControl>
                                            <Button
                                                variant="outline"
                                                role="combobox"
                                                className={cn(
                                                    "w-full justify-between",
                                                    !field.value && "text-muted-foreground"
                                                )}
                                            >
                                                {getTargetName(currentAction)}
                                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                            </Button>
                                        </FormControl>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[--radix-popover-trigger-width] max-h-[--radix-popover-content-available-height] p-0">
                                        <Command>
                                            <CommandInput placeholder="Buscar circuito..." />
                                            <CommandList>
                                                <CommandEmpty>Nenhum circuito encontrado.</CommandEmpty>
                                                <CommandGroup>
                                                    {availableCircuits.map(c => (
                                                        <CommandItem
                                                            value={`${c.nome} ${c.identificador} ${c.ambiente.area.nome} ${c.ambiente.nome}`}
                                                            key={c.id}
                                                            onSelect={() => {
                                                                field.onChange(String(c.id));
                                                                setOpen(false);
                                                            }}
                                                        >
                                                            <Check
                                                                className={cn(
                                                                    "mr-2 h-4 w-4",
                                                                    String(c.id) === field.value ? "opacity-100" : "opacity-0"
                                                                )}
                                                            />
                                                            <div className="flex items-center gap-2">
                                                                {c.tipo === 'luz' && <Lightbulb className="h-4 w-4 text-amber-500" />}
                                                                {c.tipo === 'persiana' && <Blinds className="h-4 w-4 text-sky-600" />}
                                                                <div>
                                                                    <p className="font-medium">{c.nome} <span className="text-xs text-muted-foreground">({c.identificador})</span></p>
                                                                    <p className="text-xs text-muted-foreground">{c.ambiente.area.nome} &gt; {c.ambiente.nome}</p>
                                                                </div>
                                                            </div>
                                                        </CommandItem>
                                                    ))}
                                                </CommandGroup>
                                            </CommandList>
                                        </Command>
                                    </PopoverContent>
                                </Popover>
                            )}
                            <FormMessage />
                        </FormItem>
                        )}
                    />

                    <Controller
                        name={`acoes.${index}.level`}
                        control={control}
                        render={({ field: { onChange, value } }) => (
                            <div className="space-y-2">
                                <FormLabel>Intensidade Master: {value}%</FormLabel>
                                <Slider
                                    value={[value]}
                                    onValueChange={(vals) => onChange(vals[0])}
                                    max={100}
                                    step={1}
                                />
                            </div>
                        )}
                    />
                </div>
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => remove(index)}
                    className="ml-4 flex-shrink-0"
                >
                    <Trash2 className="h-4 w-4" />
                </Button>
            </div>
            {currentAction.action_type === 7 && (
            <CustomActionsArray
                actionIndex={index}
                control={control}
                getValues={getValues}
                projectCircuits={projectCircuits}
                targetAmbienteId={currentAction.target_guid}
            />
            )}
        </div>
    );
};


// --- Main Form Component ---
export const SceneForm = ({
  scene,
  projectCircuits,
  projectAmbientes,
  onSuccess,
}: SceneFormProps) => {
  const isEditing = !!scene;
  const createCenaMutation = useCreateCena();
  const updateCenaMutation = useUpdateCena();

  const form = useForm<CenaFormData>({
    resolver: zodResolver(cenaSchema),
    defaultValues: {
        nome: "",
        ambiente_id: undefined,
        acoes: [],
        scene_movers: false,
    },
  });

  const watchedActions = useWatch({
    control: form.control,
    name: "acoes",
  });

  const isPersianaOnly = useMemo(() => {
    if (!watchedActions || watchedActions.length === 0) {
        return false;
    }

    for (const acao of watchedActions) {
        if (acao.action_type === 0) { // Circuit
            const circuit = projectCircuits.find(c => String(c.id) === acao.target_guid);
            if (!circuit || circuit.tipo !== 'persiana') {
                return false;
            }
        } else if (acao.action_type === 7) { // Room
            const circuitsInRoom = projectCircuits.filter(
                c => c.ambiente.id === Number(acao.target_guid) && c.tipo !== 'hvac'
            );
            if (circuitsInRoom.length === 0) {
                return false;
            }
            if (circuitsInRoom.some(c => c.tipo !== 'persiana')) {
                return false;
            }
        } else {
            return false;
        }
    }
    return true;
  }, [watchedActions, projectCircuits]);

  useEffect(() => {
    if (!isPersianaOnly) {
        form.setValue('scene_movers', false);
    }
  }, [isPersianaOnly, form]);


  useEffect(() => {
    if (scene && isEditing) {
        form.reset({
            nome: scene.nome,
            ambiente_id: scene.ambiente_id,
            scene_movers: scene.scene_movers || false,
            acoes: scene.acoes.map(a => ({
                ...a,
                target_guid: String(a.target_guid),
                custom_acoes: a.custom_acoes.map(ca => ({ ...ca, target_guid: String(ca.target_guid) }))
              }))
        });
    } else {
        form.reset({
            nome: "",
            ambiente_id: undefined,
            acoes: [],
            scene_movers: false,
        });
    }
  }, [scene, isEditing, form]);

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "acoes",
  });

  const onSubmit = (data: CenaFormData) => {
    const submissionData = {
      ...data,
      scene_movers: data.scene_movers || false,
      acoes: data.acoes.map(acao => ({
          ...acao,
          custom_acoes: acao.action_type === 7 ? acao.custom_acoes : []
      }))
    };

    const mutation = isEditing ? updateCenaMutation : createCenaMutation;
    const mutationData = isEditing ? { id: scene!.id, ...submissionData } : submissionData;

    mutation.mutate(mutationData as any, {
        onSuccess: () => {
            onSuccess();
            form.reset({ nome: "", ambiente_id: undefined, acoes: [], scene_movers: false });
        }
    });
  };

  const addAction = (type: 'circuit' | 'room') => {
    if (type === 'circuit') {
      append({ action_type: 0, level: 100, target_guid: "", custom_acoes: [] });
    } else {
      append({ action_type: 7, level: 100, target_guid: "", custom_acoes: [] });
    }
  };

  return (
    <Card className="bg-card/95 backdrop-blur-sm border border-border shadow-xl shadow-primary/10 dark:bg-card/85 dark:shadow-primary/20 w-full">
        <CardHeader className="pb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg">
              <FolderPlus className="w-6 h-6 text-white" />
            </div>
            <div>
              <CardTitle className="text-2xl font-bold text-foreground">
                {isEditing ? "Editar Cena" : "Adicionar Nova Cena"}
              </CardTitle>
              <p className="text-muted-foreground mt-1">
                {isEditing ? `Editando "${scene?.nome}"` : "Preencha as informações da nova cena"}
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                    control={form.control}
                    name="nome"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Nome da Cena</FormLabel>
                        <FormControl>
                            <Input placeholder="Ex: Jantar, Cinema..." {...field} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="ambiente_id"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Ambiente</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value ? String(field.value) : ""}>
                                <FormControl>
                                <SelectTrigger>
                                    <SelectValue placeholder="Selecione um ambiente" />
                                </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                {projectAmbientes.map(a => (
                                    <SelectItem key={a.id} value={String(a.id)}>
                                    {a.nome} ({a.area.nome})
                                    </SelectItem>
                                ))}
                                </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                    )}
                />
            </div>

            {isPersianaOnly && (
                <div className="pt-2">
                    <FormField
                        control={form.control}
                        name="scene_movers"
                        render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-start rounded-lg border p-3 shadow-sm bg-slate-50">
                                <FormControl>
                                    <Checkbox
                                        checked={field.value}
                                        onCheckedChange={field.onChange}
                                        disabled={!isPersianaOnly}
                                    />
                                </FormControl>
                                <div className="space-y-0.5 ml-3">
                                    <FormLabel>
                                        Habilitar movimentadores
                                    </FormLabel>
                                    <p className="text-[0.8rem] text-muted-foreground">
                                        Ative esta opção se a cena controla apenas persianas.
                                    </p>
                                </div>
                            </FormItem>
                        )}
                    />
                </div>
            )}

            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Ações</h3>
              <ScrollArea className="space-y-3 max-h-64 sm:max-h-96 overflow-y-auto pr-2">
                {fields.map((field, index) => (
                    <ActionItem
                        key={field.id}
                        index={index}
                        control={form.control}
                        getValues={form.getValues}
                        setValue={form.setValue}
                        remove={remove}
                        projectCircuits={projectCircuits}
                        projectAmbientes={projectAmbientes}
                    />
                ))}
              </ScrollArea>
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                <Button
                  type="button"
                  onClick={() => addAction('circuit')}
                  className="flex-1 h-11 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center gap-2 text-sm sm:text-base"
                >
                  <PlusCircle className="h-4 w-4 sm:h-5 sm:w-5" /> 
                  <span className="hidden xs:inline">Adicionar Circuito</span>
                  <span className="xs:hidden">Circuito</span>
                </Button>
                <Button
                  type="button"
                  onClick={() => addAction('room')}
                  className="flex-1 h-11 bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-700 hover:to-violet-700 text-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center gap-2 text-sm sm:text-base"
                >
                  <PlusCircle className="h-4 w-4 sm:h-5 sm:w-5" /> 
                  <span className="hidden xs:inline">Adicionar Grupo</span>
                  <span className="xs:hidden">Grupo</span>
                </Button>
              </div>
            </div>

            <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={() => form.reset({ nome: "", ambiente_id: undefined, acoes: [], scene_movers: false })}>
                    Cancelar
                </Button>
                <Button type="submit" disabled={createCenaMutation.isPending || updateCenaMutation.isPending}>
                    {isEditing ? "Salvar Alterações" : "Criar Cena"}
                </Button>
            </div>
          </form>
        </Form>
        </CardContent>
    </Card>
  );
};