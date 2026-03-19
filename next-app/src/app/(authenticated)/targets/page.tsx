"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  getActiveTargets,
  getTargetsHistory,
  saveTargets,
  getActiveCoachPlan,
  updateCoachPlan,
  getDaySchedule,
  saveDaySchedule,
} from "@/lib/db";
import { PRESET_MAP, calculateMacroGrams } from "@/lib/algorithms/adaptive-coach";
import type { Targets, CoachPlan, DayTypeSchedule } from "@/lib/types";
import { todayISO, formatDateDisplay } from "@/lib/utils";
import MacroDisplay from "@/components/macro-display";

const DAY_NAMES = ["Lun", "Mar", "Mie", "Jue", "Vie", "Sab", "Dom"];

export default function TargetsPage() {
  const supabase = createClient();
  const [userId, setUserId] = useState("");
  const [currentTargets, setCurrentTargets] = useState<Targets | null>(null);
  const [history, setHistory] = useState<Targets[]>([]);
  const [plan, setPlan] = useState<CoachPlan | null>(null);
  const [schedule, setSchedule] = useState<DayTypeSchedule[]>([]);

  // Form
  const [presetKey, setPresetKey] = useState("manual");
  const [kcal, setKcal] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");
  const [fiber, setFiber] = useState("");
  const [sugar, setSugar] = useState("");
  const [satFat, setSatFat] = useState("");
  const [sodium, setSodium] = useState("");
  const [validFrom, setValidFrom] = useState(todayISO());
  const [notes, setNotes] = useState("");
  const [showMicros, setShowMicros] = useState(false);

  // Cycling
  const [cyclingEnabled, setCyclingEnabled] = useState(false);
  const [trainingDays, setTrainingDays] = useState<boolean[]>([false, false, false, false, false, false, false]);

  // Training/rest targets
  const [trainingKcal, setTrainingKcal] = useState("");
  const [trainingProtein, setTrainingProtein] = useState("");
  const [trainingCarbs, setTrainingCarbs] = useState("");
  const [trainingFat, setTrainingFat] = useState("");
  const [restKcal, setRestKcal] = useState("");
  const [restProtein, setRestProtein] = useState("");
  const [restCarbs, setRestCarbs] = useState("");
  const [restFat, setRestFat] = useState("");

  const loadData = useCallback(async (uid: string) => {
    const [tgt, hist, coachPlan, sched] = await Promise.all([
      getActiveTargets(supabase, uid),
      getTargetsHistory(supabase, uid),
      getActiveCoachPlan(supabase, uid),
      getDaySchedule(supabase, uid),
    ]);
    setCurrentTargets(tgt);
    setHistory(hist);
    setPlan(coachPlan);
    setSchedule(sched);

    if (tgt) {
      setKcal(String(tgt.kcal_target));
      setProtein(tgt.protein_target ? String(tgt.protein_target) : "");
      setCarbs(tgt.carbs_target ? String(tgt.carbs_target) : "");
      setFat(tgt.fat_target ? String(tgt.fat_target) : "");
      setFiber(tgt.fiber_target ? String(tgt.fiber_target) : "");
      setSugar(tgt.sugar_limit ? String(tgt.sugar_limit) : "");
      setSatFat(tgt.saturated_fat_limit ? String(tgt.saturated_fat_limit) : "");
      setSodium(tgt.sodium_limit ? String(tgt.sodium_limit) : "");
    }

    if (sched.length > 0) {
      setCyclingEnabled(true);
      const days = [false, false, false, false, false, false, false];
      sched.forEach((s) => {
        if (s.day_type === "training") days[s.day_of_week] = true;
      });
      setTrainingDays(days);
    }
  }, [supabase]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUserId(user.id);
        loadData(user.id);
      }
    });
  }, [loadData, supabase.auth]);

  // Apply preset
  useEffect(() => {
    if (presetKey !== "manual" && kcal) {
      const preset = PRESET_MAP[presetKey];
      if (preset) {
        const macros = calculateMacroGrams(preset, parseInt(kcal));
        setProtein(String(macros.protein));
        setCarbs(String(macros.carbs));
        setFat(String(macros.fat));
      }
    }
  }, [presetKey, kcal]);

  async function handleSave() {
    const kcalVal = parseInt(kcal);
    if (!kcalVal) return;

    // Save default targets
    await saveTargets(supabase, userId, validFrom, kcalVal, {
      proteinTarget: protein ? parseFloat(protein) : null,
      carbsTarget: carbs ? parseFloat(carbs) : null,
      fatTarget: fat ? parseFloat(fat) : null,
      fiberTarget: fiber ? parseFloat(fiber) : null,
      sugarLimit: sugar ? parseFloat(sugar) : null,
      saturatedFatLimit: satFat ? parseFloat(satFat) : null,
      sodiumLimit: sodium ? parseFloat(sodium) : null,
      notes: notes || null,
      dayType: cyclingEnabled ? "default" : "default",
    });

    // Save cycling targets if enabled
    if (cyclingEnabled && trainingKcal && restKcal) {
      await saveTargets(supabase, userId, validFrom, parseInt(trainingKcal), {
        proteinTarget: trainingProtein ? parseFloat(trainingProtein) : null,
        carbsTarget: trainingCarbs ? parseFloat(trainingCarbs) : null,
        fatTarget: trainingFat ? parseFloat(trainingFat) : null,
        dayType: "training",
      });
      await saveTargets(supabase, userId, validFrom, parseInt(restKcal), {
        proteinTarget: restProtein ? parseFloat(restProtein) : null,
        carbsTarget: restCarbs ? parseFloat(restCarbs) : null,
        fatTarget: restFat ? parseFloat(restFat) : null,
        dayType: "rest",
      });

      // Save schedule
      const sched = trainingDays.map((isTraining, i) => ({
        dayOfWeek: i,
        dayType: isTraining ? "training" as const : "rest" as const,
      }));
      await saveDaySchedule(supabase, userId, sched);
    }

    // Sync with coach plan if active
    if (plan) {
      await updateCoachPlan(supabase, plan.id, { current_kcal_target: kcalVal } as Partial<CoachPlan>);
    }

    await loadData(userId);
  }

  // Quick split for cycling
  function handleQuickSplit(pct: number) {
    const baseKcal = parseInt(kcal) || 2000;
    const trainingDaysCount = trainingDays.filter(Boolean).length || 3;
    const restDaysCount = 7 - trainingDaysCount;

    const boost = Math.round(baseKcal * pct / 100);
    const tKcal = baseKcal + boost;
    const rKcal = Math.round(baseKcal - (boost * trainingDaysCount / restDaysCount));

    setTrainingKcal(String(tKcal));
    setRestKcal(String(rKcal));

    if (presetKey !== "manual") {
      const preset = PRESET_MAP[presetKey] || PRESET_MAP.balanced;
      const tMacros = calculateMacroGrams(preset, tKcal);
      setTrainingProtein(String(tMacros.protein));
      setTrainingCarbs(String(tMacros.carbs));
      setTrainingFat(String(tMacros.fat));
      const rMacros = calculateMacroGrams(preset, rKcal);
      setRestProtein(String(rMacros.protein));
      setRestCarbs(String(rMacros.carbs));
      setRestFat(String(rMacros.fat));
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Targets</h1>

      {/* Current targets */}
      {currentTargets && (
        <div className="bg-surface rounded-xl border border-border p-4">
          <h2 className="font-medium mb-3">Objetivos actuales</h2>
          <MacroDisplay
            kcal={currentTargets.kcal_target}
            proteinas={currentTargets.protein_target || 0}
            carbs={currentTargets.carbs_target || 0}
            grasas={currentTargets.fat_target || 0}
          />
          {(currentTargets.fiber_target || currentTargets.sugar_limit || currentTargets.saturated_fat_limit || currentTargets.sodium_limit) && (
            <div className="mt-3 pt-3 border-t border-border grid grid-cols-4 gap-2 text-sm">
              {currentTargets.fiber_target && <div><span className="text-gray-400">Fibra:</span> {currentTargets.fiber_target}g</div>}
              {currentTargets.sugar_limit && <div><span className="text-gray-400">Azucar:</span> &lt;{currentTargets.sugar_limit}g</div>}
              {currentTargets.saturated_fat_limit && <div><span className="text-gray-400">Gr.sat:</span> &lt;{currentTargets.saturated_fat_limit}g</div>}
              {currentTargets.sodium_limit && <div><span className="text-gray-400">Sodio:</span> &lt;{currentTargets.sodium_limit}g</div>}
            </div>
          )}
        </div>
      )}

      {/* Edit form */}
      <div className="bg-surface rounded-xl border border-border p-4 space-y-4">
        <h2 className="font-medium">Editar targets</h2>

        <div>
          <label className="block text-sm text-gray-400 mb-1">Preset rapido</label>
          <select value={presetKey} onChange={(e) => setPresetKey(e.target.value)} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-white">
            <option value="manual">Manual</option>
            {Object.entries(PRESET_MAP).map(([key, p]) => (
              <option key={key} value={key}>{p.displayName} — {p.description}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-1">Kcal objetivo</label>
          <input type="number" value={kcal} onChange={(e) => setKcal(e.target.value)} min="1000" max="6000" step="50" className="w-full px-3 py-2 bg-background border border-border rounded-lg text-white" />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Proteinas (g)</label>
            <input type="number" value={protein} onChange={(e) => setProtein(e.target.value)} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-white" />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Carbs (g)</label>
            <input type="number" value={carbs} onChange={(e) => setCarbs(e.target.value)} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-white" />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Grasas (g)</label>
            <input type="number" value={fat} onChange={(e) => setFat(e.target.value)} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-white" />
          </div>
        </div>

        {/* Micros */}
        <button onClick={() => setShowMicros(!showMicros)} className="text-sm text-gray-400 hover:text-white">
          {showMicros ? "Ocultar" : "Mostrar"} micronutrientes
        </button>
        {showMicros && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Fibra objetivo (g)</label>
              <input type="number" value={fiber} onChange={(e) => setFiber(e.target.value)} placeholder="25" className="w-full px-3 py-2 bg-background border border-border rounded-lg text-white text-sm" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Limite azucar (g)</label>
              <input type="number" value={sugar} onChange={(e) => setSugar(e.target.value)} placeholder="50" className="w-full px-3 py-2 bg-background border border-border rounded-lg text-white text-sm" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Limite grasa sat (g)</label>
              <input type="number" value={satFat} onChange={(e) => setSatFat(e.target.value)} placeholder="20" className="w-full px-3 py-2 bg-background border border-border rounded-lg text-white text-sm" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Limite sodio (g)</label>
              <input type="number" value={sodium} onChange={(e) => setSodium(e.target.value)} step="0.1" placeholder="2.3" className="w-full px-3 py-2 bg-background border border-border rounded-lg text-white text-sm" />
            </div>
          </div>
        )}

        {/* Macro Cycling */}
        <div className="pt-3 border-t border-border space-y-3">
          <label className="flex items-center gap-3 cursor-pointer">
            <div className={`w-10 h-6 rounded-full relative transition-colors ${cyclingEnabled ? "bg-brand" : "bg-border"}`} onClick={() => setCyclingEnabled(!cyclingEnabled)}>
              <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${cyclingEnabled ? "translate-x-5" : "translate-x-1"}`} />
            </div>
            <span className="text-sm font-medium">Macro cycling (entrenamiento/descanso)</span>
          </label>

          {cyclingEnabled && (
            <div className="space-y-3 pl-1">
              <p className="text-xs text-gray-400">Marca tus dias de entrenamiento:</p>
              <div className="flex gap-2">
                {DAY_NAMES.map((day, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      const newDays = [...trainingDays];
                      newDays[i] = !newDays[i];
                      setTrainingDays(newDays);
                    }}
                    className={`w-10 h-10 rounded-lg text-xs font-medium transition-colors ${
                      trainingDays[i]
                        ? "bg-green-600 text-white"
                        : "bg-background text-gray-500 border border-border"
                    }`}
                  >
                    {day}
                  </button>
                ))}
              </div>

              <div className="flex gap-2">
                <button onClick={() => handleQuickSplit(10)} className="text-xs px-2 py-1 bg-background border border-border rounded text-gray-400 hover:text-white">+10% training</button>
                <button onClick={() => handleQuickSplit(15)} className="text-xs px-2 py-1 bg-background border border-border rounded text-gray-400 hover:text-white">+15% training</button>
                <button onClick={() => handleQuickSplit(20)} className="text-xs px-2 py-1 bg-background border border-border rounded text-gray-400 hover:text-white">+20% training</button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <h4 className="text-xs font-medium text-green-400">Entrenamiento</h4>
                  <input type="number" value={trainingKcal} onChange={(e) => setTrainingKcal(e.target.value)} placeholder="Kcal" className="w-full px-2 py-1.5 bg-background border border-border rounded text-white text-sm" />
                  <div className="grid grid-cols-3 gap-1">
                    <input type="number" value={trainingProtein} onChange={(e) => setTrainingProtein(e.target.value)} placeholder="P" className="px-2 py-1 bg-background border border-border rounded text-white text-xs" />
                    <input type="number" value={trainingCarbs} onChange={(e) => setTrainingCarbs(e.target.value)} placeholder="C" className="px-2 py-1 bg-background border border-border rounded text-white text-xs" />
                    <input type="number" value={trainingFat} onChange={(e) => setTrainingFat(e.target.value)} placeholder="G" className="px-2 py-1 bg-background border border-border rounded text-white text-xs" />
                  </div>
                </div>
                <div className="space-y-2">
                  <h4 className="text-xs font-medium text-blue-400">Descanso</h4>
                  <input type="number" value={restKcal} onChange={(e) => setRestKcal(e.target.value)} placeholder="Kcal" className="w-full px-2 py-1.5 bg-background border border-border rounded text-white text-sm" />
                  <div className="grid grid-cols-3 gap-1">
                    <input type="number" value={restProtein} onChange={(e) => setRestProtein(e.target.value)} placeholder="P" className="px-2 py-1 bg-background border border-border rounded text-white text-xs" />
                    <input type="number" value={restCarbs} onChange={(e) => setRestCarbs(e.target.value)} placeholder="C" className="px-2 py-1 bg-background border border-border rounded text-white text-xs" />
                    <input type="number" value={restFat} onChange={(e) => setRestFat(e.target.value)} placeholder="G" className="px-2 py-1 bg-background border border-border rounded text-white text-xs" />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Valido desde</label>
            <input type="date" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-white" />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Notas</label>
            <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Opcional" className="w-full px-3 py-2 bg-background border border-border rounded-lg text-white text-sm" />
          </div>
        </div>

        <button onClick={handleSave} className="w-full sm:w-auto px-6 py-2.5 bg-brand hover:bg-brand-500 text-white font-medium rounded-lg">
          Guardar targets
        </button>
      </div>

      {/* History */}
      {history.length > 0 && (
        <div className="bg-surface rounded-xl border border-border overflow-hidden">
          <div className="p-4 border-b border-border">
            <h2 className="font-medium">Historial de targets</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 border-b border-border">
                  <th className="text-left p-3">Desde</th>
                  <th className="text-left p-3">Tipo</th>
                  <th className="text-right p-3">Kcal</th>
                  <th className="text-right p-3">P</th>
                  <th className="text-right p-3">C</th>
                  <th className="text-right p-3">G</th>
                  <th className="text-left p-3">Notas</th>
                </tr>
              </thead>
              <tbody>
                {history.map((t) => (
                  <tr key={t.id} className="border-b border-border/50">
                    <td className="p-3">{formatDateDisplay(t.valid_from)}</td>
                    <td className="p-3">
                      {t.day_type === "training" ? (
                        <span className="text-xs px-1.5 py-0.5 bg-green-400/20 text-green-400 rounded">train</span>
                      ) : t.day_type === "rest" ? (
                        <span className="text-xs px-1.5 py-0.5 bg-blue-400/20 text-blue-400 rounded">rest</span>
                      ) : (
                        <span className="text-xs text-gray-500">default</span>
                      )}
                    </td>
                    <td className="p-3 text-right">{t.kcal_target}</td>
                    <td className="p-3 text-right">{t.protein_target || "—"}</td>
                    <td className="p-3 text-right">{t.carbs_target || "—"}</td>
                    <td className="p-3 text-right">{t.fat_target || "—"}</td>
                    <td className="p-3 text-gray-500 truncate max-w-[100px]">{t.notes || ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
