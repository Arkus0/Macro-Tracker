"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });
        if (error) throw error;

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
      <div className="w-full max-w-sm space-y-8 animate-fade-in">
        <div className="text-center space-y-1">
          <h1 className="text-4xl font-bold text-brand tracking-tight">Pocket Diet</h1>
          <p className="text-gray-500 text-sm">
            Tu macro tracker personal
          </p>
        </div>

        {successMessage ? (
          <div className="bg-surface rounded-xl border border-white/[.06] p-6 space-y-4 text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-green-400/10 flex items-center justify-center">
              <Mail className="text-green-400" size={24} />
            </div>
            <div className="space-y-2">
              <h2 className="font-semibold text-white text-lg">Revisa tu email</h2>
              <p className="text-sm text-gray-400 leading-relaxed">
                Hemos enviado un enlace de confirmacion a <span className="text-white font-medium">{email}</span>. Haz clic en el enlace para activar tu cuenta.
              </p>
            </div>
            <Button
              variant="secondary"
              className="w-full"
              onClick={() => {
                setSuccessMessage("");
                setIsRegister(false);
                setEmail("");
                setPassword("");
              }}
            >
              Volver a iniciar sesion
            </Button>
          </div>
        ) : (
          <>
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                type="email"
                label="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@email.com"
                required
              />

              <Input
                type="password"
                label="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
              />

              {error && (
                <div className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-lg p-3">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                loading={loading}
                className="w-full"
              >
                {isRegister ? "Crear cuenta" : "Iniciar sesion"}
              </Button>
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
          </>
        )}
      </div>
    </div>
  );
}
