import { useState, useMemo } from "react";
import { Search, Plus, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useFoods, useCreateFood } from "@/hooks/use-foods";
import { useAddMealItem } from "@/hooks/use-diet";
import { toast } from "@/hooks/use-toast";
import type { FoodItemResponse } from "@/lib/types";

const emptyFoodForm = { name: "", brand: "", protein: "", carbs: "", fat: "" };

interface AddFoodModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mealId: number;
}

export function AddFoodModal({ open, onOpenChange, mealId }: AddFoodModalProps) {
  const [search, setSearch] = useState("");
  const [selectedFood, setSelectedFood] = useState<FoodItemResponse | null>(null);
  const [grams, setGrams] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [foodForm, setFoodForm] = useState(emptyFoodForm);
  const [createAttempted, setCreateAttempted] = useState(false);
  const [addAttempted, setAddAttempted] = useState(false);

  const { data: foods, isLoading } = useFoods(search, 0, 20);
  const addItem = useAddMealItem();
  const createFood = useCreateFood();

  // Auto-calculate calories from macros
  const computedCalories = useMemo(() => {
    const pro = parseFloat(foodForm.protein) || 0;
    const carb = parseFloat(foodForm.carbs) || 0;
    const fat = parseFloat(foodForm.fat) || 0;
    return Math.round((pro * 4 + carb * 4 + fat * 9) * 100) / 100;
  }, [foodForm.protein, foodForm.carbs, foodForm.fat]);

  const foodFormErrors = useMemo(() => {
    const invalidMacro = (value: string) =>
      value.trim() === "" || isNaN(parseFloat(value)) || parseFloat(value) < 0;

    return {
      name: !foodForm.name.trim() ? "Nome é obrigatório." : "",
      protein: invalidMacro(foodForm.protein) ? "Informe a proteína em gramas." : "",
      carbs: invalidMacro(foodForm.carbs) ? "Informe os carboidratos em gramas." : "",
      fat: invalidMacro(foodForm.fat) ? "Informe a gordura em gramas." : "",
    };
  }, [foodForm]);

  const gramsValue = parseFloat(grams);
  const gramsError = (addAttempted || grams.trim() !== "") && (!grams.trim() || isNaN(gramsValue) || gramsValue <= 0)
    ? "Informe uma quantidade maior que zero."
    : "";

  const resetCreateForm = () => {
    setShowCreateForm(false);
    setFoodForm(emptyFoodForm);
    setCreateAttempted(false);
  };

  const handleCreateInline = () => {
    setCreateAttempted(true);
    const pro = parseFloat(foodForm.protein);
    const carb = parseFloat(foodForm.carbs);
    const fat = parseFloat(foodForm.fat);

    if (!foodForm.name.trim() || [pro, carb, fat].some((v) => isNaN(v) || v < 0)) {
      toast({ title: "Erro", description: "Preencha todos os campos corretamente.", variant: "destructive" });
      return;
    }

    createFood.mutate(
      {
        name: foodForm.name.trim(),
        calories_kcal: computedCalories,
        protein_g: pro,
        carbs_g: carb,
        fat_g: fat,
        brand: foodForm.brand.trim() || undefined,
      },
      {
        onSuccess: (result) => {
          toast({ title: "Alimento criado!", description: `${result.name} adicionado.` });
          setSelectedFood(result);
          resetCreateForm();
        },
        onError: () => {
          toast({ title: "Erro", description: "Não foi possível criar o alimento.", variant: "destructive" });
        },
      }
    );
  };

  const handleAdd = () => {
    setAddAttempted(true);
    if (!selectedFood || !grams.trim() || isNaN(gramsValue) || gramsValue <= 0) return;

    addItem.mutate(
      {
        mealId,
        item: {
          food_item_id: selectedFood.id,
          quantity_grams: gramsValue,
        },
      },
      {
        onSuccess: () => {
          toast({
            title: "Alimento adicionado!",
            description: `${selectedFood.name} (${grams}g) foi adicionado à refeição.`,
          });
          setSelectedFood(null);
          setGrams("");
          setAddAttempted(false);
          setSearch("");
          onOpenChange(false);
        },
        onError: () => {
          toast({
            title: "Erro",
            description: "Não foi possível adicionar o alimento.",
            variant: "destructive",
          });
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Adicionar Alimento</DialogTitle>
          <DialogDescription>
            Busque um alimento e defina a quantidade em gramas.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search */}
          {!showCreateForm && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar alimento..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setSelectedFood(null);
                }}
                className="pl-10"
              />
            </div>
          )}

          {/* Inline create food form */}
          {showCreateForm && !selectedFood && (
            <div className="rounded-xl border p-3 space-y-3">
              <p className="text-sm font-medium">Criar novo alimento (valores por 100g)</p>
              <div className="space-y-2">
                <div className="space-y-1.5">
                  <Label htmlFor="inline-food-name">Nome</Label>
                  <Input
                    id="inline-food-name"
                    placeholder="Ex: Peito de frango"
                    value={foodForm.name}
                    onChange={(e) => setFoodForm({ ...foodForm, name: e.target.value })}
                    aria-invalid={createAttempted && !!foodFormErrors.name}
                  />
                  {createAttempted && foodFormErrors.name && (
                    <p className="text-xs text-destructive">{foodFormErrors.name}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="inline-food-brand">Marca (opcional)</Label>
                  <Input
                    id="inline-food-brand"
                    placeholder="Ex: Sadia"
                    value={foodForm.brand}
                    onChange={(e) => setFoodForm({ ...foodForm, brand: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label htmlFor="inline-food-protein">Proteína (g)</Label>
                  <Input
                    id="inline-food-protein"
                    type="number"
                    min="0"
                    step="0.1"
                    inputMode="decimal"
                    placeholder="31"
                    value={foodForm.protein}
                    onChange={(e) => setFoodForm({ ...foodForm, protein: e.target.value })}
                    aria-invalid={createAttempted && !!foodFormErrors.protein}
                  />
                  {createAttempted && foodFormErrors.protein && (
                    <p className="text-xs text-destructive">{foodFormErrors.protein}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="inline-food-carbs">Carboidratos (g)</Label>
                  <Input
                    id="inline-food-carbs"
                    type="number"
                    min="0"
                    step="0.1"
                    inputMode="decimal"
                    placeholder="0"
                    value={foodForm.carbs}
                    onChange={(e) => setFoodForm({ ...foodForm, carbs: e.target.value })}
                    aria-invalid={createAttempted && !!foodFormErrors.carbs}
                  />
                  {createAttempted && foodFormErrors.carbs && (
                    <p className="text-xs text-destructive">{foodFormErrors.carbs}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="inline-food-fat">Gordura (g)</Label>
                  <Input
                    id="inline-food-fat"
                    type="number"
                    min="0"
                    step="0.1"
                    inputMode="decimal"
                    placeholder="3.6"
                    value={foodForm.fat}
                    onChange={(e) => setFoodForm({ ...foodForm, fat: e.target.value })}
                    aria-invalid={createAttempted && !!foodFormErrors.fat}
                  />
                  {createAttempted && foodFormErrors.fat && (
                    <p className="text-xs text-destructive">{foodFormErrors.fat}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-muted-foreground">Calorias (auto)</Label>
                  <div className="flex h-9 w-full items-center rounded-md border bg-muted/50 px-3 text-sm text-muted-foreground">
                    {computedCalories > 0 ? `${computedCalories} kcal` : "-"}
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleCreateInline} className="flex-1" disabled={createFood.isPending}>
                  {createFood.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                  Criar
                </Button>
                <Button variant="outline" onClick={resetCreateForm}>
                  Cancelar
                </Button>
              </div>
            </div>
          )}

          {/* Results */}
          {!selectedFood && !showCreateForm && (
            <div className="max-h-48 overflow-y-auto space-y-1 rounded-xl border p-2">
              {isLoading && (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              )}
              {foods?.length === 0 && !isLoading && (
                <div className="text-center py-4 space-y-2">
                  <p className="text-sm text-muted-foreground">Nenhum alimento encontrado.</p>
                  <Button variant="outline" size="sm" onClick={() => { setShowCreateForm(true); setFoodForm({ ...emptyFoodForm, name: search }); }}>
                    <Plus className="h-4 w-4 mr-1" />
                    Criar Alimento
                  </Button>
                </div>
              )}
              {foods?.map((food) => (
                <button
                  key={food.id}
                  type="button"
                  onClick={() => setSelectedFood(food)}
                  className="w-full text-left rounded-lg px-3 py-2 text-sm hover:bg-accent transition-colors"
                >
                  <div className="font-medium">{food.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {food.calories_kcal} kcal - P: {food.protein_g}g - C: {food.carbs_g}g - G:{" "}
                    {food.fat_g}g (por 100g)
                  </div>
                </button>
              ))}
              {foods && foods.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowCreateForm(true)}
                  className="w-full text-left rounded-lg px-3 py-2 text-sm hover:bg-accent transition-colors text-primary"
                >
                  <Plus className="h-3 w-3 inline mr-1" />
                  Criar novo alimento manualmente
                </button>
              )}
            </div>
          )}

          {/* Selected food */}
          {selectedFood && (
            <div className="rounded-xl border p-3 bg-accent/30">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">{selectedFood.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {selectedFood.calories_kcal} kcal/100g
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelectedFood(null);
                    setAddAttempted(false);
                  }}
                >
                  Trocar
                </Button>
              </div>

              <div className="mt-3 space-y-2">
                <Label htmlFor="grams">Quantidade (gramas)</Label>
                <Input
                  id="grams"
                  type="number"
                  min="0.1"
                  step="0.1"
                  inputMode="decimal"
                  placeholder="Ex: 150"
                  value={grams}
                  onChange={(e) => setGrams(e.target.value)}
                  aria-invalid={!!gramsError}
                />
                {gramsError && <p className="text-xs text-destructive">{gramsError}</p>}
                {grams && !isNaN(gramsValue) && gramsValue > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Aproximadamente{" "}
                    {((selectedFood.calories_kcal * gramsValue) / 100).toFixed(0)}{" "}
                    kcal - P:{" "}
                    {((selectedFood.protein_g * gramsValue) / 100).toFixed(1)}g - C:{" "}
                    {((selectedFood.carbs_g * gramsValue) / 100).toFixed(1)}g - G:{" "}
                    {((selectedFood.fat_g * gramsValue) / 100).toFixed(1)}g
                  </p>
                )}
              </div>

              <Button
                className="w-full mt-3"
                onClick={handleAdd}
                disabled={!grams.trim() || isNaN(gramsValue) || gramsValue <= 0 || addItem.isPending}
              >
                {addItem.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Plus className="h-4 w-4 mr-2" />
                )}
                Adicionar
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
