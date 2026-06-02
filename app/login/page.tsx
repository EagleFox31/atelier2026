'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/auth-context';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Wrench, Loader2, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { getApiErrorMessage, type ApiUser } from '@/lib/api';
import { resolvePostLoginRoute } from '@/lib/role-routing';
import { InstallAppButton } from '@/components/pwa/InstallAppButton';
import { LandingKenteBar } from '@/components/marketing/LandingKenteBar';

export default function LoginPage() {
  const router = useRouter();
  const { login, isAuthenticated, isLoading, user } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace(resolvePostLoginRoute(user));
    }
  }, [isLoading, isAuthenticated, user, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!identifier || !password) return;

    setLoading(true);
    setError(null);
    try {
      await login(identifier, password);
      const returnUrl = sessionStorage.getItem('atelier_return_url');
      sessionStorage.removeItem('atelier_return_url');
      const userRaw = localStorage.getItem('atelier_user');
      let user: ApiUser | null = null;
      if (userRaw) {
        try {
          user = JSON.parse(userRaw) as ApiUser;
        } catch {
          /* ignore */
        }
      }
      router.replace(resolvePostLoginRoute(user, returnUrl));
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Identifiants invalides'));
    } finally {
      setLoading(false);
    }
  }

  const appVersion = process.env.NEXT_PUBLIC_APP_VERSION || 'dev';

  if (isLoading || isAuthenticated) {
    return (
      <div className="landing-page flex min-h-screen items-center justify-center bg-gradient-to-b from-[var(--afrique-sky)] to-[var(--afrique-sand)]">
        <Loader2 className="h-8 w-8 animate-spin text-brand" />
      </div>
    );
  }

  return (
    <div className="landing-page flex min-h-screen flex-col bg-gradient-to-b from-[var(--afrique-sky)] via-[var(--afrique-sand)] to-white">
      <LandingKenteBar />
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
      {/* Colonne formulaire */}
      <div className="flex w-full flex-col lg:w-1/2">
        <div className="flex flex-1 flex-col justify-center px-8 py-10 sm:px-16 xl:px-24">
          <div className="mx-auto w-full max-w-sm">
            <Link href="/" className="mb-8 inline-flex items-center gap-3 group">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand/15 to-[var(--afrique-gold-soft)] shadow-sm ring-1 ring-[var(--afrique-gold)]/25 transition-all group-hover:ring-[var(--afrique-gold)]/45">
                <Wrench className="text-brand transition-transform group-hover:-rotate-6" size={28} />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--afrique-earth)]">
                  Connexion
                </p>
                <h1 className="text-2xl font-bold tracking-tight text-slate-800 sm:text-3xl">
                  Atelier <span className="text-brand">Maître</span>
                </h1>
              </div>
            </Link>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">
                  Email ou code employé
                </label>
                <Input
                  type="text"
                  placeholder="admin@atelier.cm ou jean.dupont"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  autoComplete="username"
                  className="h-12 border-[var(--afrique-gold)]/25 bg-white/80 px-4 text-base focus-visible:border-brand focus-visible:ring-brand/20"
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-semibold text-slate-700">Mot de passe</label>
                  <Link
                    href="/forgot-password"
                    className="text-sm font-medium text-[var(--afrique-earth)] hover:text-brand hover:underline"
                  >
                    Oublié ?
                  </Link>
                </div>
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    className="h-12 border-[var(--afrique-gold)]/25 bg-white/80 pl-4 pr-12 text-base focus-visible:border-brand focus-visible:ring-brand/20"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Masquer' : 'Afficher'}
                    className="absolute right-0 top-0 flex h-full items-center px-4 text-slate-400 hover:text-[var(--afrique-earth)]"
                    disabled={loading}
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>

              {error && (
                <div
                  role="alert"
                  className="flex items-start gap-3 rounded-xl border border-[var(--afrique-coral)]/30 bg-[var(--afrique-terra-soft)] p-4 text-sm font-medium text-red-700"
                >
                  <ShieldCheck size={16} className="mt-0.5 shrink-0 text-[var(--afrique-terracotta)]" />
                  {error}
                </div>
              )}

              <Button
                type="submit"
                className="h-12 w-full rounded-xl bg-gradient-to-r from-brand via-[#1a6a9c] to-[var(--afrique-forest)] text-base font-semibold text-white shadow-lg shadow-brand/20 ring-1 ring-[var(--afrique-gold)]/30 hover:opacity-95"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 size={20} className="mr-2 animate-spin" /> Connexion…
                  </>
                ) : (
                  'Se connecter'
                )}
              </Button>

              <InstallAppButton
                variant="outline"
                size="lg"
                className="h-12 w-full rounded-xl border-[var(--afrique-gold)]/30 bg-white/60 text-slate-700"
              />
            </form>

            <div className="mt-8 overflow-hidden rounded-xl border border-[var(--afrique-forest)]/20 bg-[var(--afrique-forest-soft)] p-4 text-center ring-1 ring-[var(--afrique-forest-ring)]">
              <p className="text-sm font-medium text-slate-700">Pas encore de compte ?</p>
              <Link
                href="/inscription"
                className="mt-2 inline-flex text-sm font-semibold text-[var(--afrique-forest)] hover:underline"
              >
                Créer mon atelier →
              </Link>
            </div>

            <div className="mt-10 space-y-2 text-center">
              <p className="text-sm text-slate-400">
                © {new Date().getFullYear()} Atelier Maître
              </p>
              <Link href="/" className="text-sm font-medium text-brand hover:underline">
                Découvrir la plateforme
              </Link>
              <Link
                href="/demo"
                className="block text-sm font-medium text-[var(--afrique-earth)] hover:text-brand hover:underline"
              >
                Réserver une démo
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Panneau décoratif — desktop */}
      <div className="relative hidden min-h-0 flex-1 overflow-hidden lg:flex lg:flex-col">
        <div className="absolute inset-0 landing-cta-africa" />
        <div
          className="pointer-events-none absolute -right-16 top-1/3 h-72 w-72 rounded-full blur-3xl"
          style={{ background: 'rgba(212, 160, 23, 0.18)' }}
          aria-hidden
        />
        <div className="relative z-10 flex flex-1 items-center justify-end px-12 xl:px-20 2xl:px-24">
          <div className="max-w-md text-right text-white">
            <div className="mb-8 ml-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-white/12 ring-1 ring-white/25 backdrop-blur-sm">
              <ShieldCheck className="text-[var(--afrique-gold)]" size={40} />
            </div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/65">
              Garage · Cameroun
            </p>
            <h2 className="mt-3 text-3xl font-bold leading-tight tracking-tight xl:text-4xl">
              Efficacité &{' '}
              <span className="landing-accent-underline decoration-[var(--afrique-gold)]">
                précision
              </span>
            </h2>
            <p className="mt-4 text-pretty text-lg leading-relaxed text-white/85">
              OT, devis, stock et facturation — pensé pour le terrain, en français.
            </p>
          </div>
        </div>
      </div>
      </div>

      <span className="fixed bottom-4 right-4 z-50 rounded-md bg-slate-800/90 px-2 py-1 font-mono text-[11px] text-white backdrop-blur-sm">
        {appVersion}
      </span>
    </div>
  );
}
