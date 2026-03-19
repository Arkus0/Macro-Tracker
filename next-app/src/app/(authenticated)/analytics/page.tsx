"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { getWeightEntries, getFoodDailyTotals, getActiveTargets, getActiveCoachPlan, getCheckinHistory } from "@/lib/db";
import { calculateWeightTrend } from "@/lib/algorithms/weight-trend";
import { calculateProjection } from "@/lib/algorithms/goal-projection";
import type { WeightEntry, FoodDailyTotals, Targets, CoachPlan, CheckinHistory } from "@/lib/types";
import type { WeightTrendResult } from "@/lib/algorithms/weight-trend";
import type { GoalProjection } from "@/lib/algorithms/goal-projection";
import MacroDisplay from "@/components/macro-display";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { Download, TrendingDown, TrendingUp, Minus } from "lucide-react";

export default function AnalyticsPage() {
  const supabase = createClient();
  const [userId, setUserId] = useState("");
  const [weightEntries, setWeightEntries] = useState<WeightEntry[]>([]);
  const [foodTotals, setFoodTotals] = useState<FoodDailyTotals[]>([]);
  const [targets, setTargets] = useState<Targets | null>(null);
  const [plan, setPlan] = useState<CoachPlan | null>(null);
  const [checkins, setCheckins] = useState<CheckinHistory[]>([]);
  const [trend, setTrend] = useState<WeightTrendResult | null>(null);
  const [projection, setProjection] = useState<GoalProjection | null>(null);

  const loadData = useCallback(async (uid: string) => {
    const [weights, food, tgt, coachPlan, chk] = await Promise.all([
      getWeightEntries(supabase, uid),
      getFoodDailyTotals(supabase, uid),
      getActiveTargets(supabase, uid),
      getActiveCoachPlan(supabase, uid),
      getCheckinHistory(supabase, uid),
    ]);
    setWeightEntries(weights);
    setFoodTotals(food);
    setTargets(tgt);
    setPlan(coachPlan);
    setCheckins(chk);

    const trendEntries = weights.filter((w) => w.peso != null);
    if (trendEntries.length >= 2) {
      const trendResult = calculateWeightTrend(trendEntries);
      setTrend(trendResult);
      if (coachPlan) {
        setProjection(calculateProjection(coachPlan, trendResult));
      }
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

  // TDEE calculation (28-day window)
  const tdee = useMemo(() => {
    if (!trend || foodTotals.length < 7) return null;
    const last28 = foodTotals.slice(-28);
    const avgKcal = last28.reduce((s, f) => s + f.kcal, 0) / last28.length;
    const trendWeights = weightEntries.filter((w) => w.peso != null);
    if (trendWeights.length < 7) return null;
    const recent = trendWeights.slice(-28);
    const first = recent[0].peso!;
    const last = recent[recent.length - 1].peso!;
    const days = Math.max(1, recent.length - 1);
    const changeKg = last - first;
    return Math.round(avgKcal - (changeKg * 7700) / days);
  }, [trend, foodTotals, weightEntries]);

  // Weight chart data
  const weightChartData = useMemo(() => {
    if (!trend || !weightEntries.length) return [];
    const trendEntries = weightEntries.filter((w) => w.peso != null);
    return trendEntries.map((w, i) => ({
      fecha: w.fecha,
      peso: w.peso,
      tendencia: trend.emaHistory[i] ? Math.round(trend.emaHistory[i] * 10) / 10 : undefined,
    }));
  }, [weightEntries, trend]);

  // Kcal chart data
  const kcalChartData = useMemo(() => {
    return foodTotals.slice(-60).map((f) => ({
      fecha: f.fecha,
      kcal: Math.round(f.kcal),
      tdee: tdee || undefined,
      target: targets?.kcal_target || undefined,
    }));
  }, [foodTotals, tdee, targets]);

  // Adherence
  const adherenceData = useMemo(() => {
    if (!targets || foodTotals.length === 0) return { onTarget: 0, close: 0, out: 0, total: 0 };
    let onTarget = 0, close = 0, out = 0;
    for (const f of foodTotals.slice(-30)) {
      const deviation = Math.abs(f.kcal - targets.kcal_target) / targets.kcal_target;
      if (deviation <= 0.1) onTarget++;
      else if (deviation <= 0.25) close++;
      else out++;
    }
    return { onTarget, close, out, total: onTarget + close + out };
  }, [targets, foodTotals]);

  // Weekly macro averages
  const weeklyAvg = useMemo(() => {
    const last7 = foodTotals.slice(-7);
    if (last7.length === 0) return null;
    return {
      kcal: last7.reduce((s, f) => s + f.kcal, 0) / last7.length,
      prot: last7.reduce((s, f) => s + f.proteinas, 0) / last7.length,
      carbs: last7.reduce((s, f) => s + f.carbs, 0) / last7.length,
      grasas: last7.reduce((s, f) => s + f.grasas, 0) / last7.length,
    };
  }, [foodTotals]);

  // Export
  function exportCSV(data: Record<string, unknown>[], filename: string) {
    if (data.length === 0) return;
    const headers = Object.keys(data[0]);
    const csv = [headers.join(","), ...data.map((row) => headers.map((h) => row[h] ?? "").join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  const PhaseIcon = trend?.phase === "losing" ? TrendingDown : trend?.phase === "gaining" ? TrendingUp : Minus;
  const phaseLabel = trend?.phase === "losing" ? "Perdiendo peso" : trend?.phase === "gaining" ? "Ganando peso" : trend?.phase === "maintaining" ? "Manteniendo" : "Datos insuficientes";
  const phaseColor = trend?.phase === "losing" ? "text-green-400" : trend?.phase === "gaining" ? "text-red-400" : "text-yellow-400";

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Analytics</h1>

      {/* Key metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MetricCard label="Peso tendencia" value={trend ? `${trend.emaWeight.toFixed(1)} kg` : "—"} />
        <MetricCard label="TDEE dinamico" value={tdee ? `${tdee} kcal` : "—"} />
        <MetricCard label="Kcal prom (4w)" value={
          foodTotals.length > 0
            ? `${Math.round(foodTotals.slice(-28).reduce((s, f) => s + f.kcal, 0) / Math.min(28, foodTotals.length))}`
            : "—"
        } />
        <MetricCard
          label="Fase"
          value={phaseLabel}
          icon={<PhaseIcon size={16} className={phaseColor} />}
        />
      </div>

      {/* Predictions */}
      {trend && trend.phase !== "insufficient_data" && (
        <div className="grid grid-cols-2 gap-3">
          <MetricCard label="Prediccion 7d" value={`${trend.hwPrediction7d.toFixed(1)} kg`} />
          <MetricCard label="Prediccion 30d" value={`${trend.hwPrediction30d.toFixed(1)} kg`} />
        </div>
      )}

      {/* Goal progress */}
      {projection && (
        <div className="bg-surface rounded-xl border border-border p-4">
          <h2 className="font-medium mb-3">Progreso hacia meta</h2>
          <div className="flex items-center gap-4 mb-2">
            <span className="text-sm text-gray-400">Meta: {projection.goalWeightKg} kg</span>
            <span className="text-sm font-bold">{projection.progressPercentage.toFixed(0)}%</span>
          </div>
          <div className="h-2 bg-border rounded-full overflow-hidden">
            <div
              className="h-full bg-brand rounded-full transition-all"
              style={{ width: `${Math.min(100, projection.progressPercentage)}%` }}
            />
          </div>
          <p className="text-xs text-gray-500 mt-2">{projection.progressMessage}</p>
        </div>
      )}

      {/* Weight chart */}
      {weightChartData.length > 0 && (
        <div className="bg-surface rounded-xl border border-border p-4">
          <h2 className="font-medium mb-4">Evolucion del peso</h2>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={weightChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2E3139" />
              <XAxis dataKey="fecha" tick={{ fontSize: 10, fill: "#666" }} />
              <YAxis domain={["dataMin - 1", "dataMax + 1"]} tick={{ fontSize: 10, fill: "#666" }} />
              <Tooltip
                contentStyle={{ background: "#1A1D24", border: "1px solid #2E3139", borderRadius: 8 }}
                labelStyle={{ color: "#999" }}
              />
              <Line type="monotone" dataKey="peso" stroke="#60a5fa" strokeWidth={1.5} dot={{ r: 2 }} name="Peso" />
              <Line type="monotone" dataKey="tendencia" stroke="#FF6B35" strokeWidth={2} dot={false} strokeDasharray="5 5" name="Tendencia" />
              {plan?.target_weight && (
                <ReferenceLine y={plan.target_weight} stroke="#4ade80" strokeDasharray="3 3" label={{ value: "Meta", fill: "#4ade80", fontSize: 10 }} />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Kcal chart */}
      {kcalChartData.length > 0 && (
        <div className="bg-surface rounded-xl border border-border p-4">
          <h2 className="font-medium mb-4">Kcal vs TDEE</h2>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={kcalChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2E3139" />
              <XAxis dataKey="fecha" tick={{ fontSize: 10, fill: "#666" }} />
              <YAxis tick={{ fontSize: 10, fill: "#666" }} />
              <Tooltip
                contentStyle={{ background: "#1A1D24", border: "1px solid #2E3139", borderRadius: 8 }}
              />
              <Line type="monotone" dataKey="kcal" stroke="#f97316" strokeWidth={1.5} dot={{ r: 1.5 }} name="Kcal" />
              {tdee && <ReferenceLine y={tdee} stroke="#60a5fa" strokeDasharray="5 5" label={{ value: "TDEE", fill: "#60a5fa", fontSize: 10 }} />}
              {targets?.kcal_target && <ReferenceLine y={targets.kcal_target} stroke="#4ade80" strokeDasharray="3 3" label={{ value: "Target", fill: "#4ade80", fontSize: 10 }} />}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Adherence */}
      {adherenceData.total > 0 && (
        <div className="bg-surface rounded-xl border border-border p-4">
          <h2 className="font-medium mb-3">Adherencia al plan (30d)</h2>
          <div className="flex gap-4 text-sm">
            <span className="text-green-400">{adherenceData.onTarget} en objetivo</span>
            <span className="text-yellow-400">{adherenceData.close} cercanos</span>
            <span className="text-red-400">{adherenceData.out} fuera</span>
          </div>
          <div className="flex gap-1 mt-2 h-3">
            {adherenceData.onTarget > 0 && (
              <div className="bg-green-500 rounded" style={{ flex: adherenceData.onTarget }} />
            )}
            {adherenceData.close > 0 && (
              <div className="bg-yellow-500 rounded" style={{ flex: adherenceData.close }} />
            )}
            {adherenceData.out > 0 && (
              <div className="bg-red-500 rounded" style={{ flex: adherenceData.out }} />
            )}
          </div>
        </div>
      )}

      {/* Weekly macros */}
      {weeklyAvg && (
        <div className="bg-surface rounded-xl border border-border p-4">
          <h2 className="font-medium mb-3">Macros semanales (ultimos 7 dias)</h2>
          <MacroDisplay
            kcal={weeklyAvg.kcal}
            proteinas={weeklyAvg.prot}
            carbs={weeklyAvg.carbs}
            grasas={weeklyAvg.grasas}
            compact
          />
        </div>
      )}

      {/* TDEE History */}
      {checkins.length > 0 && (
        <div className="bg-surface rounded-xl border border-border p-4">
          <h2 className="font-medium mb-4">TDEE historico</h2>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={checkins.slice().reverse().map((c) => ({
              fecha: c.checkin_date,
              tdee: c.estimated_tdee,
            }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2E3139" />
              <XAxis dataKey="fecha" tick={{ fontSize: 10, fill: "#666" }} />
              <YAxis tick={{ fontSize: 10, fill: "#666" }} />
              <Tooltip contentStyle={{ background: "#1A1D24", border: "1px solid #2E3139", borderRadius: 8 }} />
              <Line type="monotone" dataKey="tdee" stroke="#a78bfa" strokeWidth={2} dot={{ r: 3 }} name="TDEE" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Export */}
      <div className="bg-surface rounded-xl border border-border p-4">
        <h2 className="font-medium mb-3">Exportar datos</h2>
        <div className="flex gap-3 flex-wrap">
          <button
            onClick={() => exportCSV(weightEntries.map((w) => ({ fecha: w.fecha, peso: w.peso, kcal: w.kcal })), "peso.csv")}
            className="flex items-center gap-2 px-4 py-2 bg-background border border-border rounded-lg text-sm hover:bg-surface-hover transition-colors"
          >
            <Download size={14} /> Peso (CSV)
          </button>
          <button
            onClick={() => exportCSV(foodTotals.map((t) => ({ ...t })) as Record<string, unknown>[], "comidas.csv")}
            className="flex items-center gap-2 px-4 py-2 bg-background border border-border rounded-lg text-sm hover:bg-surface-hover transition-colors"
          >
            <Download size={14} /> Comidas (CSV)
          </button>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="bg-surface rounded-xl p-3 border border-border">
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      <div className="flex items-center gap-2">
        {icon}
        <p className="text-lg font-bold">{value}</p>
      </div>
    </div>
  );
}
