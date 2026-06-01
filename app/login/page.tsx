'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/auth-context';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Wrench, Loader2, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { getApiErrorMessage, type ApiUser } from '@/lib/api';
import { resolvePostLoginRoute } from '@/lib/role-routing';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        try { user = JSON.parse(userRaw) as ApiUser; } catch { /* ignore */ }
      }
      router.replace(resolvePostLoginRoute(user, returnUrl));
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Identifiants invalides'));
    } finally {
      setLoading(false);
    }
  }

  const appVersion = process.env.NEXT_PUBLIC_APP_VERSION ?? 'dev';

  return (
    <div className="flex min-h-screen bg-white">
      {/* Colonne Gauche : Formulaire (Clair et épuré) */}
      <div className="flex w-full flex-col justify-center px-8 sm:px-16 lg:w-1/2 xl:px-24">
        <div className="mx-auto w-full max-w-sm">
          {/* Logo */}
          <div className="mb-8 flex flex-col items-start gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand/10 shadow-sm">
              <Wrench className="text-brand" size={28} />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Atelier 2026</h1>
              <p className="mt-1 text-sm text-slate-500">
                Gestion d'atelier automobile premium
              </p>
            </div>
          </div>

          {/* Formulaire */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">
                Email ou Code Employé
              </label>
              <Input
                type="text"
                placeholder="admin@atelier.cm ou EMP-001"
                value={identifier}
                onChange={e => setIdentifier(e.target.value)}
                autoComplete="username"
                className="h-12 border-slate-200 bg-slate-50 px-4 text-base transition-colors focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-brand/20 focus-visible:border-brand"
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold text-slate-700">
                  Mot de passe
                </label>
                <Link
                  href="/forgot-password"
                  className="text-sm font-medium text-brand hover:text-brand-hover hover:underline transition-colors"
                >
                  Oublié ?
                </Link>
              </div>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoComplete="current-password"
                  className="h-12 border-slate-200 bg-slate-50 pl-4 pr-12 text-base transition-colors focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-brand/20 focus-visible:border-brand"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Masquer' : 'Afficher'}
                  className="absolute right-0 top-0 h-full px-4 text-slate-400 hover:text-slate-600 transition-colors focus:outline-none"
                  disabled={loading}
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            {error && (
              <div
                role="alert"
                className="rounded-xl border border-red-100 bg-red-50/50 p-4 text-sm font-medium text-red-600 flex items-start gap-3"
              >
                <div className="mt-0.5">
                  <ShieldCheck size={16} className="text-red-500" />
                </div>
                {error}
              </div>
            )}

            <Button
              type="submit"
              className="h-12 w-full rounded-xl bg-brand text-base font-semibold text-white shadow-lg shadow-brand/25 hover:bg-brand-hover hover:-translate-y-0.5 transition-all duration-200"
              disabled={loading}
            >
              {loading ? (
                <><Loader2 size={20} className="mr-2 animate-spin" /> Connexion en cours...</>
              ) : (
                'Se connecter'
              )}
            </Button>
          </form>

          <div className="mt-10 text-center">
            <p className="text-sm text-slate-400">
              © {new Date().getFullYear()} Atelier 2026. CEMAC Compliant.
            </p>
          </div>
        </div>
      </div>

      {/* Version — bas droite */}
      <span className="fixed bottom-3 right-4 font-mono text-[11px] text-slate-400 select-none pointer-events-none bg-white/60 px-1.5 py-0.5 rounded">
        {appVersion}
      </span>

      {/* Colonne Droite : Image/Gradient (Cachée sur mobile) */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-slate-50 items-center justify-center overflow-hidden">
        {/* Un fond très lumineux et élégant avec des formes abstraites */}
        <div className="absolute inset-0 bg-gradient-to-br from-brand/5 via-brand/10 to-brand-light opacity-80" />
        
        {/* Formes décoratives type Glassmorphism */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-brand/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-blue-400/10 rounded-full blur-3xl" />
        
        <div className="relative z-10 max-w-md text-center">
          <div className="mb-6 mx-auto flex h-24 w-24 items-center justify-center rounded-3xl bg-white/60 shadow-xl backdrop-blur-xl border border-white/50">
            <ShieldCheck className="text-brand" size={48} />
          </div>
          <h2 className="text-3xl font-bold text-slate-800 mb-4">
            Efficacité & Précision
          </h2>
          <p className="text-lg text-slate-600 leading-relaxed">
            Votre plateforme intelligente pour gérer l'atelier de A à Z.
            Devis, pièces, réparations et facturation en toute simplicité.
          </p>
        </div>
      </div>
    </div>
  );
}

