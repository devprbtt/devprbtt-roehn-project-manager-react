import { useEffect, useMemo } from "react";
import { useForm, useFieldArray, Controller, useWatch, UseFormGetValues, UseFormSetValue } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useCreateCena, useUpdateCena } from "@/hooks/useCenas";
import type { Cena, Acao, CenaFormData } from "@/types/cena";
import type { Circuito, Ambiente, Area } from "@/types/project";
import { PlusCircle, Trash2, FolderPlus } from "lucide-react";

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
  ambiente_id: z.number(),
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
  ambienteId: number;
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
        (c) => c.ambiente.id === Number(targetAmbienteId)
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
      <div className="mt-4 space-y-3 p-3 bg-slate-100 rounded-lg">
        <h4 className="text-sm font-semibold text-slate-600">Configurações Individuais do Grupo</h4>
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
    const currentAction = useWatch({ control, name: `acoes.${index}` });

    // Sincroniza os sliders individuais com o master
    useEffect(() => {
        if (currentAction.action_type === 7) {
            const customActions = getValues(`acoes.${index}.custom_acoes`);
            if (customActions) {
                customActions.forEach((_, customIndex) => {
                    setValue(`acoes.${index}.custom_acoes.${customIndex}.level`, currentAction.level);
                });
            }
        }
    }, [currentAction.level, currentAction.action_type, index, getValues, setValue]);


    const getTargetName = (action: Partial<Acao>): string => {
        if (!action.target_guid) return "Selecione...";
        if (action.action_type === 0) {
            const circuit = projectCircuits.find(c => String(c.id) === String(action.target_guid));
            return circuit ? `${circuit.nome} (${circuit.identificador})` : "Circuito não encontrado";
        }
        if (action.action_type === 7) {
            const ambiente = projectAmbientes.find(a => String(a.id) === String(action.target_guid));
            return ambiente ? `Todas as luzes - ${ambiente.nome}` : "Ambiente não encontrado";
        }
        return "Desconhecido";
      }

    return (
        <div className="p-4 mb-4 border rounded-lg space-y-4 bg-slate-50">
            <div className="flex justify-between items-start">
                <div className="flex-1 space-y-2">
                    <FormField
                        control={control}
                        name={`acoes.${index}.target_guid`}
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>Alvo da Ação</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                                <SelectTrigger>
                                <SelectValue placeholder="Selecione o alvo...">
                                    {getTargetName(currentAction)}
                                </SelectValue>
                                </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                                {currentAction.action_type === 0 && projectCircuits.map(c => (
                                <SelectItem key={c.id} value={String(c.id)}>
                                    {c.nome} ({c.identificador})
                                </SelectItem>
                                ))}
                                {currentAction.action_type === 7 && projectAmbientes.map(a => (
                                <SelectItem key={a.id} value={String(a.id)}>
                                    Todas as Luzes - {a.nome} ({a.area.nome})
                                </SelectItem>
                                ))}
                            </SelectContent>
                            </Select>
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
  ambienteId,
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
        ambiente_id: ambienteId,
        acoes: [],
    },
  });

  useEffect(() => {
    if (scene && isEditing) {
        form.reset({
            nome: scene.nome,
            ambiente_id: scene.ambiente_id,
            acoes: scene.acoes.map(a => ({
                ...a,
                target_guid: String(a.target_guid),
                custom_acoes: a.custom_acoes.map(ca => ({ ...ca, target_guid: String(ca.target_guid) }))
              }))
        });
    } else {
        form.reset({
            nome: "",
            ambiente_id: ambienteId,
            acoes: [],
        });
    }
  }, [scene, isEditing, ambienteId, form]);

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "acoes",
  });

  const onSubmit = (data: CenaFormData) => {
    const submissionData = {
      ...data,
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
            form.reset();
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
    <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-xl shadow-slate-900/5">
        <CardHeader className="pb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg">
              <FolderPlus className="w-6 h-6 text-white" />
            </div>
            <div>
              <CardTitle className="text-2xl font-bold text-slate-900">
                {isEditing ? "Editar Cena" : "Adicionar Nova Cena"}
              </CardTitle>
              <p className="text-slate-600 mt-1">
                {isEditing ? `Editando "${scene?.nome}"` : "Preencha as informações da nova cena"}
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="nome"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome da Cena</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Jantar, Cinema, Leitura..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Ações</h3>
              <ScrollArea className="h-[400px] p-4 border rounded-md">
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
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => addAction('circuit')}>
                  <PlusCircle className="mr-2 h-4 w-4" /> Adicionar Circuito
                </Button>
                <Button type="button" variant="outline" onClick={() => addAction('room')}>
                  <PlusCircle className="mr-2 h-4 w-4" /> Adicionar Grupo de Luzes
                </Button>
              </div>
            </div>

            <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={() => form.reset()}>
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