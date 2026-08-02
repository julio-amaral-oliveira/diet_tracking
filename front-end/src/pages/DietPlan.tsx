import { useState, useMemo, useCallback } from "react";
import {
  Utensils,
  Plus,
  Loader2,
  Pencil,
  AlertTriangle,
  Copy,
  Trash2,
  FileSpreadsheet,
  FileText,
  MoreVertical,
  Download,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MacroProgressBar } from "@/components/diet/MacroProgressBar";
import { MealCard } from "@/components/diet/MealCard";
import {
  useCurrentDietPlan,
  useAddMealToVariation,
  useCreateDietPlan,
  useUpdateDietPlanTargets,
  useUpdateMealItem,
  useCreateVariation,
  useRenameVariation,
  useDeleteVariation,
  useExportDietExcel,
  useExportDietPdf,
} from "@/hooks/use-diet";
import { useBodyLogs } from "@/hooks/use-body-logs";
import { toast } from "@/hooks/use-toast";

// Draft state: tracks local quantity edits keyed by item ID
type DraftChanges = Record<number, number>; // itemId -> new quantity
type MacroValues = { protein: string; carbs: string; fat: string };
type MacroFieldErrors = Partial<Record<keyof MacroValues, string>>;

const MACRO_LABELS: Record<keyof MacroValues, string> = {
  protein: "Proteína",
  carbs: "Carboidratos",
  fat: "Gordura",
};

const parseMacroValue = (value: string) => {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : NaN;
};

const validateMacroValues = (values: MacroValues) => {
  const errors: MacroFieldErrors = {};
  let positiveTotal = 0;

  (Object.keys(values) as Array<keyof MacroValues>).forEach((key) => {
    const parsed = parseMacroValue(values[key]);

    if (parsed === null) {
      errors[key] = `Informe ${MACRO_LABELS[key].toLowerCase()}.`;
      return;
    }

    if (Number.isNaN(parsed) || parsed < 0) {
      errors[key] = "Use um número maior ou igual a zero.";
      return;
    }

    positiveTotal += parsed;
  });

  return {
    errors,
    formError: positiveTotal > 0 ? "" : "Informe pelo menos uma meta maior que zero.",
  };
};

export default function DietPlan() {
  const { data: plan, isLoading, isError } = useCurrentDietPlan();
  const addMealToVariation = useAddMealToVariation();
  const createPlan = useCreateDietPlan();
  const updateTargets = useUpdateDietPlanTargets();
  const updateMealItem = useUpdateMealItem();
  const createVariation = useCreateVariation();
  const renameVariation = useRenameVariation();
  const deleteVariation = useDeleteVariation();
  const exportExcel = useExportDietExcel();
  const exportPdf = useExportDietPdf();
  const { data: bodyLogs } = useBodyLogs("default_user", undefined, undefined, 0, 1);

  const latestWeight = bodyLogs?.[0]?.weight_kg ?? null;

  // Active tab state (variation id as string)
  const [activeVariationTab, setActiveVariationTab] = useState<string>("");

  const [mealDialogOpen, setMealDialogOpen] = useState(false);
  const [newMealName, setNewMealName] = useState("");
  const [newMealNameError, setNewMealNameError] = useState("");
  const [createPlanOpen, setCreatePlanOpen] = useState(false);
  const [usePerKg, setUsePerKg] = useState(false);
  const [newPlan, setNewPlan] = useState({ protein: "", carbs: "", fat: "" });
  const [newPlanPerKg, setNewPlanPerKg] = useState({ protein: "", carbs: "", fat: "" });
  const [newPlanErrors, setNewPlanErrors] = useState<MacroFieldErrors>({});
  const [newPlanFormError, setNewPlanFormError] = useState("");

  // Edit Targets state
  const [editTargetsOpen, setEditTargetsOpen] = useState(false);
  const [editUsePerKg, setEditUsePerKg] = useState(false);
  const [editTargets, setEditTargets] = useState({ protein: "", carbs: "", fat: "" });
  const [editTargetsPerKg, setEditTargetsPerKg] = useState({ protein: "", carbs: "", fat: "" });
  const [editTargetsErrors, setEditTargetsErrors] = useState<MacroFieldErrors>({});
  const [editTargetsFormError, setEditTargetsFormError] = useState("");

  // Draft mode state
  const [draftChanges, setDraftChanges] = useState<DraftChanges>({});
  const [isSaving, setIsSaving] = useState(false);

  // Variation management state
  const [newVariationDialogOpen, setNewVariationDialogOpen] = useState(false);
  const [newVariationName, setNewVariationName] = useState("");
  const [newVariationNameError, setNewVariationNameError] = useState("");
  const [newVariationSourceError, setNewVariationSourceError] = useState("");
  const [newVariationMode, setNewVariationMode] = useState<"empty" | "duplicate">("empty");
  const [duplicateSourceId, setDuplicateSourceId] = useState<number | null>(null);

  // Rename variation state
  const [renameVariationDialogOpen, setRenameVariationDialogOpen] = useState(false);
  const [renameVariationId, setRenameVariationId] = useState<number | null>(null);
  const [renameVariationValue, setRenameVariationValue] = useState("");
  const [renameVariationError, setRenameVariationError] = useState("");

  // Delete variation state
  const [deleteVariationDialogOpen, setDeleteVariationDialogOpen] = useState(false);
  const [deleteVariationId, setDeleteVariationId] = useState<number | null>(null);

  // Export loading state
  const [isExporting, setIsExporting] = useState(false);

  const hasDraftChanges = Object.keys(draftChanges).length > 0;

  // Auto-calculate calories helper
  const calcCalories = (pro: string, carb: string, fat: string) => {
    const p = parseFloat(pro) || 0;
    const c = parseFloat(carb) || 0;
    const f = parseFloat(fat) || 0;
    return Math.round((p * 4 + c * 4 + f * 9) * 100) / 100;
  };

  // Computed calories for new plan
  const newPlanCalories = useMemo(() => {
    if (usePerKg && latestWeight) {
      const p = (parseFloat(newPlanPerKg.protein) || 0) * latestWeight;
      const c = (parseFloat(newPlanPerKg.carbs) || 0) * latestWeight;
      const f = (parseFloat(newPlanPerKg.fat) || 0) * latestWeight;
      return Math.round((p * 4 + c * 4 + f * 9) * 100) / 100;
    }
    return calcCalories(newPlan.protein, newPlan.carbs, newPlan.fat);
  }, [usePerKg, newPlan, newPlanPerKg, latestWeight]);

  // Computed calories for edit targets
  const editCalories = useMemo(() => {
    if (editUsePerKg && latestWeight) {
      const p = (parseFloat(editTargetsPerKg.protein) || 0) * latestWeight;
      const c = (parseFloat(editTargetsPerKg.carbs) || 0) * latestWeight;
      const f = (parseFloat(editTargetsPerKg.fat) || 0) * latestWeight;
      return Math.round((p * 4 + c * 4 + f * 9) * 100) / 100;
    }
    return calcCalories(editTargets.protein, editTargets.carbs, editTargets.fat);
  }, [editUsePerKg, editTargets, editTargetsPerKg, latestWeight]);

  // Get sorted variations
  const sortedVariations = useMemo(() => {
    if (!plan?.variations) return [];
    return [...plan.variations].sort((a, b) => a.order_index - b.order_index);
  }, [plan]);

  // Get active variation
  const activeVariation = useMemo(() => {
    if (!sortedVariations.length) return null;
    const found = sortedVariations.find((v) => String(v.id) === activeVariationTab);
    return found ?? sortedVariations[0];
  }, [sortedVariations, activeVariationTab]);

  // Handle local quantity change
  const handleQuantityChange = useCallback((itemId: number, newQty: number) => {
    setDraftChanges((prev) => {
      const updated = { ...prev };
      const currentVariation = activeVariation;
      if (currentVariation) {
        for (const meal of currentVariation.meals) {
          const item = meal.items.find((i) => i.id === itemId);
          if (item) {
            if (item.quantity_grams === newQty) {
              delete updated[itemId];
            } else {
              updated[itemId] = newQty;
            }
            break;
          }
        }
      }
      return updated;
    });
  }, [activeVariation]);

  // Calculate totals from current state (including drafts) for active variation
  const draftTotals = useMemo(() => {
    if (!activeVariation) return { calories: 0, protein: 0, carbs: 0, fat: 0 };

    let totalCal = 0, totalPro = 0, totalCarb = 0, totalFat = 0;

    for (const meal of activeVariation.meals) {
      for (const item of meal.items) {
        const qty = draftChanges[item.id] ?? item.quantity_grams;
        const ratio = item.quantity_grams > 0 ? qty / item.quantity_grams : 0;
        totalCal += item.calculated_calories * ratio;
        totalPro += item.calculated_protein * ratio;
        totalCarb += item.calculated_carbs * ratio;
        totalFat += item.calculated_fat * ratio;
      }
    }

    return {
      calories: Math.round(totalCal * 100) / 100,
      protein: Math.round(totalPro * 100) / 100,
      carbs: Math.round(totalCarb * 100) / 100,
      fat: Math.round(totalFat * 100) / 100,
    };
  }, [activeVariation, draftChanges]);

  // Save all draft changes
  const handleSaveDraft = async () => {
    if (!hasDraftChanges) return;
    setIsSaving(true);

    try {
      const promises = Object.entries(draftChanges).map(([itemId, qty]) =>
        updateMealItem.mutateAsync({ itemId: parseInt(itemId), quantity_grams: qty })
      );
      await Promise.all(promises);
      toast({ title: "Salvo!", description: "Quantidades atualizadas com sucesso." });
      setDraftChanges({});
    } catch {
      toast({ title: "Erro", description: "Não foi possível salvar as alterações.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  // Discard draft
  const handleDiscardDraft = () => {
    setDraftChanges({});
  };

  const handleAddMeal = () => {
    if (!activeVariation) return;
    if (!newMealName.trim()) {
      setNewMealNameError("Informe o nome da refeição.");
      return;
    }
    const nextOrder = activeVariation.meals.length;
    addMealToVariation.mutate(
      { variationId: activeVariation.id, meal: { name: newMealName.trim(), order_index: nextOrder } },
      {
        onSuccess: () => {
          toast({ title: "Refeição adicionada!", description: `${newMealName} foi criada.` });
          setNewMealName("");
          setNewMealNameError("");
          setMealDialogOpen(false);
        },
      }
    );
  };

  const resolveAbsoluteValues = (mode: "create" | "edit") => {
    if (mode === "create") {
      if (usePerKg && latestWeight) {
        return {
          protein: Math.round((parseFloat(newPlanPerKg.protein) || 0) * latestWeight * 10) / 10,
          carbs: Math.round((parseFloat(newPlanPerKg.carbs) || 0) * latestWeight * 10) / 10,
          fat: Math.round((parseFloat(newPlanPerKg.fat) || 0) * latestWeight * 10) / 10,
        };
      }
      return {
        protein: parseFloat(newPlan.protein) || 0,
        carbs: parseFloat(newPlan.carbs) || 0,
        fat: parseFloat(newPlan.fat) || 0,
      };
    }
    // edit mode
    if (editUsePerKg && latestWeight) {
      return {
        protein: Math.round((parseFloat(editTargetsPerKg.protein) || 0) * latestWeight * 10) / 10,
        carbs: Math.round((parseFloat(editTargetsPerKg.carbs) || 0) * latestWeight * 10) / 10,
        fat: Math.round((parseFloat(editTargetsPerKg.fat) || 0) * latestWeight * 10) / 10,
      };
    }
    return {
      protein: parseFloat(editTargets.protein) || 0,
      carbs: parseFloat(editTargets.carbs) || 0,
      fat: parseFloat(editTargets.fat) || 0,
    };
  };

  const handleCreatePlan = () => {
    const values = usePerKg ? newPlanPerKg : newPlan;
    const validation = validateMacroValues(values);
    setNewPlanErrors(validation.errors);
    setNewPlanFormError(validation.formError);

    if (Object.keys(validation.errors).length > 0 || validation.formError) {
      toast({ title: "Revise as metas", description: "Corrija os campos destacados antes de criar o plano.", variant: "destructive" });
      return;
    }

    const abs = resolveAbsoluteValues("create");
    const cal = calcCalories(String(abs.protein), String(abs.carbs), String(abs.fat));

    createPlan.mutate(
      {
        user_id: "default_user",
        target_calories: cal,
        target_protein: abs.protein,
        target_carbs: abs.carbs,
        target_fat: abs.fat,
        is_active: true,
      },
      {
        onSuccess: () => {
          toast({ title: "Plano criado!", description: "Seu novo plano alimentar está ativo." });
          setCreatePlanOpen(false);
          setNewPlan({ protein: "", carbs: "", fat: "" });
          setNewPlanPerKg({ protein: "", carbs: "", fat: "" });
          setNewPlanErrors({});
          setNewPlanFormError("");
          setUsePerKg(false);
        },
        onError: () => {
          toast({ title: "Erro", description: "Não foi possível criar o plano.", variant: "destructive" });
        },
      }
    );
  };

  const openEditTargets = () => {
    if (!plan) return;
    setEditTargets({
      protein: String(plan.target_protein),
      carbs: String(plan.target_carbs),
      fat: String(plan.target_fat),
    });
    if (latestWeight && latestWeight > 0) {
      setEditTargetsPerKg({
        protein: (plan.target_protein / latestWeight).toFixed(2),
        carbs: (plan.target_carbs / latestWeight).toFixed(2),
        fat: (plan.target_fat / latestWeight).toFixed(2),
      });
    }
    setEditUsePerKg(false);
    setEditTargetsErrors({});
    setEditTargetsFormError("");
    setEditTargetsOpen(true);
  };

  const handleSaveTargets = () => {
    if (!plan) return;
    const values = editUsePerKg ? editTargetsPerKg : editTargets;
    const validation = validateMacroValues(values);
    setEditTargetsErrors(validation.errors);
    setEditTargetsFormError(validation.formError);

    if (Object.keys(validation.errors).length > 0 || validation.formError) {
      toast({ title: "Revise as metas", description: "Corrija os campos destacados antes de salvar.", variant: "destructive" });
      return;
    }

    const abs = resolveAbsoluteValues("edit");
    const cal = calcCalories(String(abs.protein), String(abs.carbs), String(abs.fat));

    updateTargets.mutate(
      {
        planId: plan.id,
        targets: {
          target_calories: cal,
          target_protein: abs.protein,
          target_carbs: abs.carbs,
          target_fat: abs.fat,
        },
      },
      {
        onSuccess: () => {
          toast({ title: "Metas atualizadas!", description: "As metas do plano foram salvas." });
          setEditTargetsErrors({});
          setEditTargetsFormError("");
          setEditTargetsOpen(false);
        },
        onError: () => {
          toast({ title: "Erro", description: "Não foi possível atualizar as metas.", variant: "destructive" });
        },
      }
    );
  };

  // Variation handlers
  const handleCreateVariation = () => {
    if (!plan) return;
    const nameError = newVariationName.trim() ? "" : "Informe o nome da variação.";
    const sourceError = newVariationMode === "duplicate" && duplicateSourceId == null
      ? "Escolha uma variação para duplicar."
      : "";
    setNewVariationNameError(nameError);
    setNewVariationSourceError(sourceError);
    if (nameError || sourceError) {
      toast({ title: "Revise a variação", description: "Corrija os campos destacados antes de continuar.", variant: "destructive" });
      return;
    }
    const nextOrder = sortedVariations.length;

    createVariation.mutate(
      {
        planId: plan.id,
        variation: { name: newVariationName.trim(), order_index: nextOrder },
        duplicateFrom: newVariationMode === "duplicate" && duplicateSourceId != null ? duplicateSourceId : undefined,
      },
      {
        onSuccess: (data) => {
          toast({
            title: "Variação criada!",
            description: `"${newVariationName}" foi ${newVariationMode === "duplicate" ? "duplicada" : "criada"}.`,
          });
          setNewVariationDialogOpen(false);
          setNewVariationName("");
          setNewVariationNameError("");
          setNewVariationSourceError("");
          setNewVariationMode("empty");
          setDuplicateSourceId(null);
          // Switch to new variation tab
          setActiveVariationTab(String(data.id));
        },
        onError: () => {
          toast({ title: "Erro", description: "Não foi possível criar a variação.", variant: "destructive" });
        },
      }
    );
  };

  const handleRenameVariation = () => {
    if (!renameVariationId) return;
    if (!renameVariationValue.trim()) {
      setRenameVariationError("Informe o nome da variação.");
      return;
    }
    renameVariation.mutate(
      { variationId: renameVariationId, name: renameVariationValue.trim() },
      {
        onSuccess: () => {
          toast({ title: "Renomeado!", description: `Variação renomeada para "${renameVariationValue}".` });
          setRenameVariationDialogOpen(false);
          setRenameVariationId(null);
          setRenameVariationValue("");
          setRenameVariationError("");
        },
        onError: () => {
          toast({ title: "Erro", description: "Não foi possível renomear.", variant: "destructive" });
        },
      }
    );
  };

  const handleDeleteVariation = () => {
    if (!deleteVariationId) return;
    deleteVariation.mutate(deleteVariationId, {
      onSuccess: () => {
        toast({ title: "Variação excluída!", description: "A variação e suas refeições foram removidas." });
        setDeleteVariationDialogOpen(false);
        setDeleteVariationId(null);
        // Reset tab if current was deleted
        if (String(deleteVariationId) === activeVariationTab) {
          setActiveVariationTab("");
        }
      },
      onError: (error) => {
        const msg = error.message.includes("only remaining")
          ? "Não é possível excluir a única variação do plano."
          : "Não foi possível excluir a variação.";
        toast({ title: "Erro", description: msg, variant: "destructive" });
      },
    });
  };

  const handleExportExcel = async () => {
    setIsExporting(true);
    try {
      await exportExcel();
      toast({ title: "Exportado!", description: "Arquivo Excel baixado com sucesso." });
    } catch {
      toast({ title: "Erro", description: "Não foi possível exportar o Excel.", variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportPdf = async () => {
    setIsExporting(true);
    try {
      await exportPdf();
      toast({ title: "Exportado!", description: "Arquivo PDF baixado com sucesso." });
    } catch {
      toast({ title: "Erro", description: "Não foi possível exportar o PDF.", variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  };

  // Shared macro form component
  const MacroFormFields = ({
    mode,
    isPerKg,
    setIsPerKg,
    absolute,
    setAbsolute,
    perKg,
    setPerKg,
    computedCal,
    errors,
    formError,
    onClearError,
  }: {
    mode: string;
    isPerKg: boolean;
    setIsPerKg: (v: boolean) => void;
    absolute: MacroValues;
    setAbsolute: (v: MacroValues) => void;
    perKg: MacroValues;
    setPerKg: (v: MacroValues) => void;
    computedCal: number;
    errors: MacroFieldErrors;
    formError: string;
    onClearError: (field: keyof MacroValues) => void;
  }) => (
    <div className="space-y-4">
      {/* Toggle g/kg */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setIsPerKg(false)}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            !isPerKg
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-accent"
          }`}
        >
          Gramas totais
        </button>
        <button
          type="button"
          onClick={() => {
            if (!latestWeight) {
              toast({
                title: "Peso não registrado",
                description: "Registre seu peso na seção Body Log antes de usar g/kg.",
                variant: "destructive",
              });
              return;
            }
            setIsPerKg(true);
          }}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            isPerKg
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-accent"
          }`}
        >
          g/kg de peso
        </button>
        {isPerKg && latestWeight && (
          <span className="text-xs text-muted-foreground">
            ({latestWeight.toFixed(1)} kg)
          </span>
        )}
      </div>

      {!latestWeight && isPerKg && (
        <div className="flex items-center gap-2 rounded-lg border border-yellow-500/30 bg-yellow-950/20 p-2.5">
          <AlertTriangle className="h-4 w-4 text-yellow-500 shrink-0" />
          <p className="text-xs text-yellow-300">
            Nenhum peso registrado. Por favor, registre seu peso primeiro.
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        {!isPerKg ? (
          <>
            <div className="space-y-2">
              <Label htmlFor={`${mode}-protein`}>Proteína total (g)</Label>
              <Input
                id={`${mode}-protein`}
                type="number"
                min="0"
                step="1"
                inputMode="decimal"
                value={absolute.protein}
                onChange={(e) => {
                  setAbsolute({ ...absolute, protein: e.target.value });
                  onClearError("protein");
                }}
                placeholder="Ex: 180"
                aria-invalid={Boolean(errors.protein)}
                aria-describedby={errors.protein ? `${mode}-protein-error` : undefined}
              />
              {errors.protein && <p id={`${mode}-protein-error`} className="text-xs text-destructive">{errors.protein}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${mode}-carbs`}>Carboidratos totais (g)</Label>
              <Input
                id={`${mode}-carbs`}
                type="number"
                min="0"
                step="1"
                inputMode="decimal"
                value={absolute.carbs}
                onChange={(e) => {
                  setAbsolute({ ...absolute, carbs: e.target.value });
                  onClearError("carbs");
                }}
                placeholder="Ex: 300"
                aria-invalid={Boolean(errors.carbs)}
                aria-describedby={errors.carbs ? `${mode}-carbs-error` : undefined}
              />
              {errors.carbs && <p id={`${mode}-carbs-error`} className="text-xs text-destructive">{errors.carbs}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${mode}-fat`}>Gordura total (g)</Label>
              <Input
                id={`${mode}-fat`}
                type="number"
                min="0"
                step="1"
                inputMode="decimal"
                value={absolute.fat}
                onChange={(e) => {
                  setAbsolute({ ...absolute, fat: e.target.value });
                  onClearError("fat");
                }}
                placeholder="Ex: 80"
                aria-invalid={Boolean(errors.fat)}
                aria-describedby={errors.fat ? `${mode}-fat-error` : undefined}
              />
              {errors.fat && <p id={`${mode}-fat-error`} className="text-xs text-destructive">{errors.fat}</p>}
            </div>
          </>
        ) : (
          <>
            <div className="space-y-2">
              <Label htmlFor={`${mode}-protein-per-kg`}>Proteína por kg (g/kg)</Label>
              <Input
                id={`${mode}-protein-per-kg`}
                type="number"
                min="0"
                step="0.1"
                inputMode="decimal"
                value={perKg.protein}
                onChange={(e) => {
                  setPerKg({ ...perKg, protein: e.target.value });
                  onClearError("protein");
                }}
                placeholder="Ex: 2,0"
                aria-invalid={Boolean(errors.protein)}
                aria-describedby={errors.protein ? `${mode}-protein-per-kg-error` : undefined}
              />
              {errors.protein && <p id={`${mode}-protein-per-kg-error`} className="text-xs text-destructive">{errors.protein}</p>}
              {latestWeight && perKg.protein && (
                <p className="text-xs text-muted-foreground">
                  = {((parseFloat(perKg.protein) || 0) * latestWeight).toFixed(0)}g
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${mode}-carbs-per-kg`}>Carboidratos por kg (g/kg)</Label>
              <Input
                id={`${mode}-carbs-per-kg`}
                type="number"
                min="0"
                step="0.1"
                inputMode="decimal"
                value={perKg.carbs}
                onChange={(e) => {
                  setPerKg({ ...perKg, carbs: e.target.value });
                  onClearError("carbs");
                }}
                placeholder="Ex: 4,0"
                aria-invalid={Boolean(errors.carbs)}
                aria-describedby={errors.carbs ? `${mode}-carbs-per-kg-error` : undefined}
              />
              {errors.carbs && <p id={`${mode}-carbs-per-kg-error`} className="text-xs text-destructive">{errors.carbs}</p>}
              {latestWeight && perKg.carbs && (
                <p className="text-xs text-muted-foreground">
                  = {((parseFloat(perKg.carbs) || 0) * latestWeight).toFixed(0)}g
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${mode}-fat-per-kg`}>Gordura por kg (g/kg)</Label>
              <Input
                id={`${mode}-fat-per-kg`}
                type="number"
                min="0"
                step="0.1"
                inputMode="decimal"
                value={perKg.fat}
                onChange={(e) => {
                  setPerKg({ ...perKg, fat: e.target.value });
                  onClearError("fat");
                }}
                placeholder="Ex: 1,0"
                aria-invalid={Boolean(errors.fat)}
                aria-describedby={errors.fat ? `${mode}-fat-per-kg-error` : undefined}
              />
              {errors.fat && <p id={`${mode}-fat-per-kg-error`} className="text-xs text-destructive">{errors.fat}</p>}
              {latestWeight && perKg.fat && (
                <p className="text-xs text-muted-foreground">
                  = {((parseFloat(perKg.fat) || 0) * latestWeight).toFixed(0)}g
                </p>
              )}
            </div>
          </>
        )}

        {/* Auto-calculated calories */}
        <div className="space-y-2">
          <Label className="text-muted-foreground">Calorias (auto)</Label>
          <div className="flex h-9 w-full items-center rounded-md border bg-muted/50 px-3 text-sm text-muted-foreground">
            {computedCal > 0 ? `${computedCal} kcal` : "-"}
          </div>
        </div>
      </div>
      {formError && <p className="text-xs text-destructive">{formError}</p>}
    </div>
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-pulse text-muted-foreground">Carregando plano alimentar...</div>
      </div>
    );
  }

  if (isError || !plan) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Utensils className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Plano Alimentar</h1>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground mb-4">Nenhum plano alimentar ativo encontrado.</p>
            <Button onClick={() => setCreatePlanOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Criar Plano
            </Button>
          </CardContent>
        </Card>

        <Dialog
          open={createPlanOpen}
          onOpenChange={(open) => {
            setCreatePlanOpen(open);
            if (!open) {
              setNewPlanErrors({});
              setNewPlanFormError("");
            }
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Criar Plano Alimentar</DialogTitle>
              <DialogDescription>
                Defina as metas diárias de macronutrientes. As calorias são calculadas automaticamente.
              </DialogDescription>
            </DialogHeader>
            <MacroFormFields
              mode="create"
              isPerKg={usePerKg}
              setIsPerKg={setUsePerKg}
              absolute={newPlan}
              setAbsolute={setNewPlan}
              perKg={newPlanPerKg}
              setPerKg={setNewPlanPerKg}
              computedCal={newPlanCalories}
              errors={newPlanErrors}
              formError={newPlanFormError}
              onClearError={(field) => {
                setNewPlanErrors((prev) => ({ ...prev, [field]: undefined }));
                setNewPlanFormError("");
              }}
            />
            <Button onClick={handleCreatePlan} className="w-full" disabled={createPlan.isPending}>
              {createPlan.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Criar Plano
            </Button>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // Use draft totals if there are changes, otherwise use active variation totals
  const displayTotals = hasDraftChanges
    ? draftTotals
    : activeVariation
      ? {
          calories: activeVariation.total_calories,
          protein: activeVariation.total_protein,
          carbs: activeVariation.total_carbs,
          fat: activeVariation.total_fat,
        }
      : {
          calories: plan.total_calories,
          protein: plan.total_protein,
          carbs: plan.total_carbs,
          fat: plan.total_fat,
        };

  const currentMeals = activeVariation
    ? [...activeVariation.meals].sort((a, b) => a.order_index - b.order_index)
    : [];

  const effectiveTab = activeVariationTab || (sortedVariations[0] ? String(sortedVariations[0].id) : "");

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Utensils className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Plano Alimentar</h1>
        </div>
        <div className="flex items-center gap-2">
          {/* Export dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" disabled={isExporting}>
                {isExporting ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <Download className="h-4 w-4 mr-1" />
                )}
                Exportar
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleExportExcel}>
                <FileSpreadsheet className="h-4 w-4" />
                Exportar Excel (.xlsx)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportPdf}>
                <FileText className="h-4 w-4" />
                Exportar PDF
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button variant="outline" size="sm" onClick={() => setMealDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Nova Refeição
          </Button>
        </div>
      </div>

      {/* Macro targets - with Edit Targets button */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Metas do Dia</CardTitle>
            {latestWeight && (
              <p className="text-xs text-muted-foreground mt-1">
                Baseado em {latestWeight.toFixed(1)} kg
              </p>
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={openEditTargets}>
            <Pencil className="h-3.5 w-3.5 mr-1" />
            Editar Metas
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <MacroProgressBar
            label="Calorias"
            actual={displayTotals.calories}
            target={plan.target_calories}
            unit="kcal"
            colorClass="bg-orange-500"
            perKgActual={latestWeight ? displayTotals.calories / latestWeight : null}
          />
          <MacroProgressBar
            label="Proteína"
            actual={displayTotals.protein}
            target={plan.target_protein}
            unit="g"
            colorClass="bg-red-500"
            perKgActual={latestWeight ? displayTotals.protein / latestWeight : null}
          />
          <MacroProgressBar
            label="Carboidratos"
            actual={displayTotals.carbs}
            target={plan.target_carbs}
            unit="g"
            colorClass="bg-blue-500"
            perKgActual={latestWeight ? displayTotals.carbs / latestWeight : null}
          />
          <MacroProgressBar
            label="Gordura"
            actual={displayTotals.fat}
            target={plan.target_fat}
            unit="g"
            colorClass="bg-yellow-500"
            perKgActual={latestWeight ? displayTotals.fat / latestWeight : null}
          />
        </CardContent>
      </Card>

      {/* Variations Tabs */}
      {sortedVariations.length > 0 && (
        <Tabs value={effectiveTab} onValueChange={setActiveVariationTab}>
          <div className="flex items-center gap-2">
            <TabsList className="flex-1 justify-start overflow-x-auto">
              {sortedVariations.map((v) => (
                <TabsTrigger
                  key={v.id}
                  value={String(v.id)}
                  className="relative group min-w-fit"
                >
                  <span>{v.name}</span>
                  {/* Context menu button inside tab */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        className="ml-1.5 opacity-0 group-hover:opacity-100 group-data-[state=active]:opacity-60 hover:opacity-100! transition-opacity p-0.5 rounded hover:bg-accent"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreVertical className="h-3 w-3" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          setRenameVariationId(v.id);
                          setRenameVariationValue(v.name);
                          setRenameVariationDialogOpen(true);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                        Renomear
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          setNewVariationMode("duplicate");
                          setDuplicateSourceId(v.id);
                          setNewVariationName(`${v.name} (cópia)`);
                          setNewVariationDialogOpen(true);
                        }}
                      >
                        <Copy className="h-4 w-4" />
                        Duplicar
                      </DropdownMenuItem>
                      {sortedVariations.length > 1 && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteVariationId(v.id);
                              setDeleteVariationDialogOpen(true);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                            Excluir
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TabsTrigger>
              ))}
            </TabsList>

            {/* Add variation button */}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={() => {
                setNewVariationMode("empty");
                setNewVariationName("");
                setDuplicateSourceId(null);
                setNewVariationDialogOpen(true);
              }}
            >
              <Plus className="h-4 w-4" />
              <span className="sr-only">Nova variação</span>
            </Button>
          </div>

          {/* Variation content */}
          {sortedVariations.map((v) => {
            const varPro = v.total_protein;
            const varCarb = v.total_carbs;
            const varFat = v.total_fat;

            return (
              <TabsContent key={v.id} value={String(v.id)}>
                <div className="space-y-5">
                  {/* Variation g/kg summary */}
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-1 rounded-lg border bg-muted/40 px-4 py-2.5 text-sm">
                    <span className="font-medium text-muted-foreground mr-1">g/kg:</span>
                    <span className="tabular-nums">
                      <span className="text-red-500 font-medium">P</span>{" "}
                      {latestWeight ? `${(varPro / latestWeight).toFixed(1)}` : "–"}
                    </span>
                    <span className="tabular-nums">
                      <span className="text-blue-500 font-medium">C</span>{" "}
                      {latestWeight ? `${(varCarb / latestWeight).toFixed(1)}` : "–"}
                    </span>
                    <span className="tabular-nums">
                      <span className="text-yellow-500 font-medium">G</span>{" "}
                      {latestWeight ? `${(varFat / latestWeight).toFixed(1)}` : "–"}
                    </span>
                    {latestWeight && (
                      <span className="text-xs text-muted-foreground ml-auto">
                        ({latestWeight.toFixed(1)} kg)
                      </span>
                    )}
                  </div>

                  {[...v.meals]
                    .sort((a, b) => a.order_index - b.order_index)
                    .map((meal) => (
                      <MealCard
                        key={meal.id}
                        meal={meal}
                        draftChanges={draftChanges}
                        onQuantityChange={handleQuantityChange}
                      />
                    ))}

                  {v.meals.length === 0 && (
                    <Card>
                      <CardContent className="flex flex-col items-center justify-center py-12">
                        <p className="text-muted-foreground mb-4">Nenhuma refeição nesta variação.</p>
                        <Button variant="outline" onClick={() => setMealDialogOpen(true)}>
                          <Plus className="h-4 w-4 mr-2" />
                          Adicionar Refeição
                        </Button>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </TabsContent>
            );
          })}
        </Tabs>
      )}

      {/* Fallback: show meals without tabs if no variations */}
      {sortedVariations.length === 0 && (
        <div className="space-y-5">
          {[...plan.meals]
            .sort((a, b) => a.order_index - b.order_index)
            .map((meal) => (
              <MealCard
                key={meal.id}
                meal={meal}
                draftChanges={draftChanges}
                onQuantityChange={handleQuantityChange}
              />
            ))}
        </div>
      )}

      {/* Floating Action Bar for pending changes */}
      {hasDraftChanges && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-2xl border border-primary/40 bg-card/95 backdrop-blur-sm px-5 py-3 shadow-2xl">
          <p className="text-sm font-medium text-primary mr-2">
            Alterações pendentes
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDiscardDraft}
            className="gap-1.5"
          >
            Cancelar
          </Button>
          <Button
            size="sm"
            onClick={handleSaveDraft}
            disabled={isSaving}
            className="gap-1.5"
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : null}
            Salvar
          </Button>
        </div>
      )}

      {/* Add meal dialog */}
      <Dialog
        open={mealDialogOpen}
        onOpenChange={(open) => {
          setMealDialogOpen(open);
          if (!open) setNewMealNameError("");
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Nova Refeição</DialogTitle>
            <DialogDescription>
              Adicione uma nova refeição{activeVariation ? ` à variação "${activeVariation.name}"` : " ao plano"}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome da Refeição</Label>
              <Input
                placeholder="Ex: Café da Manhã, Almoço, Lanche..."
                value={newMealName}
                onChange={(e) => {
                  setNewMealName(e.target.value);
                  setNewMealNameError("");
                }}
                aria-invalid={Boolean(newMealNameError)}
                aria-describedby={newMealNameError ? "new-meal-name-error" : undefined}
              />
              {newMealNameError && <p id="new-meal-name-error" className="text-xs text-destructive">{newMealNameError}</p>}
            </div>
            <Button onClick={handleAddMeal} className="w-full" disabled={addMealToVariation.isPending}>
              {addMealToVariation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Criar Refeição
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Targets dialog */}
      <Dialog
        open={editTargetsOpen}
        onOpenChange={(open) => {
          setEditTargetsOpen(open);
          if (!open) {
            setEditTargetsErrors({});
            setEditTargetsFormError("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Metas</DialogTitle>
            <DialogDescription>
              Atualize as metas diárias de macronutrientes. As calorias são calculadas automaticamente.
            </DialogDescription>
          </DialogHeader>
          <MacroFormFields
            mode="edit"
            isPerKg={editUsePerKg}
            setIsPerKg={setEditUsePerKg}
            absolute={editTargets}
            setAbsolute={setEditTargets}
            perKg={editTargetsPerKg}
            setPerKg={setEditTargetsPerKg}
            computedCal={editCalories}
            errors={editTargetsErrors}
            formError={editTargetsFormError}
            onClearError={(field) => {
              setEditTargetsErrors((prev) => ({ ...prev, [field]: undefined }));
              setEditTargetsFormError("");
            }}
          />
          <Button onClick={handleSaveTargets} className="w-full" disabled={updateTargets.isPending}>
            {updateTargets.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Salvar Metas
          </Button>
        </DialogContent>
      </Dialog>

      {/* Create Variation dialog */}
      <Dialog
        open={newVariationDialogOpen}
        onOpenChange={(open) => {
          setNewVariationDialogOpen(open);
          if (!open) {
            setNewVariationNameError("");
            setNewVariationSourceError("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {newVariationMode === "duplicate" ? "Duplicar Variação" : "Nova Variação"}
            </DialogTitle>
            <DialogDescription>
              {newVariationMode === "duplicate"
                ? "Crie uma cópia da variação com todas as refeições e alimentos."
                : "Crie uma nova variação do zero ou a partir de uma existente."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Mode selection (only when opening from + button, not from duplicate) */}
            {duplicateSourceId == null && (
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setNewVariationMode("empty");
                    setNewVariationSourceError("");
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    newVariationMode === "empty"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-accent"
                  }`}
                >
                  Criar do zero
                </button>
                <button
                  type="button"
                  onClick={() => setNewVariationMode("duplicate")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    newVariationMode === "duplicate"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-accent"
                  }`}
                >
                  Duplicar existente
                </button>
              </div>
            )}

            <div className="space-y-2">
              <Label>Nome da Variação</Label>
              <Input
                placeholder="Ex: Substituição, Dia de folga..."
                value={newVariationName}
                onChange={(e) => {
                  setNewVariationName(e.target.value);
                  setNewVariationNameError("");
                }}
                aria-invalid={Boolean(newVariationNameError)}
                aria-describedby={newVariationNameError ? "new-variation-name-error" : undefined}
              />
              {newVariationNameError && <p id="new-variation-name-error" className="text-xs text-destructive">{newVariationNameError}</p>}
            </div>

            {/* Source selection for duplicate mode */}
            {newVariationMode === "duplicate" && duplicateSourceId == null && sortedVariations.length > 0 && (
              <div className="space-y-2">
                <Label>Duplicar a partir de</Label>
                <div className="grid gap-2">
                  {sortedVariations.map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => {
                        setDuplicateSourceId(v.id);
                        setNewVariationSourceError("");
                      }}
                      className={`flex items-center justify-between px-3 py-2 rounded-lg border text-sm transition-colors ${
                        duplicateSourceId === v.id
                          ? "border-primary bg-primary/5 text-foreground"
                          : "border-border hover:bg-accent text-muted-foreground"
                      }`}
                    >
                      <span className="font-medium">{v.name}</span>
                      <span className="text-xs">{v.meals.length} refeições</span>
                    </button>
                  ))}
                </div>
                {newVariationSourceError && <p className="text-xs text-destructive">{newVariationSourceError}</p>}
              </div>
            )}

            <Button
              onClick={handleCreateVariation}
              className="w-full"
              disabled={
                createVariation.isPending
              }
            >
              {createVariation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {newVariationMode === "duplicate" ? (
                <>
                  <Copy className="h-4 w-4 mr-2" />
                  Duplicar Variação
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Criar Variação
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Rename Variation dialog */}
      <Dialog
        open={renameVariationDialogOpen}
        onOpenChange={(open) => {
          setRenameVariationDialogOpen(open);
          if (!open) setRenameVariationError("");
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Renomear Variação</DialogTitle>
            <DialogDescription>Digite o novo nome para a variação.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input
                value={renameVariationValue}
                onChange={(e) => {
                  setRenameVariationValue(e.target.value);
                  setRenameVariationError("");
                }}
                placeholder="Nome da variação"
                aria-invalid={Boolean(renameVariationError)}
                aria-describedby={renameVariationError ? "rename-variation-error" : undefined}
              />
              {renameVariationError && <p id="rename-variation-error" className="text-xs text-destructive">{renameVariationError}</p>}
            </div>
            <Button
              onClick={handleRenameVariation}
              className="w-full"
              disabled={renameVariation.isPending}
            >
              {renameVariation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Salvar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Variation dialog */}
      <AlertDialog open={deleteVariationDialogOpen} onOpenChange={setDeleteVariationDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir variação</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta variação? Todas as refeições e alimentos serão perdidos. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteVariation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteVariation}
              disabled={deleteVariation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteVariation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Excluindo...
                </>
              ) : (
                "Excluir"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
