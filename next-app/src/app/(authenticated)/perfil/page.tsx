"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  getUserProfile,
  saveUserProfile,
  getWeightEntries,
  getActiveCoachPlan,
  getCheckinHistory,
  getBodyMeasurements,
  getFoodDailyTotals,
} from "@/lib/db";
import type { UserProfile, WeightEntry, CoachPlan, CheckinHistory, BodyMeasurement } from "@/lib/types";
import { calculateFormulaTDEE, calculateBMI, getBMICategory } from "@/lib/algorithms/tdee-formula";
import { calculateWeightTrend } from "@/lib/algorithms/weight-trend";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { Scale, TrendingDown, TrendingUp, Minus, Activity, Ruler, Brain } from "lucide-react";
import Link from "next/link";

const ACTIVITY_LABELS: Record<string, string> = {
  sedentary: "Sedentario",
  light: "Actividad ligera",
  moderate: "Actividad moderada",
  active: "Activo",
  very_active: "Muy activo",
};

export default function PerfilPage() {
  const supabase = createClient();
  const { addToast } = useToast();
  const [userId, setUserId] = useState("");
  const [email, setEmail] = useState("");
  const [memberSince, setMemberSince] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Profile form
  const [heightCm, setHeightCm] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [sex, setSex] = useState("");
  const [activityLevel, setActivityLevel] = useState("");

  // Data from other tables
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [latestWeight, setLatestWeight] = useState<WeightEntry | null>(null);
  const [coachPlan, setCoachPlan] = useState<CoachPlan | null>(null);
  const [checkins, setCheckins] = useState<CheckinHistory[]>([]);
  const [latestMeasurement, setLatestMeasurement] = useState<BodyMeasurement | null>(null);
  const [weightCount, setWeightCount] = useState(0);
  const [foodDayCount, setFoodDayCount] = useState(0);
  const [phase, setPhase] = useState<string | null>(null);

  const loadData = useCallback(async (uid: string) => {
    const [prof, weights, plan, chk, measurements, foodTotals] = await Promise.all([
      getUserProfile(supabase, uid),
      getWeightEntries(supabase, uid),
      getActiveCoachPlan(supabase, uid),
      getCheckinHistory(supabase, uid),
      getBodyMeasurements(supabase, uid),
      getFoodDailyTotals(supabase, uid),
    ]);

    setProfile(prof);
    setLatestWeight(weights.length > 0 ? weights[0] : null);
    setWeightCount(weights.filter((w) => w.peso != null).length);
    setCoachPlan(plan);
    setCheckins(chk);
    setLatestMeasurement(measurements.length > 0 ? measurements[0] : null);
    setFoodDayCount(foodTotals.length);

    // Calculate phase
    const trendEntries = weights.filter((w) => w.peso != null);
    if (trendEntries.length >= 5) {
      const trend = calculateWeightTrend(trendEntries);
      setPhase(trend.phase);
    }

    // Fill form with existing profile data
    if (prof) {
      if (prof.height_cm) setHeightCm(String(prof.height_cm));
      if (prof.birth_year) setBirthYear(String(prof.birth_year));
      if (prof.sex) setSex(prof.sex);
      if (prof.activity_level) setActivityLevel(prof.activity_level);
    }

    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUserId(user.id);
        setEmail(user.email || "");
        setMemberSince(user.created_at ? new Date(user.created_at).toLocaleDateString("es-ES", { year: "numeric", month: "long" }) : "");
        loadData(user.id);
      }
    });
  }, [loadData, supabase.auth]);

  async function handleSave() {
    setSaving(true);
    try {
      await saveUserProfile(supabase, userId, {
        heightCm: heightCm ? parseFloat(heightCm) : null,
        birthYear: birthYear ? parseInt(birthYear) : null,
        sex: (sex as "M" | "F") || null,
        activityLevel: activityLevel || null,
      });
      addToast("Perfil guardado", "success");
      await loadData(userId);
    } catch {
      addToast("Error al guardar", "error");
    } finally {
      setSaving(false);
    }
  }

  // Computed values
  const age = useMemo(() => {
    if (!birthYear) return null;
    return new Date().getFullYear() - parseInt(birthYear);
  }, [birthYear]);

  const bmi = useMemo(() => {
    if (!latestWeight?.peso || !heightCm) return null;
    return calculateBMI(latestWeight.peso, parseFloat(heightCm));
  }, [latestWeight, heightCm]);

  const formulaTDEE = useMemo(() => {
    if (!latestWeight?.peso || !heightCm || !age || !sex || !activityLevel) return null;
    return calculateFormulaTDEE(
      latestWeight.peso,
      parseFloat(heightCm),
      age,
      sex as "M" | "F",
      activityLevel as "sedentary" | "light" | "moderate" | "active" | "very_active"
    );
  }, [latestWeight, heightCm, age, sex, activityLevel]);

  const empiricalTDEE = useMemo(() => {
    if (checkins.length === 0) return null;
    return checkins[0].estimated_tdee;
  }, [checkins]);

  const lastCheckinDate = useMemo(() => {
    if (checkins.length === 0) return null;
    return checkins[0].checkin_date;
  }, [checkins]);

  const isEmpiricalStale = useMemo(() => {
    if (!lastCheckinDate) return true;
    const daysSince = Math.floor(
      (Date.now() - new Date(lastCheckinDate + "T00:00:00").getTime()) / (1000 * 60 * 60 * 24)
    );
    return daysSince > 30;
  }, [lastCheckinDate]);

  const goalLabels: Record<string, string> = { lose: "Perder peso", maintain: "Mantener", gain: "Ganar peso" };
  const phaseLabels: Record<string, string> = { losing: "Perdiendo peso", maintaining: "Manteniendo", gaining: "Ganando peso" };
  const PhaseIcon = phase === "losing" ? TrendingDown : phase === "gaining" ? TrendingUp : Minus;
  const phaseColor = phase === "losing" ? "text-success" : phase === "gaining" ? "text-danger" : "text-warning";

  if (loading) return <div className="text-gray-500">Cargando...</div>;

  const selectClass = "h-11 w-full rounded-lg border-[1.5px] border-white/[.06] bg-surface px-4 text-white transition-colors duration-100 focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent";

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-brand/20 flex items-center justify-center text-brand text-xl font-bold">
          {email.charAt(0).toUpperCase()}
        </div>
        <div>
          <h1 className="text-2xl font-bold">{email.split("@")[0]}</h1>
          <p className="text-sm text-gray-400">{email} · Miembro desde {memberSince}</p>
        </div>
      </div>

      {/* Physical profile form */}
      <div className="bg-surface rounded-xl border border-white/[.06] p-4 space-y-4">
        <h2 className="font-medium">Datos fisicos</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Input
            type="number"
            label="Altura (cm)"
            value={heightCm}
            onChange={(e) => setHeightCm(e.target.value)}
            placeholder="170"
            min="100"
            max="250"
          />
          <Input
            type="number"
            label="Año nacimiento"
            value={birthYear}
            onChange={(e) => setBirthYear(e.target.value)}
            placeholder="1990"
            min="1930"
            max="2015"
          />
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-300">Sexo</label>
            <select value={sex} onChange={(e) => setSex(e.target.value)} className={selectClass}>
              <option value="">—</option>
              <option value="M">Hombre</option>
              <option value="F">Mujer</option>
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-300">Actividad</label>
            <select value={activityLevel} onChange={(e) => setActivityLevel(e.target.value)} className={selectClass}>
              <option value="">—</option>
              <option value="sedentary">Sedentario</option>
              <option value="light">Ligera</option>
              <option value="moderate">Moderada</option>
              <option value="active">Activo</option>
              <option value="very_active">Muy activo</option>
            </select>
          </div>
        </div>
        <Button onClick={handleSave} loading={saving}>
          Guardar perfil
        </Button>
      </div>

      {/* Current stats */}
      <div className="bg-surface rounded-xl border border-white/[.06] p-4 space-y-4">
        <h2 className="font-medium">Resumen actual</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {/* Weight */}
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-gray-400">
              <Scale size={12} />
              Peso actual
            </div>
            {latestWeight?.peso ? (
              <>
                <p className="text-2xl font-bold nums">{latestWeight.peso.toFixed(1)} <span className="text-sm font-normal text-gray-400">kg</span></p>
                <p className="text-xs text-gray-500">{latestWeight.fecha}</p>
              </>
            ) : (
              <p className="text-sm text-gray-500">Sin datos</p>
            )}
          </div>

          {/* BMI */}
          {bmi && (
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-gray-400">
                <Ruler size={12} />
                IMC
              </div>
              <p className="text-2xl font-bold nums">{bmi.toFixed(1)}</p>
              <p className="text-xs text-gray-500">{getBMICategory(bmi)}</p>
            </div>
          )}

          {/* Phase */}
          {phase && (
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-gray-400">
                <PhaseIcon size={12} />
                Fase actual
              </div>
              <p className={`text-lg font-bold ${phaseColor}`}>{phaseLabels[phase] || phase}</p>
            </div>
          )}

          {/* TDEE Empirical */}
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-gray-400">
              <Activity size={12} />
              TDEE empirico
            </div>
            {empiricalTDEE ? (
              <>
                <p className="text-2xl font-bold nums">{empiricalTDEE} <span className="text-sm font-normal text-gray-400">kcal</span></p>
                {isEmpiricalStale && (
                  <p className="text-xs text-warning">Datos antiguos (&gt;30 dias)</p>
                )}
                {lastCheckinDate && !isEmpiricalStale && (
                  <p className="text-xs text-gray-500">Check-in: {lastCheckinDate}</p>
                )}
              </>
            ) : (
              <p className="text-sm text-gray-500">Sin check-ins</p>
            )}
          </div>

          {/* TDEE Formula */}
          {formulaTDEE && (
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-gray-400">
                <Activity size={12} />
                TDEE estimado
              </div>
              <p className="text-2xl font-bold text-gray-400 nums">{formulaTDEE} <span className="text-sm font-normal">kcal</span></p>
              <p className="text-xs text-gray-500">Mifflin-St Jeor</p>
            </div>
          )}

          {/* Goal */}
          {coachPlan && (
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-gray-400">
                <Brain size={12} />
                Objetivo
              </div>
              <p className="text-lg font-bold">{goalLabels[coachPlan.goal]}</p>
              {coachPlan.target_weight && (
                <p className="text-xs text-gray-500 nums">Meta: {coachPlan.target_weight} kg</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Latest measurements */}
      {latestMeasurement && (
        <div className="bg-surface rounded-xl border border-white/[.06] p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-medium">Medidas recientes</h2>
            <Link href="/medidas" className="text-xs text-brand hover:text-brand-400">Ver todas</Link>
          </div>
          <p className="text-xs text-gray-500">{latestMeasurement.fecha}</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            {latestMeasurement.cintura && (
              <div><span className="text-gray-400">Cintura:</span> <span className="nums">{latestMeasurement.cintura} cm</span></div>
            )}
            {latestMeasurement.pecho && (
              <div><span className="text-gray-400">Pecho:</span> <span className="nums">{latestMeasurement.pecho} cm</span></div>
            )}
            {latestMeasurement.caderas && (
              <div><span className="text-gray-400">Caderas:</span> <span className="nums">{latestMeasurement.caderas} cm</span></div>
            )}
            {latestMeasurement.body_fat_pct && (
              <div><span className="text-gray-400">Grasa:</span> <span className="nums">{latestMeasurement.body_fat_pct}%</span></div>
            )}
          </div>
        </div>
      )}

      {/* Activity stats */}
      <div className="bg-surface rounded-xl border border-white/[.06] p-4">
        <h2 className="font-medium mb-3">Estadisticas</h2>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-2xl font-bold nums">{weightCount}</p>
            <p className="text-xs text-gray-400">Pesajes</p>
          </div>
          <div>
            <p className="text-2xl font-bold nums">{foodDayCount}</p>
            <p className="text-xs text-gray-400">Dias con diario</p>
          </div>
          <div>
            <p className="text-2xl font-bold nums">{checkins.length}</p>
            <p className="text-xs text-gray-400">Check-ins</p>
          </div>
        </div>
      </div>
    </div>
  );
}
