"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { saveBodyMeasurement, getBodyMeasurements } from "@/lib/db";
import type { BodyMeasurement } from "@/lib/types";
import { todayISO, formatDateDisplay } from "@/lib/utils";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const MEASUREMENT_FIELDS = [
  { key: "cintura", label: "Cintura (cm)", unit: "cm" },
  { key: "pecho", label: "Pecho (cm)", unit: "cm" },
  { key: "caderas", label: "Caderas (cm)", unit: "cm" },
  { key: "brazos", label: "Brazos (cm)", unit: "cm" },
  { key: "muslos", label: "Muslos (cm)", unit: "cm" },
  { key: "cuello", label: "Cuello (cm)", unit: "cm" },
  { key: "body_fat_pct", label: "% Grasa corporal", unit: "%" },
] as const;

const COLORS = ["#f97316", "#60a5fa", "#4ade80", "#f472b6", "#a78bfa", "#fbbf24", "#e879f9"];

export default function MedidasPage() {
  const supabase = createClient();
  const [userId, setUserId] = useState("");
  const [measurements, setMeasurements] = useState<BodyMeasurement[]>([]);
  const [fecha, setFecha] = useState(todayISO());
  const [values, setValues] = useState<Record<string, string>>({});
  const [selectedCharts, setSelectedCharts] = useState<string[]>(["cintura"]);
  const [message, setMessage] = useState("");

  const loadData = useCallback(async (uid: string) => {
    const data = await getBodyMeasurements(supabase, uid);
    setMeasurements(data);
  }, [supabase]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUserId(user.id);
        loadData(user.id);
      }
    });
  }, [loadData, supabase.auth]);

  async function handleSave() {
    const hasValue = MEASUREMENT_FIELDS.some((f) => values[f.key]);
    if (!hasValue) return;

    await saveBodyMeasurement(supabase, userId, fecha, {
      cintura: values.cintura ? parseFloat(values.cintura) : null,
      pecho: values.pecho ? parseFloat(values.pecho) : null,
      caderas: values.caderas ? parseFloat(values.caderas) : null,
      brazos: values.brazos ? parseFloat(values.brazos) : null,
      muslos: values.muslos ? parseFloat(values.muslos) : null,
      cuello: values.cuello ? parseFloat(values.cuello) : null,
      bodyFatPct: values.body_fat_pct ? parseFloat(values.body_fat_pct) : null,
    });

    setValues({});
    setMessage("Guardado");
    setTimeout(() => setMessage(""), 2000);
    await loadData(userId);
  }

  // Chart data
  const chartData = useMemo(() => {
    return measurements.slice().reverse().map((m) => ({
      fecha: m.fecha,
      cintura: m.cintura,
      pecho: m.pecho,
      caderas: m.caderas,
      brazos: m.brazos,
      muslos: m.muslos,
      cuello: m.cuello,
      body_fat_pct: m.body_fat_pct,
    }));
  }, [measurements]);

  // Comparison
  const comparison = useMemo(() => {
    if (measurements.length < 2) return null;
    const newest = measurements[0];
    const oldest = measurements[measurements.length - 1];
    return MEASUREMENT_FIELDS
      .filter((f) => {
        const oldVal = oldest[f.key as keyof BodyMeasurement];
        const newVal = newest[f.key as keyof BodyMeasurement];
        return oldVal != null && newVal != null;
      })
      .map((f) => {
        const oldVal = oldest[f.key as keyof BodyMeasurement] as number;
        const newVal = newest[f.key as keyof BodyMeasurement] as number;
        return { label: f.label, unit: f.unit, old: oldVal, new: newVal, diff: newVal - oldVal };
      });
  }, [measurements]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Medidas Corporales</h1>

      {/* Form */}
      <div className="bg-surface rounded-xl border border-border p-4 space-y-4">
        <h2 className="font-medium">Nuevo registro</h2>
        <div>
          <label className="block text-sm text-gray-400 mb-1">Fecha</label>
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="w-full sm:w-auto px-3 py-2 bg-background border border-border rounded-lg text-white" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {MEASUREMENT_FIELDS.map((f) => (
            <div key={f.key}>
              <label className="block text-xs text-gray-400 mb-1">{f.label}</label>
              <input
                type="number"
                value={values[f.key] || ""}
                onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
                step="0.5"
                placeholder={f.unit}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-white text-sm"
              />
            </div>
          ))}
        </div>
        {message && <p className="text-sm text-green-400">{message}</p>}
        <button onClick={handleSave} className="px-6 py-2 bg-brand hover:bg-brand-500 text-white font-medium rounded-lg">
          Guardar
        </button>
      </div>

      {/* History table */}
      {measurements.length > 0 && (
        <div className="bg-surface rounded-xl border border-border overflow-hidden">
          <div className="p-4 border-b border-border">
            <h2 className="font-medium">Historial</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-400 border-b border-border">
                  <th className="text-left p-2">Fecha</th>
                  {MEASUREMENT_FIELDS.map((f) => (
                    <th key={f.key} className="text-right p-2">{f.label.split(" ")[0]}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {measurements.map((m) => (
                  <tr key={m.id} className="border-b border-border/30">
                    <td className="p-2">{formatDateDisplay(m.fecha)}</td>
                    {MEASUREMENT_FIELDS.map((f) => {
                      const val = m[f.key as keyof BodyMeasurement] as number | null;
                      return <td key={f.key} className="p-2 text-right">{val != null ? val.toFixed(1) : "—"}</td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Charts */}
      {chartData.length > 0 && (
        <div className="bg-surface rounded-xl border border-border p-4 space-y-3">
          <h2 className="font-medium">Graficas</h2>
          <div className="flex flex-wrap gap-2">
            {MEASUREMENT_FIELDS.map((f) => (
              <button
                key={f.key}
                onClick={() => {
                  setSelectedCharts((prev) =>
                    prev.includes(f.key) ? prev.filter((k) => k !== f.key) : [...prev, f.key]
                  );
                }}
                className={`text-xs px-2 py-1 rounded ${
                  selectedCharts.includes(f.key) ? "bg-brand/20 text-brand" : "bg-background text-gray-500"
                }`}
              >
                {f.label.split(" ")[0]}
              </button>
            ))}
          </div>
          {selectedCharts.length > 0 && (
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2E3139" />
                <XAxis dataKey="fecha" tick={{ fontSize: 10, fill: "#666" }} />
                <YAxis tick={{ fontSize: 10, fill: "#666" }} />
                <Tooltip contentStyle={{ background: "#1A1D24", border: "1px solid #2E3139", borderRadius: 8 }} />
                {selectedCharts.map((key, i) => (
                  <Line
                    key={key}
                    type="monotone"
                    dataKey={key}
                    stroke={COLORS[i % COLORS.length]}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    name={MEASUREMENT_FIELDS.find((f) => f.key === key)?.label || key}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      )}

      {/* Comparison */}
      {comparison && comparison.length > 0 && (
        <div className="bg-surface rounded-xl border border-border p-4">
          <h2 className="font-medium mb-3">Comparativa</h2>
          <p className="text-xs text-gray-400 mb-2">
            {formatDateDisplay(measurements[measurements.length - 1].fecha)} vs {formatDateDisplay(measurements[0].fecha)}
          </p>
          <div className="space-y-1">
            {comparison.map((c) => (
              <div key={c.label} className="flex items-center justify-between text-sm">
                <span className="text-gray-400">{c.label.split(" (")[0]}</span>
                <span>
                  {c.old.toFixed(1)} → {c.new.toFixed(1)}{" "}
                  <span className={c.diff < 0 ? "text-green-400" : c.diff > 0 ? "text-red-400" : "text-gray-500"}>
                    ({c.diff > 0 ? "+" : ""}{c.diff.toFixed(1)} {c.unit})
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
