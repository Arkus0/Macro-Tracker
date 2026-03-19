"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { saveWeightEntry, getWeightEntries, getWeightEntryByDate } from "@/lib/db";
import type { WeightEntry } from "@/lib/types";
import { todayISO, formatDateDisplay } from "@/lib/utils";

export default function PesoPage() {
  const supabase = createClient();
  const [userId, setUserId] = useState<string>("");
  const [fecha, setFecha] = useState(todayISO());
  const [peso, setPeso] = useState("");
  const [kcal, setKcal] = useState("");
  const [history, setHistory] = useState<WeightEntry[]>([]);
  const [existing, setExisting] = useState<WeightEntry | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
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
      setMessage({ type: "error", text: "Introduce al menos peso o kcal" });
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
      setMessage({ type: "success", text: existing ? "Actualizado" : "Guardado" });
      await loadData(userId);
    } catch {
      setMessage({ type: "error", text: "Error al guardar" });
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(null), 2000);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Registro de Peso</h1>

      <div className="bg-surface rounded-xl p-4 border border-border space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Fecha</label>
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-brand/50"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Peso (kg)</label>
            <input
              type="number"
              value={peso}
              onChange={(e) => setPeso(e.target.value)}
              placeholder="ej: 75.5"
              step="0.1"
              min="0"
              max="300"
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-brand/50"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Kcal consumidas</label>
            <input
              type="number"
              value={kcal}
              onChange={(e) => setKcal(e.target.value)}
              placeholder="ej: 2000"
              step="10"
              min="0"
              max="10000"
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-brand/50"
            />
          </div>
        </div>

        {existing && (
          <p className="text-xs text-yellow-400">
            Ya existe un registro para esta fecha. Se actualizara.
          </p>
        )}

        {message && (
          <div
            className={`text-sm p-2 rounded-lg ${
              message.type === "success"
                ? "bg-green-400/10 text-green-400"
                : "bg-red-400/10 text-red-400"
            }`}
          >
            {message.text}
          </div>
        )}

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full sm:w-auto px-6 py-2 bg-brand hover:bg-brand-500 disabled:opacity-50 text-white font-medium rounded-lg transition-colors"
        >
          {saving ? "Guardando..." : "Guardar"}
        </button>
      </div>

      {/* History */}
      <div className="bg-surface rounded-xl border border-border overflow-hidden">
        <div className="p-4 border-b border-border">
          <h2 className="font-medium">Ultimos 14 registros</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 border-b border-border">
                <th className="text-left p-3">Fecha</th>
                <th className="text-right p-3">Peso (kg)</th>
                <th className="text-right p-3">Kcal</th>
              </tr>
            </thead>
            <tbody>
              {history.map((entry) => (
                <tr key={entry.id} className="border-b border-border/50 hover:bg-surface-hover">
                  <td className="p-3">{formatDateDisplay(entry.fecha)}</td>
                  <td className="p-3 text-right">
                    {entry.peso ? entry.peso.toFixed(1) : "—"}
                  </td>
                  <td className="p-3 text-right">
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
