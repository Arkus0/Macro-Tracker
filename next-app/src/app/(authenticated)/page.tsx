import { createClient } from "@/lib/supabase/server";
import { getWeightEntries, getActiveTargets } from "@/lib/db";
import { Scale, Flame, Target, UtensilsCrossed, BarChart3, Brain } from "lucide-react";

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Buenos dias";
  if (hour < 20) return "Buenas tardes";
  return "Buenas noches";
}

function daysAgo(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.floor((today.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (diff === 0) return "Hoy";
  if (diff === 1) return "Ayer";
  return `Hace ${diff} dias`;
}

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
  const username = user.email?.split("@")[0];
  const greeting = getGreeting();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">
          {greeting}{username ? `, ${username}` : ""}
        </h1>
        <p className="text-gray-400 text-sm mt-1">
          Tu resumen de hoy
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          icon={<Scale className="text-blue-400" size={20} />}
          label="Ultimo peso"
          value={peso ? `${peso.toFixed(1)} kg` : "—"}
          sub={lastEntry?.fecha ? daysAgo(lastEntry.fecha) : undefined}
        />
        <StatCard
          icon={<Flame className="text-orange-400" size={20} />}
          label="Ultimas kcal"
          value={lastKcal ? `${Math.round(lastKcal)}` : "—"}
          sub={lastEntry?.fecha ? daysAgo(lastEntry.fecha) : undefined}
        />
        <StatCard
          icon={<Target className="text-success" size={20} />}
          label="Target kcal"
          value={targetKcal ? `${targetKcal}` : "—"}
          highlight
        />
      </div>

      <div className="bg-surface-1 rounded-xl p-4 border border-white/[.06]">
        <h2 className="font-medium mb-3">Accesos rapidos</h2>
        <div className="grid grid-cols-2 gap-3">
          <QuickLink href="/peso" label="Registrar peso" icon={<Scale size={16} />} />
          <QuickLink href="/food-log" label="Registrar comida" icon={<UtensilsCrossed size={16} />} />
          <QuickLink href="/analytics" label="Ver estadisticas" icon={<BarChart3 size={16} />} />
          <QuickLink href="/coach" label="Coach adaptativo" icon={<Brain size={16} />} />
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  sub,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-xl p-4 border ${
        highlight
          ? "bg-brand/5 border-brand/20"
          : "bg-surface-1 border-white/[.06]"
      }`}
    >
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-sm text-gray-400">{label}</span>
      </div>
      <p className="text-3xl font-bold nums">{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </div>
  );
}

function QuickLink({
  href,
  label,
  icon,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <a
      href={href}
      className="flex items-center justify-center gap-2 px-4 py-4 bg-surface-hover rounded-lg text-sm font-medium transition-colors duration-100 border border-transparent hover:border-brand/30 hover:shadow-glow"
    >
      <span className="text-gray-400">{icon}</span>
      {label}
    </a>
  );
}
