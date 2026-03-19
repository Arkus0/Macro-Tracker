"use client";

interface MacroDisplayProps {
  kcal: number;
  proteinas: number;
  carbs: number;
  grasas: number;
  targetKcal?: number;
  targetProtein?: number;
  targetCarbs?: number;
  targetFat?: number;
  compact?: boolean;
}

export default function MacroDisplay({
  kcal,
  proteinas,
  carbs,
  grasas,
  targetKcal,
  targetProtein,
  targetCarbs,
  targetFat,
  compact = false,
}: MacroDisplayProps) {
  const macros = [
    {
      label: "Kcal",
      value: Math.round(kcal),
      target: targetKcal,
      color: "text-orange-400",
      bgColor: "bg-orange-400",
    },
    {
      label: "Prot",
      value: Math.round(proteinas),
      target: targetProtein ? Math.round(targetProtein) : undefined,
      unit: "g",
      color: "text-blue-400",
      bgColor: "bg-blue-400",
    },
    {
      label: "Carbs",
      value: Math.round(carbs),
      target: targetCarbs ? Math.round(targetCarbs) : undefined,
      unit: "g",
      color: "text-yellow-400",
      bgColor: "bg-yellow-400",
    },
    {
      label: "Grasas",
      value: Math.round(grasas),
      target: targetFat ? Math.round(targetFat) : undefined,
      unit: "g",
      color: "text-pink-400",
      bgColor: "bg-pink-400",
    },
  ];

  return (
    <div className={`grid ${compact ? "grid-cols-4 gap-2" : "grid-cols-2 sm:grid-cols-4 gap-3"}`}>
      {macros.map((m) => {
        const pct = m.target ? Math.min(100, (m.value / m.target) * 100) : 0;
        return (
          <div
            key={m.label}
            className={`${compact ? "p-2" : "bg-surface rounded-lg p-3 border border-border"}`}
          >
            <p className="text-xs text-gray-400">{m.label}</p>
            <p className={`${compact ? "text-sm" : "text-lg"} font-bold ${m.color}`}>
              {m.value}
              {m.unit && <span className="text-xs font-normal text-gray-500">{m.unit}</span>}
              {m.target && (
                <span className="text-xs font-normal text-gray-500">
                  {" "}
                  / {m.target}
                </span>
              )}
            </p>
            {m.target && (
              <div className="mt-1 h-1.5 bg-border rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${m.bgColor} transition-all`}
                  style={{ width: `${pct}%`, opacity: 0.7 }}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
