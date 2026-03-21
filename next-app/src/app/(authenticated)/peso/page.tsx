"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { saveWeightEntry, getWeightEntries, getWeightEntryByDate } from "@/lib/db";
import type { WeightEntry } from "@/lib/types";
import { todayISO, formatDateDisplay } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";

export default function PesoPage() {
  const supabase = createClient();
  const { addToast } = useToast();
  const [userId, setUserId] = useState<string>("");
  const [fecha, setFecha] = useState(todayISO());
  const [peso, setPeso] = useState("");
  const [kcal, setKcal] = useState("");
  const [history, setHistory] = useState<WeightEntry[]>([]);
  const [existing, setExisting] = useState<WeightEntry | null>(null);
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async (uid: string) => {
    const [entries, entry] = await Promise.all([
      getWeightEntries(supabase, uid, 14),
      getWeightEntryByDate(supabase, uid, fecha),
    ]);
    setHistory(entries);
    setExisting(entry);
    if (entry) {
      if (entry.peso) setPeso(String(entry.peso));
      if (entry.kcal) setKcal(String(entry.kcal));
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
    if (userId) {
      getWeightEntryByDate(supabase, userId, fecha).then((entry) => {
        setExisting(entry);
        setPeso(entry?.peso ? String(entry.peso) : "");
        setKcal(entry?.kcal ? String(entry.kcal) : "");
      });
    }
  }, [fecha, userId, supabase]);

  async function handleSave() {
    if (!peso && !kcal) {
      addToast("Introduce al menos peso o kcal", "error");
      return;
    }
    setSaving(true);
    try {
      await saveWeightEntry(
        supabase,
        userId,
        fecha,
        peso ? parseFloat(peso) : null,
        kcal ? parseFloat(kcal) : null
      );
      addToast(existing ? "Actualizado" : "Guardado", "success");
      await loadData(userId);
    } catch {
      addToast("Error al guardar", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-2xl font-bold">Registro de Peso</h1>

      <div className="bg-surface rounded-xl p-4 border border-white/[.06] space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Input
            type="date"
            label="Fecha"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
          />
          <Input
            type="number"
            label="Peso (kg)"
            value={peso}
            onChange={(e) => setPeso(e.target.value)}
            placeholder="ej: 75.5"
            step="0.1"
            min="0"
            max="300"
          />
          <Input
            type="number"
            label="Kcal consumidas"
            value={kcal}
            onChange={(e) => setKcal(e.target.value)}
            placeholder="ej: 2000"
            step="10"
            min="0"
            max="10000"
          />
        </div>

        {existing && (
          <p className="text-xs text-yellow-400">
            Ya existe un registro para esta fecha. Se actualizara.
          </p>
        )}

        <Button
          onClick={handleSave}
          loading={saving}
          className="w-full sm:w-auto"
        >
          Guardar
        </Button>
      </div>

      {/* History */}
      <div className="bg-surface rounded-xl border border-white/[.06] overflow-hidden">
        <div className="p-4 border-b border-white/[.06]">
          <h2 className="font-medium">Ultimos 14 registros</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 border-b border-white/[.06]">
                <th className="text-left p-3">Fecha</th>
                <th className="text-right p-3">Peso (kg)</th>
                <th className="text-right p-3">Kcal</th>
              </tr>
            </thead>
            <tbody>
              {history.map((entry) => (
                <tr key={entry.id} className="border-b border-white/[.03] hover:bg-surface-hover">
                  <td className="p-3">{formatDateDisplay(entry.fecha)}</td>
                  <td className="p-3 text-right nums">
                    {entry.peso ? entry.peso.toFixed(1) : "—"}
                  </td>
                  <td className="p-3 text-right nums">
                    {entry.kcal ? Math.round(entry.kcal) : "—"}
                  </td>
                </tr>
              ))}
              {history.length === 0 && (
                <tr>
                  <td colSpan={3} className="p-4 text-center text-gray-500">
                    Sin registros aun
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
