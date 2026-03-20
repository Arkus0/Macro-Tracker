"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccessMessage("");
    setLoading(true);

    try {
      if (isRegister) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;

        // If session is null, email confirmation is required
        if (data.user && !data.session) {
          if (data.user.identities?.length === 0) {
            throw new Error("Este email ya esta registrado. Intenta iniciar sesion.");
          }
          setSuccessMessage("Cuenta creada. Revisa tu email para confirmar tu cuenta antes de iniciar sesion.");
          setLoading(false);
          return;
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      }
      router.push("/");
      router.refresh();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error desconocido";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-brand">Pocket Diet</h1>
          <p className="text-gray-400 mt-2">
            Tu macro tracker personal
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand"
              placeholder="tu@email.com"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand"
              placeholder="••••••••"
              required
              minLength={6}
            />
          </div>

          {error && (
            <div className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-lg p-3">
              {error}
            </div>
          )}

          {successMessage && (
            <div className="text-green-400 text-sm bg-green-400/10 border border-green-400/20 rounded-lg p-3">
              {successMessage}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-brand hover:bg-brand-500 disabled:opacity-50 text-white font-medium rounded-lg transition-colors"
          >
            {loading
              ? "..."
              : isRegister
                ? "Crear cuenta"
                : "Iniciar sesion"}
          </button>
        </form>

        <div className="text-center">
          <button
            onClick={() => {
              setIsRegister(!isRegister);
              setError("");
            }}
            className="text-sm text-gray-400 hover:text-brand transition-colors"
          >
            {isRegister
              ? "Ya tienes cuenta? Inicia sesion"
              : "No tienes cuenta? Registrate"}
          </button>
        </div>
      </div>
    </div>
  );
}
