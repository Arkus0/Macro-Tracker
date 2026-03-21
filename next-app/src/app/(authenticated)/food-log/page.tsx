"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  getFoodEntries,
  addFoodEntry,
  deleteFoodEntry,
  copyFoodEntries,
  getActiveTargets,
  getFrequentFoods,
  getCatalog,
  getMealTemplates,
  getTemplateItems,
  useMealTemplate,
  addCatalogEntry,
  getFoodDailyTotals,
  saveMealTemplate,
  deleteMealTemplate,
  getDayTypeForDate,
} from "@/lib/db";
import type { FoodEntry, Targets, FrequentFood, FoodCatalogEntry, MealTemplate, MealTemplateItem, MealType, DayType } from "@/lib/types";
import { MEAL_TYPES } from "@/lib/types";
import { todayISO, formatDateDisplay } from "@/lib/utils";
import MacroDisplay from "@/components/macro-display";
import { useToast } from "@/components/ui/toast";
import { Copy, Trash2, ChevronDown, ChevronUp, Plus, Search, Star, Clock, BookOpen, Pencil, Sparkles, Camera } from "lucide-react";

export default function FoodLogPage() {
  const supabase = createClient();
  const { addToast } = useToast();
  const [userId, setUserId] = useState("");
  const [fecha, setFecha] = useState(todayISO());
  const [entries, setEntries] = useState<FoodEntry[]>([]);
  const [targets, setTargets] = useState<Targets | null>(null);
  const [dayType, setDayType] = useState<DayType>("default");
  const [showAddForm, setShowAddForm] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("buscar");
  const [tipoComida, setTipoComida] = useState<MealType>("Comida");

  // Food entry form state
  const [nombre, setNombre] = useState("");
  const [marca, setMarca] = useState("");
  const [gramos, setGramos] = useState("100");
  const [kcal100, setKcal100] = useState("");
  const [prot100, setProt100] = useState("");
  const [carbs100, setCarbs100] = useState("");
  const [grasas100, setGrasas100] = useState("");
  const [saveToCatalog, setSaveToCatalog] = useState(false);

  // OFF search
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Array<{
    name: string; brand: string; kcal: number; protein: number; carbs: number; fat: number;
  }>>([]);
  const [searching, setSearching] = useState(false);

  // AI estimation
  const [aiDescription, setAiDescription] = useState("");
  const [aiResults, setAiResults] = useState<Array<{
    comida: string; gramos: number; kcal: number; proteinas: number; carbs: number; grasas: number;
  }>>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");

  // Scanner
  const [scanMode, setScanMode] = useState<"barcode" | "label" | null>(null);
  const [scanLoading, setScanLoading] = useState(false);
  const [barcodeValue, setBarcodeValue] = useState("");
  const [barcodeError, setBarcodeError] = useState("");
  const [scanError, setScanError] = useState("");
  const [scanPreview, setScanPreview] = useState<string | null>(null);
  const [searchError, setSearchError] = useState("");

  // Frequent foods & catalog
  const [frequentFoods, setFrequentFoods] = useState<FrequentFood[]>([]);
  const [catalog, setCatalog] = useState<FoodCatalogEntry[]>([]);
  const [templates, setTemplates] = useState<MealTemplate[]>([]);

  // Weekly averages
  const [weeklyAvg, setWeeklyAvg] = useState({ kcal: 0, prot: 0, carbs: 0, grasas: 0 });

  // Collapsed sections
  const [collapsedMeals, setCollapsedMeals] = useState<Record<string, boolean>>({});

  const loadData = useCallback(async (uid: string) => {
    const [foodEntries, activeTargets, freq, cat, tmpl, dt] = await Promise.all([
      getFoodEntries(supabase, uid, fecha),
      getActiveTargets(supabase, uid, fecha),
      getFrequentFoods(supabase, uid),
      getCatalog(supabase, uid),
      getMealTemplates(supabase, uid),
      getDayTypeForDate(supabase, uid, fecha),
    ]);
    setEntries(foodEntries);
    setTargets(activeTargets);
    setFrequentFoods(freq);
    setCatalog(cat);
    setTemplates(tmpl);
    setDayType(dt);

    // Weekly averages
    const d = new Date(fecha + "T00:00:00");
    const startDate = new Date(d);
    startDate.setDate(d.getDate() - 6);
    const totals = await getFoodDailyTotals(
      supabase,
      uid,
      startDate.toISOString().split("T")[0],
      fecha
    );
    if (totals.length > 0) {
      const avg = {
        kcal: totals.reduce((s, t) => s + t.kcal, 0) / totals.length,
        prot: totals.reduce((s, t) => s + t.proteinas, 0) / totals.length,
        carbs: totals.reduce((s, t) => s + t.carbs, 0) / totals.length,
        grasas: totals.reduce((s, t) => s + t.grasas, 0) / totals.length,
      };
      setWeeklyAvg(avg);
    }
  }, [supabase, fecha]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUserId(user.id);
        loadData(user.id);
      }
    });
  }, [loadData, supabase.auth]);

  useEffect(() => {
    if (userId) loadData(userId);
  }, [fecha, userId, loadData]);

  // Totals
  const totals = entries.reduce(
    (acc, e) => ({
      kcal: acc.kcal + (e.kcal || 0),
      proteinas: acc.proteinas + (e.proteinas || 0),
      carbs: acc.carbs + (e.carbs || 0),
      grasas: acc.grasas + (e.grasas || 0),
    }),
    { kcal: 0, proteinas: 0, carbs: 0, grasas: 0 }
  );

  function selectFood(name: string, brand: string, k: number, p: number, c: number, g: number) {
    setNombre(name);
    setMarca(brand);
    setKcal100(String(k));
    setProt100(String(p));
    setCarbs100(String(c));
    setGrasas100(String(g));
    setActiveTab("manual");
  }

  async function searchOFF() {
    if (!searchQuery.trim()) return;
    setSearching(true);
    setSearchError("");
    try {
      const res = await fetch(
        `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(searchQuery)}&search_simple=1&action=process&json=1&page_size=10&fields=product_name,brands,nutriments`
      );
      const data = await res.json();
      const results = (data.products || []).map((p: Record<string, unknown>) => {
        const n = p.nutriments as Record<string, number> | undefined;
        return {
          name: (p.product_name as string) || "Sin nombre",
          brand: (p.brands as string) || "",
          kcal: Math.round(n?.["energy-kcal_100g"] || 0),
          protein: Math.round((n?.["proteins_100g"] || 0) * 10) / 10,
          carbs: Math.round((n?.["carbohydrates_100g"] || 0) * 10) / 10,
          fat: Math.round((n?.["fat_100g"] || 0) * 10) / 10,
        };
      });
      setSearchResults(results);
      if (results.length === 0) {
        setSearchError("No se encontraron resultados para esa busqueda.");
      }
    } catch {
      setSearchResults([]);
      setSearchError("Error al buscar en Open Food Facts. Intenta de nuevo.");
    } finally {
      setSearching(false);
    }
  }

  async function handleAddFood() {
    if (!nombre.trim()) return;
    const g = parseFloat(gramos) || 100;
    const k100 = parseFloat(kcal100) || 0;
    const p100 = parseFloat(prot100) || 0;
    const c100 = parseFloat(carbs100) || 0;
    const g100 = parseFloat(grasas100) || 0;

    const totalKcal = (k100 * g) / 100;
    const totalProt = (p100 * g) / 100;
    const totalCarbs = (c100 * g) / 100;
    const totalGrasas = (g100 * g) / 100;

    await addFoodEntry(supabase, userId, fecha, tipoComida, nombre, marca || null, g, totalKcal, totalProt, totalCarbs, totalGrasas);

    if (saveToCatalog) {
      await addCatalogEntry(supabase, userId, nombre, marca || null, k100, p100, c100, g100);
    }

    // Reset form
    setNombre("");
    setMarca("");
    setGramos("100");
    setKcal100("");
    setProt100("");
    setCarbs100("");
    setGrasas100("");
    setSaveToCatalog(false);
    setShowAddForm(false);
    await loadData(userId);
    addToast("Comida añadida", "success");
  }

  async function handleDelete(entryId: number) {
    await deleteFoodEntry(supabase, entryId);
    await loadData(userId);
    addToast("Comida eliminada", "info");
  }

  async function handleCopyPreviousDay() {
    const d = new Date(fecha + "T00:00:00");
    d.setDate(d.getDate() - 1);
    const prevDate = d.toISOString().split("T")[0];
    await copyFoodEntries(supabase, userId, prevDate, fecha);
    await loadData(userId);
    addToast("Dia anterior copiado", "success");
  }

  async function handleUseTemplate(templateId: number) {
    await useMealTemplate(supabase, userId, templateId, fecha, tipoComida);
    await loadData(userId);
    addToast("Template aplicado", "success");
  }

  async function handleSaveTemplate() {
    const name = prompt("Nombre del template:");
    if (!name) return;
    const items = entries.map((e) => ({
      comida: e.comida,
      marca: e.marca,
      gramos: e.gramos,
      kcal: e.kcal,
      proteinas: e.proteinas,
      carbs: e.carbs,
      grasas: e.grasas,
    }));
    await saveMealTemplate(supabase, userId, name, items);
    await loadData(userId);
    addToast("Template guardado", "success");
  }

  async function handleDeleteTemplate(templateId: number) {
    await deleteMealTemplate(supabase, templateId);
    await loadData(userId);
    addToast("Template eliminado", "info");
  }

  async function handleAiEstimate() {
    if (!aiDescription.trim()) return;
    setAiLoading(true);
    setAiError("");
    try {
      const res = await fetch("/api/ai-estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: aiDescription }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setAiResults(data.items || []);
    } catch (err: unknown) {
      setAiError(err instanceof Error ? err.message : "Error al estimar");
    } finally {
      setAiLoading(false);
    }
  }

  async function handleBarcodeLookup() {
    const barcode = barcodeValue.trim();
    if (barcode.length < 8) return;
    setScanLoading(true);
    setBarcodeError("");
    try {
      const res = await fetch("/api/barcode-lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ barcode }),
      });
      const data = await res.json();
      if (data.error) {
        setBarcodeError(data.error);
      } else if (data.product) {
        selectFood(data.product.name, data.product.brand, data.product.kcal_100g, data.product.proteinas_100g, data.product.carbs_100g, data.product.grasas_100g);
      } else {
        setBarcodeError("Producto no encontrado en la base de datos.");
      }
    } catch {
      setBarcodeError("Error al buscar el producto. Verifica el codigo.");
    } finally {
      setScanLoading(false);
    }
  }

  async function handleLabelImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setScanLoading(true);
    setScanError("");
    try {
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
      setScanPreview(base64);
      const res = await fetch("/api/label-scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: base64 }),
      });
      const data = await res.json();
      if (data.error) {
        setScanError(data.error);
      } else if (data.nutrition) {
        const n = data.nutrition;
        selectFood(
          n.nombre_producto || "Producto escaneado",
          "",
          n.kcal_100g || 0,
          n.proteinas_100g || 0,
          n.carbs_100g || 0,
          n.grasas_100g || 0
        );
      } else {
        setScanError("No se pudieron extraer los valores nutricionales.");
      }
    } catch {
      setScanError("Error al procesar la etiqueta. Intenta con otra foto.");
    } finally {
      setScanLoading(false);
    }
  }

  const tabs = [
    { key: "buscar", label: "Buscar", icon: Search },
    { key: "frecuentes", label: "Frecuentes", icon: Clock },
    { key: "catalogo", label: "Catalogo", icon: Star },
    { key: "templates", label: "Templates", icon: BookOpen },
    { key: "ia", label: "IA", icon: Sparkles },
    { key: "escanear", label: "Escanear", icon: Camera },
    { key: "manual", label: "Manual", icon: Pencil },
  ];

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Food Log</h1>
        {dayType !== "default" && (
          <span className={`text-xs px-2 py-1 rounded-full ${
            dayType === "training" ? "bg-green-400/20 text-green-400" : "bg-blue-400/20 text-blue-400"
          }`}>
            {dayType === "training" ? "Entrenamiento" : "Descanso"}
          </span>
        )}
      </div>

      {/* Date + Actions */}
      <div className="flex items-center gap-3">
        <input
          type="date"
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
          className="px-3 py-2 bg-surface border border-border rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand/50"
        />
        <button
          onClick={handleCopyPreviousDay}
          className="flex items-center gap-1 px-3 py-2 bg-surface border border-border rounded-lg text-sm text-gray-400 hover:text-white hover:bg-surface-hover transition-colors"
        >
          <Copy size={14} /> Copiar ayer
        </button>
      </div>

      {/* Day totals */}
      <MacroDisplay
        kcal={totals.kcal}
        proteinas={totals.proteinas}
        carbs={totals.carbs}
        grasas={totals.grasas}
        targetKcal={targets?.kcal_target}
        targetProtein={targets?.protein_target ?? undefined}
        targetCarbs={targets?.carbs_target ?? undefined}
        targetFat={targets?.fat_target ?? undefined}
      />

      {/* Meals by type */}
      {MEAL_TYPES.map((tipo) => {
        const mealEntries = entries.filter((e) => e.tipo === tipo);
        const mealKcal = mealEntries.reduce((s, e) => s + (e.kcal || 0), 0);
        const collapsed = collapsedMeals[tipo];

        return (
          <div key={tipo} className="bg-surface-1 rounded-xl border border-white/[.06] overflow-hidden">
            <button
              onClick={() => setCollapsedMeals((p) => ({ ...p, [tipo]: !p[tipo] }))}
              className="w-full flex items-center justify-between p-3 hover:bg-surface-hover transition-colors duration-100"
            >
              <div className="flex items-center gap-2">
                <span className="font-medium">{tipo}</span>
                <span className="text-xs text-gray-500 nums">
                  {mealEntries.length} items — {Math.round(mealKcal)} kcal
                </span>
              </div>
              {collapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
            </button>

            {!collapsed && mealEntries.length > 0 && (
              <div className="border-t border-white/[.06]">
                {mealEntries.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between px-3 py-2 border-b border-white/[.04] last:border-0 text-sm"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{entry.comida}</p>
                      <p className="text-xs text-gray-500 nums">
                        {entry.gramos}g — {Math.round(entry.kcal)} kcal | P:{Math.round(entry.proteinas)} C:{Math.round(entry.carbs)} G:{Math.round(entry.grasas)}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDelete(entry.id)}
                      className="ml-2 p-1.5 text-gray-500 hover:text-red-400 transition-colors duration-100"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {/* Add food button */}
      {!showAddForm && (
        <div className="flex gap-3">
          <button
            onClick={() => setShowAddForm(true)}
            className="flex-1 flex items-center justify-center gap-2 py-3 bg-brand hover:bg-brand-500 text-white font-medium rounded-xl transition-colors"
          >
            <Plus size={18} /> Añadir comida
          </button>
          {entries.length > 0 && (
            <button
              onClick={handleSaveTemplate}
              className="px-4 py-3 bg-surface border border-border rounded-xl text-sm text-gray-400 hover:text-white hover:bg-surface-hover transition-colors"
            >
              Guardar template
            </button>
          )}
        </div>
      )}

      {/* Add food form */}
      {showAddForm && (
        <div className="bg-surface-1 rounded-xl border border-white/[.06] p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-medium">Añadir comida</h3>
            <button onClick={() => setShowAddForm(false)} className="text-gray-500 hover:text-white">
              &times;
            </button>
          </div>

          {/* Meal type selector */}
          <div className="flex gap-2 flex-wrap">
            {MEAL_TYPES.map((t) => (
              <button
                key={t}
                onClick={() => setTipoComida(t)}
                className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  tipoComida === t
                    ? "bg-brand text-white"
                    : "bg-background text-gray-400 hover:text-white"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Tabs */}
          <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-none">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs whitespace-nowrap transition-colors duration-100 ${
                    isActive
                      ? "bg-brand/15 text-brand font-medium border-b-2 border-brand"
                      : "text-gray-500 hover:text-white hover:bg-white/[.04]"
                  }`}
                >
                  <Icon size={13} />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Tab content */}
          {activeTab === "buscar" && (
            <div className="space-y-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && searchOFF()}
                  placeholder="Buscar en Open Food Facts..."
                  className="flex-1 px-3 py-2 bg-background border border-border rounded-lg text-white text-sm placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-brand/50"
                />
                <button
                  onClick={searchOFF}
                  disabled={searching}
                  className="px-4 py-2 bg-brand hover:bg-brand-500 disabled:opacity-50 text-white text-sm rounded-lg"
                >
                  {searching ? "..." : "Buscar"}
                </button>
              </div>
              <div className="max-h-48 overflow-y-auto space-y-1">
                {searchResults.map((r, i) => (
                  <button
                    key={i}
                    onClick={() => selectFood(r.name, r.brand, r.kcal, r.protein, r.carbs, r.fat)}
                    className="w-full text-left p-2 rounded-lg hover:bg-background text-sm transition-colors"
                  >
                    <p className="font-medium truncate">{r.name}</p>
                    <p className="text-xs text-gray-500 nums">
                      {r.brand && `${r.brand} — `}{r.kcal} kcal | P:{r.protein} C:{r.carbs} G:{r.fat} /100g
                    </p>
                  </button>
                ))}
              </div>
              {searchError && <p className="text-xs text-red-400 mt-2">{searchError}</p>}
            </div>
          )}

          {activeTab === "frecuentes" && (
            <div className="max-h-48 overflow-y-auto space-y-1">
              {frequentFoods.length === 0 && (
                <p className="text-sm text-gray-500 text-center py-4">Sin alimentos frecuentes aun</p>
              )}
              {frequentFoods.map((f, i) => (
                <button
                  key={i}
                  onClick={() => selectFood(f.comida, f.marca || "", Math.round(f.kcal_100g), Math.round(f.proteinas_100g * 10) / 10, Math.round(f.carbs_100g * 10) / 10, Math.round(f.grasas_100g * 10) / 10)}
                  className="w-full text-left p-2 rounded-lg hover:bg-background text-sm transition-colors"
                >
                  <p className="font-medium truncate">{f.comida} {f.marca && <span className="text-gray-500">({f.marca})</span>}</p>
                  <p className="text-xs text-gray-500 nums">{Math.round(f.kcal_100g)} kcal/100g — usado {f.freq}x</p>
                </button>
              ))}
            </div>
          )}

          {activeTab === "catalogo" && (
            <div className="max-h-48 overflow-y-auto space-y-1">
              {catalog.length === 0 && (
                <p className="text-sm text-gray-500 text-center py-4">Catalogo vacio</p>
              )}
              {catalog.map((c) => (
                <button
                  key={c.id}
                  onClick={() => selectFood(c.comida, c.marca || "", c.kcal_100g, c.proteinas_100g, c.carbs_100g, c.grasas_100g)}
                  className="w-full text-left p-2 rounded-lg hover:bg-background text-sm transition-colors"
                >
                  <p className="font-medium truncate">{c.comida}</p>
                  <p className="text-xs text-gray-500 nums">{c.kcal_100g} kcal/100g</p>
                </button>
              ))}
            </div>
          )}

          {activeTab === "templates" && (
            <div className="max-h-48 overflow-y-auto space-y-2">
              {templates.length === 0 && (
                <p className="text-sm text-gray-500 text-center py-4">Sin templates guardados</p>
              )}
              {templates.map((t) => (
                <div key={t.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-background">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{t.name}</p>
                    <p className="text-xs text-gray-500">Usado {t.use_count}x</p>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleUseTemplate(t.id)}
                      className="px-2 py-1 bg-brand/20 text-brand text-xs rounded-lg hover:bg-brand/30"
                    >
                      Aplicar
                    </button>
                    <button
                      onClick={() => handleDeleteTemplate(t.id)}
                      className="p-1 text-gray-500 hover:text-red-400"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* AI estimation tab */}
          {activeTab === "ia" && (
            <div className="space-y-3">
              <div className="bg-blue-400/10 border border-blue-400/20 rounded-lg p-2 text-xs text-blue-400">
                Estimacion IA — revisa los valores antes de guardar
              </div>
              <textarea
                value={aiDescription}
                onChange={(e) => setAiDescription(e.target.value)}
                placeholder="Describe tu comida... ej: un plato de arroz con pollo a la plancha y ensalada"
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-white text-sm placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-brand/50 min-h-[80px]"
              />
              <button
                onClick={handleAiEstimate}
                disabled={aiLoading || !aiDescription.trim()}
                className="w-full py-2 bg-brand hover:bg-brand-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg"
              >
                {aiLoading ? "Estimando..." : "Estimar macros"}
              </button>
              {aiError && <p className="text-xs text-red-400">{aiError}</p>}
              {aiResults.length > 0 && (
                <div className="space-y-1">
                  {aiResults.map((item, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        const g = item.gramos || 100;
                        selectFood(
                          item.comida,
                          "",
                          Math.round((item.kcal / g) * 100),
                          Math.round((item.proteinas / g) * 100 * 10) / 10,
                          Math.round((item.carbs / g) * 100 * 10) / 10,
                          Math.round((item.grasas / g) * 100 * 10) / 10
                        );
                        setGramos(String(g));
                      }}
                      className="w-full text-left p-2 rounded-lg hover:bg-background text-sm transition-colors"
                    >
                      <p className="font-medium">{item.comida}</p>
                      <p className="text-xs text-gray-500 nums">
                        {item.gramos}g — {Math.round(item.kcal)} kcal | P:{Math.round(item.proteinas)} C:{Math.round(item.carbs)} G:{Math.round(item.grasas)}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Scanner tab */}
          {activeTab === "escanear" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Codigo de barras</h4>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={barcodeValue}
                    onChange={(e) => { setBarcodeValue(e.target.value); setBarcodeError(""); }}
                    onKeyDown={(e) => e.key === "Enter" && handleBarcodeLookup()}
                    placeholder="Codigo de barras..."
                    className="flex-1 px-3 py-2 bg-background border border-border rounded-lg text-white text-sm placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-brand/50"
                    inputMode="numeric"
                  />
                  <button
                    onClick={handleBarcodeLookup}
                    disabled={scanLoading || barcodeValue.trim().length < 8}
                    className="px-4 py-2 bg-brand hover:bg-brand-500 disabled:opacity-50 text-white text-sm rounded-lg transition-colors"
                  >
                    {scanLoading ? "..." : "Buscar"}
                  </button>
                </div>
                {barcodeError && <p className="text-xs text-red-400">{barcodeError}</p>}
              </div>
              <div className="border-t border-border pt-3 space-y-2">
                <h4 className="text-sm font-medium">Etiqueta nutricional</h4>
                <p className="text-xs text-gray-500">Toma una foto de la etiqueta nutricional</p>
                <label className="flex items-center justify-center gap-2 py-3 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-brand/50 transition-colors">
                  <Camera size={18} className="text-gray-400" />
                  <span className="text-sm text-gray-400">{scanLoading ? "Procesando..." : "Capturar etiqueta"}</span>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleLabelImage}
                    className="hidden"
                  />
                </label>
                {scanPreview && (
                  <div className="relative">
                    <img src={scanPreview} alt="Etiqueta" className="w-full max-h-32 object-contain rounded-lg" />
                    {scanLoading && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-lg">
                        <span className="text-sm text-white">Procesando...</span>
                      </div>
                    )}
                  </div>
                )}
                {scanError && <p className="text-xs text-red-400">{scanError}</p>}
              </div>
            </div>
          )}

          {/* Manual entry form (always shown when manual tab or after selecting food) */}
          {(activeTab === "manual" || nombre) && (
            <div className="space-y-3 pt-2 border-t border-white/[.06]">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Nombre</label>
                  <input
                    type="text"
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand/50"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Marca</label>
                  <input
                    type="text"
                    value={marca}
                    onChange={(e) => setMarca(e.target.value)}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand/50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1">Gramos</label>
                <input
                  type="number"
                  value={gramos}
                  onChange={(e) => setGramos(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand/50"
                  min="1"
                  max="5000"
                  step="10"
                />
              </div>

              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: "Kcal/100g", value: kcal100, set: setKcal100 },
                  { label: "Prot/100g", value: prot100, set: setProt100 },
                  { label: "Carbs/100g", value: carbs100, set: setCarbs100 },
                  { label: "Grasas/100g", value: grasas100, set: setGrasas100 },
                ].map((field) => (
                  <div key={field.label}>
                    <label className="block text-xs text-gray-400 mb-1">{field.label}</label>
                    <input
                      type="number"
                      value={field.value}
                      onChange={(e) => field.set(e.target.value)}
                      className="w-full px-2 py-2 bg-background border border-border rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand/50"
                      min="0"
                      step="0.1"
                    />
                  </div>
                ))}
              </div>

              {/* Preview */}
              {nombre && gramos && kcal100 && (
                <div className="text-xs text-gray-400 bg-background rounded-lg p-2 nums">
                  Total: {Math.round((parseFloat(kcal100) * parseFloat(gramos)) / 100)} kcal |
                  P: {Math.round(((parseFloat(prot100) || 0) * parseFloat(gramos)) / 100)}g |
                  C: {Math.round(((parseFloat(carbs100) || 0) * parseFloat(gramos)) / 100)}g |
                  G: {Math.round(((parseFloat(grasas100) || 0) * parseFloat(gramos)) / 100)}g
                </div>
              )}

              <label className="flex items-center gap-2 text-sm text-gray-400">
                <input
                  type="checkbox"
                  checked={saveToCatalog}
                  onChange={(e) => setSaveToCatalog(e.target.checked)}
                  className="rounded border-border bg-background"
                />
                Guardar en catalogo
              </label>

              <button
                onClick={handleAddFood}
                disabled={!nombre.trim()}
                className="w-full py-2.5 bg-brand hover:bg-brand-500 disabled:opacity-50 text-white font-medium rounded-lg transition-colors"
              >
                Añadir comida
              </button>
            </div>
          )}
        </div>
      )}

      {/* Weekly averages */}
      <div className="bg-surface-1 rounded-xl border border-white/[.06] p-4">
        <h3 className="text-sm font-medium text-gray-400 mb-3">Promedios ultimos 7 dias</h3>
        <MacroDisplay
          kcal={weeklyAvg.kcal}
          proteinas={weeklyAvg.prot}
          carbs={weeklyAvg.carbs}
          grasas={weeklyAvg.grasas}
          compact
        />
      </div>
    </div>
  );
}
