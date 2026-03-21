"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { getRecipes, getRecipeItems, saveRecipe, deleteRecipe, addFoodEntry, getCatalog } from "@/lib/db";
import type { Recipe, RecipeItem, FoodCatalogEntry, MealType } from "@/lib/types";
import { MEAL_TYPES } from "@/lib/types";
import { todayISO } from "@/lib/utils";
import { Trash2, ChevronDown, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";

interface IngredientDraft {
  comida: string;
  marca: string;
  gramos: number;
  kcal: number;
  proteinas: number;
  carbs: number;
  grasas: number;
}

export default function RecetasPage() {
  const supabase = createClient();
  const { addToast } = useToast();
  const [userId, setUserId] = useState("");
  const [recipes, setRecipes] = useState<(Recipe & { items: RecipeItem[] })[]>([]);
  const [catalog, setCatalog] = useState<FoodCatalogEntry[]>([]);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // New recipe form
  const [showBuilder, setShowBuilder] = useState(false);
  const [recipeName, setRecipeName] = useState("");
  const [recipeDesc, setRecipeDesc] = useState("");
  const [servings, setServings] = useState("1");
  const [servingName, setServingName] = useState("porcion");
  const [ingredients, setIngredients] = useState<IngredientDraft[]>([]);

  // Ingredient form
  const [ingNombre, setIngNombre] = useState("");
  const [ingGramos, setIngGramos] = useState("100");
  const [ingKcal, setIngKcal] = useState("");
  const [ingProt, setIngProt] = useState("");
  const [ingCarbs, setIngCarbs] = useState("");
  const [ingGrasas, setIngGrasas] = useState("");

  // OFF search
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Array<{ name: string; kcal: number; protein: number; carbs: number; fat: number }>>([]);

  const loadData = useCallback(async (uid: string) => {
    const [recipeList, cat] = await Promise.all([
      getRecipes(supabase, uid),
      getCatalog(supabase, uid),
    ]);

    const recipesWithItems = await Promise.all(
      recipeList.map(async (r) => ({
        ...r,
        items: await getRecipeItems(supabase, r.id),
      }))
    );
    setRecipes(recipesWithItems);
    setCatalog(cat);
  }, [supabase]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUserId(user.id);
        loadData(user.id);
      }
    });
  }, [loadData, supabase.auth]);

  async function searchOFF() {
    if (!searchQuery.trim()) return;
    const res = await fetch(
      `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(searchQuery)}&search_simple=1&action=process&json=1&page_size=8&fields=product_name,brands,nutriments`
    );
    const data = await res.json();
    setSearchResults((data.products || []).map((p: Record<string, unknown>) => {
      const n = p.nutriments as Record<string, number> | undefined;
      return {
        name: (p.product_name as string) || "Sin nombre",
        kcal: Math.round(n?.["energy-kcal_100g"] || 0),
        protein: Math.round((n?.["proteins_100g"] || 0) * 10) / 10,
        carbs: Math.round((n?.["carbohydrates_100g"] || 0) * 10) / 10,
        fat: Math.round((n?.["fat_100g"] || 0) * 10) / 10,
      };
    }));
  }

  function selectIngredient(name: string, kcal: number, prot: number, carbs: number, fat: number) {
    setIngNombre(name);
    setIngKcal(String(kcal));
    setIngProt(String(prot));
    setIngCarbs(String(carbs));
    setIngGrasas(String(fat));
  }

  function addIngredient() {
    if (!ingNombre.trim()) return;
    const g = parseFloat(ingGramos) || 100;
    const k100 = parseFloat(ingKcal) || 0;
    const p100 = parseFloat(ingProt) || 0;
    const c100 = parseFloat(ingCarbs) || 0;
    const g100 = parseFloat(ingGrasas) || 0;

    setIngredients([...ingredients, {
      comida: ingNombre,
      marca: "",
      gramos: g,
      kcal: (k100 * g) / 100,
      proteinas: (p100 * g) / 100,
      carbs: (c100 * g) / 100,
      grasas: (g100 * g) / 100,
    }]);

    setIngNombre("");
    setIngGramos("100");
    setIngKcal("");
    setIngProt("");
    setIngCarbs("");
    setIngGrasas("");
  }

  async function handleSaveRecipe() {
    if (!recipeName.trim() || ingredients.length === 0) return;
    try {
      await saveRecipe(supabase, userId, recipeName, recipeDesc || null, ingredients, parseInt(servings) || 1, servingName || null);
      setRecipeName("");
      setRecipeDesc("");
      setServings("1");
      setServingName("porcion");
      setIngredients([]);
      setShowBuilder(false);
      addToast("Receta guardada", "success");
      await loadData(userId);
    } catch {
      addToast("Error al guardar receta", "error");
    }
  }

  async function handleDeleteRecipe(id: number) {
    if (!confirm("Eliminar receta?")) return;
    await deleteRecipe(supabase, id);
    addToast("Receta eliminada", "info");
    await loadData(userId);
  }

  async function handleLogRecipe(recipe: Recipe & { items: RecipeItem[] }, portions: number, fecha: string, tipo: MealType) {
    const factor = portions / (recipe.servings || 1);
    await addFoodEntry(
      supabase, userId, fecha, tipo,
      `${recipe.name} (${portions} ${recipe.serving_name || "porcion"})`,
      null,
      (recipe.total_grams || 0) * factor,
      (recipe.total_kcal || 0) * factor,
      (recipe.total_protein || 0) * factor,
      (recipe.total_carbs || 0) * factor,
      (recipe.total_fat || 0) * factor
    );
    addToast("Receta registrada en diario", "success");
  }

  const totals = ingredients.reduce(
    (acc, i) => ({
      kcal: acc.kcal + i.kcal,
      prot: acc.prot + i.proteinas,
      carbs: acc.carbs + i.carbs,
      grasas: acc.grasas + i.grasas,
      gramos: acc.gramos + i.gramos,
    }),
    { kcal: 0, prot: 0, carbs: 0, grasas: 0, gramos: 0 }
  );
  const srv = parseInt(servings) || 1;

  const selectClass = "h-11 w-full rounded-lg border-[1.5px] border-white/[.06] bg-surface px-4 text-white transition-colors duration-100 focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent text-sm";

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-2xl font-bold">Recetas</h1>

      {/* Recipe list */}
      {recipes.map((recipe) => {
        const perServing = recipe.servings || 1;
        const expanded = expandedId === recipe.id;
        return (
          <div key={recipe.id} className="bg-surface rounded-xl border border-white/[.06] overflow-hidden">
            <button
              onClick={() => setExpandedId(expanded ? null : recipe.id)}
              className="w-full flex items-center justify-between p-3 hover:bg-surface-hover transition-colors"
            >
              <div>
                <span className="font-medium">{recipe.name}</span>
                <span className="text-xs text-gray-500 ml-2 nums">
                  {Math.round((recipe.total_kcal || 0) / perServing)} kcal/porcion ({perServing} porciones)
                </span>
              </div>
              <ChevronDown size={16} className={`transition-transform ${expanded ? "rotate-180" : ""}`} />
            </button>

            {expanded && (
              <div className="border-t border-white/[.06] p-3 space-y-3">
                {recipe.description && <p className="text-sm text-gray-400">{recipe.description}</p>}
                <div className="flex gap-4 text-sm nums">
                  <span className="text-orange-400">{Math.round((recipe.total_kcal || 0) / perServing)} kcal</span>
                  <span className="text-blue-400">{Math.round((recipe.total_protein || 0) / perServing)}g P</span>
                  <span className="text-yellow-400">{Math.round((recipe.total_carbs || 0) / perServing)}g C</span>
                  <span className="text-pink-400">{Math.round((recipe.total_fat || 0) / perServing)}g G</span>
                </div>
                {recipe.items.length > 0 && (
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-gray-500">
                        <th className="text-left py-1">Ingrediente</th>
                        <th className="text-right py-1">g</th>
                        <th className="text-right py-1">kcal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recipe.items.map((item) => (
                        <tr key={item.id} className="border-t border-white/[.03]">
                          <td className="py-1">{item.comida}</td>
                          <td className="py-1 text-right nums">{item.gramos}</td>
                          <td className="py-1 text-right nums">{Math.round(item.kcal)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                <RecipeLogForm recipe={recipe} onLog={handleLogRecipe} />
                <button onClick={() => handleDeleteRecipe(recipe.id)} className="text-xs text-danger hover:text-red-300">
                  Eliminar receta
                </button>
              </div>
            )}
          </div>
        );
      })}

      {/* New recipe */}
      {!showBuilder && (
        <Button
          onClick={() => setShowBuilder(true)}
          className="w-full"
          size="lg"
        >
          <Plus size={18} /> Nueva receta
        </Button>
      )}

      {showBuilder && (
        <div className="bg-surface rounded-xl border border-white/[.06] p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-medium">Nueva receta</h3>
            <Button variant="ghost" size="sm" onClick={() => setShowBuilder(false)}>&times;</Button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input type="text" value={recipeName} onChange={(e) => setRecipeName(e.target.value)} placeholder="Nombre" className="text-sm" />
            <Input type="text" value={recipeDesc} onChange={(e) => setRecipeDesc(e.target.value)} placeholder="Descripcion" className="text-sm" />
            <Input type="number" value={servings} onChange={(e) => setServings(e.target.value)} placeholder="Porciones" min="1" className="text-sm" />
            <Input type="text" value={servingName} onChange={(e) => setServingName(e.target.value)} placeholder="Nombre porcion" className="text-sm" />
          </div>

          {/* Search ingredient */}
          <div className="flex gap-2">
            <Input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && searchOFF()} placeholder="Buscar ingrediente en OFF..." className="flex-1 text-sm" />
            <Button onClick={searchOFF} size="sm">
              <Search size={14} />
            </Button>
          </div>
          {searchResults.length > 0 && (
            <div className="max-h-32 overflow-y-auto space-y-1">
              {searchResults.map((r, i) => (
                <button key={i} onClick={() => selectIngredient(r.name, r.kcal, r.protein, r.carbs, r.fat)} className="w-full text-left p-1.5 rounded hover:bg-surface-hover text-xs">
                  {r.name} — <span className="nums">{r.kcal} kcal/100g</span>
                </button>
              ))}
            </div>
          )}

          {/* Catalog quick pick */}
          {catalog.length > 0 && (
            <select
              onChange={(e) => {
                const c = catalog.find((x) => x.id === parseInt(e.target.value));
                if (c) selectIngredient(c.comida, c.kcal_100g, c.proteinas_100g, c.carbs_100g, c.grasas_100g);
              }}
              className={selectClass}
              defaultValue=""
            >
              <option value="" disabled>Del catalogo...</option>
              {catalog.map((c) => (
                <option key={c.id} value={c.id}>{c.comida} ({c.kcal_100g} kcal/100g)</option>
              ))}
            </select>
          )}

          {/* Ingredient entry */}
          <div className="grid grid-cols-6 gap-2">
            <Input type="text" value={ingNombre} onChange={(e) => setIngNombre(e.target.value)} placeholder="Ingrediente" className="col-span-2 text-xs" />
            <Input type="number" value={ingGramos} onChange={(e) => setIngGramos(e.target.value)} placeholder="g" className="text-xs" />
            <Input type="number" value={ingKcal} onChange={(e) => setIngKcal(e.target.value)} placeholder="kcal" className="text-xs" />
            <Input type="number" value={ingProt} onChange={(e) => setIngProt(e.target.value)} placeholder="P" className="text-xs" />
            <Button onClick={addIngredient} variant="secondary" size="sm" className="text-xs">+ Add</Button>
          </div>

          {/* Current ingredients */}
          {ingredients.length > 0 && (
            <div className="space-y-2">
              <table className="w-full text-xs">
                <tbody>
                  {ingredients.map((ing, i) => (
                    <tr key={i} className="border-b border-white/[.03]">
                      <td className="py-1">{ing.comida}</td>
                      <td className="py-1 text-right nums">{ing.gramos}g</td>
                      <td className="py-1 text-right nums">{Math.round(ing.kcal)} kcal</td>
                      <td className="py-1">
                        <button onClick={() => setIngredients(ingredients.filter((_, j) => j !== i))} className="text-danger ml-2">
                          <Trash2 size={10} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-xs text-gray-400 nums">
                Total: {Math.round(totals.kcal)} kcal | P:{Math.round(totals.prot)} C:{Math.round(totals.carbs)} G:{Math.round(totals.grasas)} |
                Por porcion: {Math.round(totals.kcal / srv)} kcal
              </p>
              <Button onClick={handleSaveRecipe} className="w-full" size="sm">
                Guardar receta
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function RecipeLogForm({
  recipe,
  onLog,
}: {
  recipe: Recipe;
  onLog: (recipe: Recipe & { items: RecipeItem[] }, portions: number, fecha: string, tipo: MealType) => void;
}) {
  const [portions, setPortions] = useState("1");
  const [fecha, setFecha] = useState(todayISO());
  const [tipo, setTipo] = useState<MealType>("Comida");

  const selectClass = "h-8 rounded-lg border-[1.5px] border-white/[.06] bg-surface px-2 text-white text-xs transition-colors duration-100 focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent";

  return (
    <div className="flex items-end gap-2 flex-wrap">
      <Input type="number" value={portions} onChange={(e) => setPortions(e.target.value)} min="0.5" step="0.5" className="w-20 text-xs h-8" />
      <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="text-xs h-8" />
      <select value={tipo} onChange={(e) => setTipo(e.target.value as MealType)} className={selectClass}>
        {MEAL_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
      </select>
      <Button onClick={() => onLog(recipe as Recipe & { items: RecipeItem[] }, parseFloat(portions) || 1, fecha, tipo)} variant="secondary" size="sm" className="text-xs">
        Registrar
      </Button>
    </div>
  );
}
