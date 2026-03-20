"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { getRecipes, getRecipeItems, saveRecipe, deleteRecipe, addFoodEntry, getCatalog } from "@/lib/db";
import type { Recipe, RecipeItem, FoodCatalogEntry, MealType } from "@/lib/types";
import { MEAL_TYPES } from "@/lib/types";
import { todayISO } from "@/lib/utils";
import { Trash2, ChevronDown, Plus, Search } from "lucide-react";

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
    await saveRecipe(supabase, userId, recipeName, recipeDesc || null, ingredients, parseInt(servings) || 1, servingName || null);
    setRecipeName("");
    setRecipeDesc("");
    setServings("1");
    setServingName("porcion");
    setIngredients([]);
    setShowBuilder(false);
    await loadData(userId);
  }

  async function handleDeleteRecipe(id: number) {
    if (!confirm("Eliminar receta?")) return;
    await deleteRecipe(supabase, id);
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

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Recetas</h1>

      {/* Recipe list */}
      {recipes.map((recipe) => {
        const perServing = recipe.servings || 1;
        const expanded = expandedId === recipe.id;
        return (
          <div key={recipe.id} className="bg-surface rounded-xl border border-border overflow-hidden">
            <button
              onClick={() => setExpandedId(expanded ? null : recipe.id)}
              className="w-full flex items-center justify-between p-3 hover:bg-surface-hover transition-colors"
            >
              <div>
                <span className="font-medium">{recipe.name}</span>
                <span className="text-xs text-gray-500 ml-2">
                  {Math.round((recipe.total_kcal || 0) / perServing)} kcal/porcion ({perServing} porciones)
                </span>
              </div>
              <ChevronDown size={16} className={`transition-transform ${expanded ? "rotate-180" : ""}`} />
            </button>

            {expanded && (
              <div className="border-t border-border p-3 space-y-3">
                {recipe.description && <p className="text-sm text-gray-400">{recipe.description}</p>}
                <div className="flex gap-4 text-sm">
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
                        <tr key={item.id} className="border-t border-border/30">
                          <td className="py-1">{item.comida}</td>
                          <td className="py-1 text-right">{item.gramos}</td>
                          <td className="py-1 text-right">{Math.round(item.kcal)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                <RecipeLogForm recipe={recipe} onLog={handleLogRecipe} />
                <button onClick={() => handleDeleteRecipe(recipe.id)} className="text-xs text-red-400 hover:text-red-300">
                  Eliminar receta
                </button>
              </div>
            )}
          </div>
        );
      })}

      {/* New recipe */}
      {!showBuilder && (
        <button
          onClick={() => setShowBuilder(true)}
          className="w-full flex items-center justify-center gap-2 py-3 bg-brand hover:bg-brand-500 text-white font-medium rounded-xl"
        >
          <Plus size={18} /> Nueva receta
        </button>
      )}

      {showBuilder && (
        <div className="bg-surface rounded-xl border border-border p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-medium">Nueva receta</h3>
            <button onClick={() => setShowBuilder(false)} className="text-gray-500 hover:text-white">&times;</button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <input type="text" value={recipeName} onChange={(e) => setRecipeName(e.target.value)} placeholder="Nombre" className="px-3 py-2 bg-background border border-border rounded-lg text-white text-sm" />
            <input type="text" value={recipeDesc} onChange={(e) => setRecipeDesc(e.target.value)} placeholder="Descripcion" className="px-3 py-2 bg-background border border-border rounded-lg text-white text-sm" />
            <input type="number" value={servings} onChange={(e) => setServings(e.target.value)} placeholder="Porciones" min="1" className="px-3 py-2 bg-background border border-border rounded-lg text-white text-sm" />
            <input type="text" value={servingName} onChange={(e) => setServingName(e.target.value)} placeholder="Nombre porcion" className="px-3 py-2 bg-background border border-border rounded-lg text-white text-sm" />
          </div>

          {/* Search ingredient */}
          <div className="flex gap-2">
            <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && searchOFF()} placeholder="Buscar ingrediente en OFF..." className="flex-1 px-3 py-2 bg-background border border-border rounded-lg text-white text-sm" />
            <button onClick={searchOFF} className="px-3 py-2 bg-brand text-white text-sm rounded-lg">
              <Search size={14} />
            </button>
          </div>
          {searchResults.length > 0 && (
            <div className="max-h-32 overflow-y-auto space-y-1">
              {searchResults.map((r, i) => (
                <button key={i} onClick={() => selectIngredient(r.name, r.kcal, r.protein, r.carbs, r.fat)} className="w-full text-left p-1.5 rounded hover:bg-background text-xs">
                  {r.name} — {r.kcal} kcal/100g
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
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-white text-sm"
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
            <input type="text" value={ingNombre} onChange={(e) => setIngNombre(e.target.value)} placeholder="Ingrediente" className="col-span-2 px-2 py-1.5 bg-background border border-border rounded text-white text-xs" />
            <input type="number" value={ingGramos} onChange={(e) => setIngGramos(e.target.value)} placeholder="g" className="px-2 py-1.5 bg-background border border-border rounded text-white text-xs" />
            <input type="number" value={ingKcal} onChange={(e) => setIngKcal(e.target.value)} placeholder="kcal" className="px-2 py-1.5 bg-background border border-border rounded text-white text-xs" />
            <input type="number" value={ingProt} onChange={(e) => setIngProt(e.target.value)} placeholder="P" className="px-2 py-1.5 bg-background border border-border rounded text-white text-xs" />
            <button onClick={addIngredient} className="px-2 py-1.5 bg-brand/20 text-brand rounded text-xs">+ Add</button>
          </div>

          {/* Current ingredients */}
          {ingredients.length > 0 && (
            <div className="space-y-2">
              <table className="w-full text-xs">
                <tbody>
                  {ingredients.map((ing, i) => (
                    <tr key={i} className="border-b border-border/30">
                      <td className="py-1">{ing.comida}</td>
                      <td className="py-1 text-right">{ing.gramos}g</td>
                      <td className="py-1 text-right">{Math.round(ing.kcal)} kcal</td>
                      <td className="py-1">
                        <button onClick={() => setIngredients(ingredients.filter((_, j) => j !== i))} className="text-red-400 ml-2">
                          <Trash2 size={10} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-xs text-gray-400">
                Total: {Math.round(totals.kcal)} kcal | P:{Math.round(totals.prot)} C:{Math.round(totals.carbs)} G:{Math.round(totals.grasas)} |
                Por porcion: {Math.round(totals.kcal / srv)} kcal
              </p>
              <button onClick={handleSaveRecipe} className="w-full py-2 bg-brand hover:bg-brand-500 text-white font-medium rounded-lg text-sm">
                Guardar receta
              </button>
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

  return (
    <div className="flex items-end gap-2 flex-wrap">
      <input type="number" value={portions} onChange={(e) => setPortions(e.target.value)} min="0.5" step="0.5" className="w-20 px-2 py-1 bg-background border border-border rounded text-white text-xs" />
      <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="px-2 py-1 bg-background border border-border rounded text-white text-xs" />
      <select value={tipo} onChange={(e) => setTipo(e.target.value as MealType)} className="px-2 py-1 bg-background border border-border rounded text-white text-xs">
        {MEAL_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
      </select>
      <button onClick={() => onLog(recipe as Recipe & { items: RecipeItem[] }, parseFloat(portions) || 1, fecha, tipo)} className="px-3 py-1 bg-brand/20 text-brand text-xs rounded hover:bg-brand/30">
        Registrar
      </button>
    </div>
  );
}
