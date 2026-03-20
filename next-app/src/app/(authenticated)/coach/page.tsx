"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  getActiveCoachPlan,
  saveCoachPlan,
  updateCoachPlan,
  getActiveTargets,
  saveTargets,
  saveCheckin,
  getCheckinHistory,
  getWeightEntries,
  getFoodDailyTotals,
} from "@/lib/db";
import {
  PRESET_MAP,
  calculateMacroGrams,
  getDailyAdjustment,
  calculateCheckin,
  buildWeeklyData,
} from "@/lib/algorithms/adaptive-coach";
import { calculateWeightTrend } from "@/lib/algorithms/weight-trend";
import { calculateProjection, generateGoalLine } from "@/lib/algorithms/goal-projection";
import type { CoachPlan, Targets, CheckinHistory } from "@/lib/types";
import type { CheckInResult } from "@/lib/algorithms/adaptive-coach";
import type { GoalProjection } from "@/lib/algorithms/goal-projection";
import { todayISO } from "@/lib/utils";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";

export default function CoachPage() {
  const supabase = createClient();
  const [userId, setUserId] = useState("");
  const [plan, setPlan] = useState<CoachPlan | null>(null);
  const [targets, setTargets] = useState<Targets | null>(null);
  const [checkins, setCheckins] = useState<CheckinHistory[]>([]);
  const [projection, setProjection] = useState<GoalProjection | null>(null);
  const [checkinResult, setCheckinResult] = useState<CheckInResult | null>(null);
  const [loading, setLoading] = useState(true);

  // Setup form
  const [goal, setGoal] = useState("lose");
  const [targetWeight, setTargetWeight] = useState("");
  const [weeklyRate, setWeeklyRate] = useState("0.5");
  const [initialTdee, setInitialTdee] = useState("2200");
  const [currentWeight, setCurrentWeight] = useState("");
  const [preset, setPreset] = useState("balanced");

  const loadData = useCallback(async (uid: string) => {
    const [coachPlan, tgt, chk] = await Promise.all([
      getActiveCoachPlan(supabase, uid),
      getActiveTargets(supabase, uid),
      getCheckinHistory(supabase, uid),
    ]);
    setPlan(coachPlan);
    setTargets(tgt);
    setCheckins(chk);

    if (coachPlan) {
      const weights = await getWeightEntries(supabase, uid);
      const trendEntries = weights.filter((w) => w.peso != null);
      if (trendEntries.length >= 3) {
        const trendResult = calculateWeightTrend(trendEntries);
        setProjection(calculateProjection(coachPlan, trendResult));
      }
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUserId(user.id);
        loadData(user.id);
      }
    });
  }, [loadData, supabase.auth]);

  async function handleSetup(e: React.FormEvent) {
    e.preventDefault();
    const today = todayISO();
    const goalCode = goal as "lose" | "maintain" | "gain";
    const rate = goalCode === "maintain" ? 0 : parseFloat(weeklyRate);
    const tdee = parseInt(initialTdee);
    const weight = parseFloat(currentWeight);
    const target = goalCode === "maintain" ? null : (targetWeight ? parseFloat(targetWeight) : null);

    const planId = await saveCoachPlan(supabase, userId, goalCode, rate, tdee, weight, target, today, preset);

    const adj = getDailyAdjustment(goalCode, rate);
    const targetKcal = tdee + adj;
    const macros = calculateMacroGrams(PRESET_MAP[preset] || PRESET_MAP.balanced, targetKcal);

    await saveTargets(supabase, userId, today, targetKcal, {
      proteinTarget: macros.protein,
      carbsTarget: macros.carbs,
      fatTarget: macros.fat,
      notes: `Plan coach: ${goalCode} ${rate}kg/sem`,
    });

    await loadData(userId);
  }

  async function handleCheckin() {
    if (!plan) return;

    const today = new Date();
    const endDate = todayISO();
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - 7);
    const startStr = startDate.toISOString().split("T")[0];

    const [weights, foodTotals] = await Promise.all([
      getWeightEntries(supabase, userId),
      getFoodDailyTotals(supabase, userId, startStr, endDate),
    ]);

    const weeklyData = buildWeeklyData(weights, foodTotals, startStr, endDate);
    const result = calculateCheckin(plan, weeklyData);
    setCheckinResult(result);
  }

  async function applyCheckin() {
    if (!checkinResult || !plan || checkinResult.status !== "ready") return;
    const today = todayISO();

    await saveTargets(supabase, userId, today, checkinResult.proposedKcalTarget, {
      proteinTarget: checkinResult.proposedMacros.protein,
      carbsTarget: checkinResult.proposedMacros.carbs,
      fatTarget: checkinResult.proposedMacros.fat,
      notes: `Check-in: TDEE ${checkinResult.estimatedTdee}`,
    });

    await updateCoachPlan(supabase, plan.id, {
      current_kcal_target: checkinResult.proposedKcalTarget,
      last_checkin_date: today,
    } as Partial<CoachPlan>);

    await saveCheckin(
      supabase, userId, today,
      checkinResult.estimatedTdee,
      checkinResult.weeklyData.avgDailyKcal,
      checkinResult.weeklyData.trendWeightStart,
      checkinResult.weeklyData.trendWeightEnd,
      checkinResult.proposedKcalTarget,
      true
    );

    setCheckinResult(null);
    await loadData(userId);
  }

  async function dismissCheckin() {
    if (!checkinResult || !plan) return;
    const today = todayISO();

    await updateCoachPlan(supabase, plan.id, {
      last_checkin_date: today,
    } as Partial<CoachPlan>);

    await saveCheckin(
      supabase, userId, today,
      checkinResult.estimatedTdee,
      checkinResult.weeklyData.avgDailyKcal,
      checkinResult.weeklyData.trendWeightStart,
      checkinResult.weeklyData.trendWeightEnd,
      checkinResult.proposedKcalTarget,
      false
    );

    setCheckinResult(null);
    await loadData(userId);
  }

  async function resetPlan() {
    if (!plan || !confirm("Seguro que quieres resetear el plan?")) return;
    await updateCoachPlan(supabase, plan.id, { active: false } as Partial<CoachPlan>);
    setPlan(null);
    setProjection(null);
    setCheckinResult(null);
  }

  if (loading) return <div className="text-gray-500">Cargando...</div>;

  const daysSinceCheckin = plan?.last_checkin_date
    ? Math.floor((Date.now() - new Date(plan.last_checkin_date + "T00:00:00").getTime()) / (1000 * 60 * 60 * 24))
    : 999;

  const goalLabels: Record<string, string> = { lose: "Perder peso", maintain: "Mantener", gain: "Ganar peso" };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Coach Adaptativo</h1>

      {/* Setup form (no plan) */}
      {!plan && (
        <form onSubmit={handleSetup} className="bg-surface rounded-xl border border-border p-4 space-y-4">
          <h2 className="font-medium">Configurar tu plan</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Objetivo</label>
              <select value={goal} onChange={(e) => setGoal(e.target.value)} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-white">
                <option value="lose">Perder peso</option>
                <option value="maintain">Mantener peso</option>
                <option value="gain">Ganar peso</option>
              </select>
            </div>
            {goal !== "maintain" && (
              <div>
                <label className="block text-sm text-gray-400 mb-1">Peso objetivo (kg)</label>
                <input type="number" value={targetWeight} onChange={(e) => setTargetWeight(e.target.value)} step="0.1" min="30" max="300" className="w-full px-3 py-2 bg-background border border-border rounded-lg text-white" />
              </div>
            )}
            {goal !== "maintain" && (
              <div>
                <label className="block text-sm text-gray-400 mb-1">Velocidad (kg/semana)</label>
                <input type="number" value={weeklyRate} onChange={(e) => setWeeklyRate(e.target.value)} step="0.1" min="0" max="1.5" className="w-full px-3 py-2 bg-background border border-border rounded-lg text-white" />
              </div>
            )}
            <div>
              <label className="block text-sm text-gray-400 mb-1">TDEE estimado inicial</label>
              <input type="number" value={initialTdee} onChange={(e) => setInitialTdee(e.target.value)} step="50" min="1000" max="6000" className="w-full px-3 py-2 bg-background border border-border rounded-lg text-white" />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Peso actual (kg)</label>
              <input type="number" value={currentWeight} onChange={(e) => setCurrentWeight(e.target.value)} step="0.1" min="30" max="300" required className="w-full px-3 py-2 bg-background border border-border rounded-lg text-white" />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Preset macros</label>
              <select value={preset} onChange={(e) => setPreset(e.target.value)} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-white">
                {Object.entries(PRESET_MAP).map(([key, p]) => (
                  <option key={key} value={key}>{p.displayName}</option>
                ))}
              </select>
            </div>
          </div>
          <button type="submit" className="w-full sm:w-auto px-6 py-2.5 bg-brand hover:bg-brand-500 text-white font-medium rounded-lg">
            Crear plan
          </button>
        </form>
      )}

      {/* Active plan dashboard */}
      {plan && (
        <>
          <div className="bg-surface rounded-xl border border-border p-4">
            <h2 className="font-medium mb-3">Tu plan</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <p className="text-xs text-gray-400">Objetivo</p>
                <p className="font-bold">{goalLabels[plan.goal]}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Velocidad</p>
                <p className="font-bold">{plan.goal === "maintain" ? "Mantenimiento" : `${plan.weekly_rate_kg} kg/sem`}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Target kcal</p>
                <p className="font-bold text-brand">{plan.current_kcal_target}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Preset</p>
                <p className="font-bold">{PRESET_MAP[plan.macro_preset]?.displayName || plan.macro_preset}</p>
              </div>
            </div>
            {targets && (
              <div className="mt-3 pt-3 border-t border-border">
                <p className="text-xs text-gray-400 mb-1">Macros diarios</p>
                <div className="flex gap-4 text-sm">
                  <span className="text-orange-400">{targets.kcal_target} kcal</span>
                  <span className="text-blue-400">{targets.protein_target}g prot</span>
                  <span className="text-yellow-400">{targets.carbs_target}g carbs</span>
                  <span className="text-pink-400">{targets.fat_target}g grasas</span>
                </div>
              </div>
            )}
          </div>

          {/* Projection */}
          {projection && (
            <div className="bg-surface rounded-xl border border-border p-4">
              <h2 className="font-medium mb-3">Proyeccion</h2>
              <div className="grid grid-cols-3 gap-3 mb-3">
                <div>
                  <p className="text-xs text-gray-400">Peso tendencia</p>
                  <p className="font-bold">{projection.currentTrendWeight.toFixed(1)} kg</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Meta</p>
                  <p className="font-bold">{projection.goalWeightKg} kg</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Progreso</p>
                  <p className="font-bold">{projection.progressPercentage.toFixed(0)}%</p>
                </div>
              </div>
              <div className="h-2 bg-border rounded-full overflow-hidden mb-2">
                <div className="h-full bg-brand rounded-full" style={{ width: `${Math.min(100, projection.progressPercentage)}%` }} />
              </div>
              <p className="text-xs text-gray-500">{projection.progressMessage}</p>
              <p className="text-xs text-gray-500">{projection.paceMessage}</p>
            </div>
          )}

          {/* Check-in */}
          <div className="bg-surface rounded-xl border border-border p-4 space-y-3">
            <h2 className="font-medium">Check-in semanal</h2>
            <p className="text-sm text-gray-400">
              Ultimo check-in: {plan.last_checkin_date || "Nunca"} ({daysSinceCheckin} dias)
            </p>

            {!checkinResult && daysSinceCheckin >= 7 && (
              <button onClick={handleCheckin} className="px-4 py-2 bg-brand hover:bg-brand-500 text-white font-medium rounded-lg">
                Hacer check-in semanal
              </button>
            )}

            {!checkinResult && daysSinceCheckin < 7 && (
              <p className="text-sm text-yellow-400">Espera {7 - daysSinceCheckin} dias mas para el proximo check-in</p>
            )}

            {checkinResult && (
              <div className="space-y-3">
                {checkinResult.status === "ready" ? (
                  <>
                    <div className="bg-green-400/10 border border-green-400/20 rounded-lg p-3 space-y-1">
                      {checkinResult.explanation.allLines.map((line, i) => (
                        <p key={i} className="text-sm">{line}</p>
                      ))}
                    </div>
                    {checkinResult.wasClamped && (
                      <p className="text-xs text-yellow-400">El cambio fue limitado por seguridad (max ±200 kcal/semana)</p>
                    )}
                    <p className="text-sm">Macros propuestos: P:{checkinResult.proposedMacros.protein}g C:{checkinResult.proposedMacros.carbs}g G:{checkinResult.proposedMacros.fat}g</p>
                    <div className="flex gap-3">
                      <button onClick={applyCheckin} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm">
                        Aplicar cambios
                      </button>
                      <button onClick={dismissCheckin} className="px-4 py-2 bg-surface-hover text-gray-400 hover:text-white rounded-lg text-sm">
                        Descartar
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="bg-yellow-400/10 border border-yellow-400/20 rounded-lg p-3">
                    <p className="text-sm text-yellow-400">{checkinResult.errorMessage}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Check-in history */}
          {checkins.length > 0 && (
            <div className="bg-surface rounded-xl border border-border overflow-hidden">
              <div className="p-4 border-b border-border">
                <h2 className="font-medium">Historial de check-ins</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-gray-400 border-b border-border">
                      <th className="text-left p-3">Fecha</th>
                      <th className="text-right p-3">TDEE</th>
                      <th className="text-right p-3">Kcal prom</th>
                      <th className="text-right p-3">Target</th>
                      <th className="text-center p-3">Aplicado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {checkins.map((c) => (
                      <tr key={c.id} className="border-b border-border/50">
                        <td className="p-3">{c.checkin_date}</td>
                        <td className="p-3 text-right">{c.estimated_tdee}</td>
                        <td className="p-3 text-right">{Math.round(c.avg_daily_kcal)}</td>
                        <td className="p-3 text-right">{c.proposed_kcal_target}</td>
                        <td className="p-3 text-center">{c.applied ? "Si" : "No"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Reset */}
          <details className="bg-surface rounded-xl border border-border p-4">
            <summary className="cursor-pointer text-sm text-gray-400">Opciones avanzadas</summary>
            <div className="mt-3">
              <button onClick={resetPlan} className="px-4 py-2 bg-red-600/20 text-red-400 hover:bg-red-600/30 rounded-lg text-sm">
                Resetear plan
              </button>
            </div>
          </details>
        </>
      )}
    </div>
  );
}
