import { createClient } from "@/lib/supabase/server";
import { getWeightEntries, getActiveTargets } from "@/lib/db";
import { Scale, Flame, Target } from "lucide-react";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const [latestWeight, targets] = await Promise.all([
    getWeightEntries(supabase, user.id, 1),
    getActiveTargets(supabase, user.id),
  ]);

  const lastEntry = latestWeight[0];
  const peso = lastEntry?.peso;
  const lastKcal = lastEntry?.kcal;
  const targetKcal = targets?.kcal_target;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Pocket Diet</h1>
        <p className="text-gray-400 text-sm mt-1">
          Tu resumen de hoy
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          icon={<Scale className="text-blue-400" size={20} />}
          label="Ultimo peso"
          value={peso ? `${peso.toFixed(1)} kg` : "—"}
          date={lastEntry?.fecha}
        />
        <StatCard
          icon={<Flame className="text-orange-400" size={20} />}
          label="Ultimas kcal"
          value={lastKcal ? `${Math.round(lastKcal)}` : "—"}
          date={lastEntry?.fecha}
        />
        <StatCard
          icon={<Target className="text-green-400" size={20} />}
          label="Target kcal"
          value={targetKcal ? `${targetKcal}` : "—"}
        />
      </div>

      <div className="bg-surface rounded-xl p-4 border border-border">
        <h2 className="font-medium mb-3">Accesos rapidos</h2>
        <div className="grid grid-cols-2 gap-3">
          <QuickLink href="/peso" label="Registrar peso" />
          <QuickLink href="/food-log" label="Registrar comida" />
          <QuickLink href="/analytics" label="Ver estadisticas" />
          <QuickLink href="/coach" label="Coach adaptativo" />
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  date,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  date?: string;
}) {
  return (
    <div className="bg-surface rounded-xl p-4 border border-border">
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-sm text-gray-400">{label}</span>
      </div>
      <p className="text-2xl font-bold">{value}</p>
      {date && <p className="text-xs text-gray-500 mt-1">{date}</p>}
    </div>
  );
}

function QuickLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      className="flex items-center justify-center px-4 py-3 bg-surface-hover hover:bg-border rounded-lg text-sm font-medium transition-colors"
    >
      {label}
    </a>
  );
}
