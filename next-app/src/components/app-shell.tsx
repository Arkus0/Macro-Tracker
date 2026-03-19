"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  Home,
  Scale,
  UtensilsCrossed,
  BarChart3,
  Brain,
  Target,
  ChefHat,
  Ruler,
  LogOut,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const NAV_ITEMS = [
  { href: "/", label: "Inicio", icon: Home },
  { href: "/peso", label: "Peso", icon: Scale },
  { href: "/food-log", label: "Diario", icon: UtensilsCrossed },
  { href: "/analytics", label: "Stats", icon: BarChart3 },
  { href: "/coach", label: "Coach", icon: Brain },
  { href: "/targets", label: "Targets", icon: Target },
  { href: "/recetas", label: "Recetas", icon: ChefHat },
  { href: "/medidas", label: "Medidas", icon: Ruler },
];

export default function AppShell({
  children,
  username,
}: {
  children: React.ReactNode;
  username?: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="flex flex-col min-h-screen md:flex-row">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:flex-col md:w-56 bg-surface border-r border-border p-4 fixed h-full">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-brand">Pocket Diet</h1>
          {username && (
            <p className="text-sm text-gray-400 mt-1">{username}</p>
          )}
        </div>

        <nav className="flex-1 space-y-1">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <a
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  isActive
                    ? "bg-brand/10 text-brand font-medium"
                    : "text-gray-400 hover:text-white hover:bg-surface-hover"
                }`}
              >
                <Icon size={18} />
                {item.label}
              </a>
            );
          })}
        </nav>

        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-red-400 hover:bg-surface-hover transition-colors mt-4"
        >
          <LogOut size={18} />
          Cerrar sesion
        </button>
      </aside>

      {/* Main content */}
      <main className="flex-1 md:ml-56 pb-20 md:pb-4">
        <div className="max-w-4xl mx-auto p-4">{children}</div>
      </main>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-surface border-t border-border z-50">
        <div className="flex justify-around items-center h-16 px-2">
          {NAV_ITEMS.slice(0, 5).map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <a
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center gap-0.5 text-[10px] py-1 px-2 rounded-lg transition-colors ${
                  isActive ? "text-brand" : "text-gray-500"
                }`}
              >
                <Icon size={20} />
                {item.label}
              </a>
            );
          })}
          {/* More menu for remaining items */}
          <MoreMenu items={NAV_ITEMS.slice(5)} pathname={pathname} />
        </div>
      </nav>
    </div>
  );
}

function MoreMenu({
  items,
  pathname,
}: {
  items: typeof NAV_ITEMS;
  pathname: string;
}) {
  const isAnyActive = items.some((i) => pathname === i.href);

  return (
    <div className="relative group">
      <button
        className={`flex flex-col items-center gap-0.5 text-[10px] py-1 px-2 rounded-lg ${
          isAnyActive ? "text-brand" : "text-gray-500"
        }`}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="1" />
          <circle cx="19" cy="12" r="1" />
          <circle cx="5" cy="12" r="1" />
        </svg>
        Mas
      </button>
      <div className="absolute bottom-full right-0 mb-2 bg-surface border border-border rounded-lg shadow-xl hidden group-focus-within:block group-hover:block min-w-[140px]">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <a
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3 text-sm transition-colors ${
                isActive
                  ? "text-brand bg-brand/10"
                  : "text-gray-400 hover:text-white hover:bg-surface-hover"
              }`}
            >
              <Icon size={16} />
              {item.label}
            </a>
          );
        })}
      </div>
    </div>
  );
}
