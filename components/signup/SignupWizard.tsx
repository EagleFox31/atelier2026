'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CheckCircle2,
  Copy,
  Loader2,
  User,
  Users,
} from 'lucide-react';
import { LandingKenteBar } from '@/components/marketing/LandingKenteBar';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { signupApi, type SignupTeamCreated, handleApiError } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';
import { SIGNUP_TEAM_ROLES, type SignupTeamRoleCode } from '@/components/signup/signup-roles';
import { toast } from 'sonner';

const adminSchema = z
  .object({
    firstName: z.string().min(2, 'Prénom requis'),
    lastName: z.string().min(2, 'Nom requis'),
    email: z.string().email('Email invalide'),
    phone: z.string().optional(),
    password: z.string().min(8, '8 caractères minimum'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Les mots de passe ne correspondent pas',
    path: ['confirmPassword'],
  });

const workshopSchema = z.object({
  shopName: z.string().min(2, 'Nom du garage requis'),
  tagline: z.string().optional(),
  niu: z.string().optional(),
  email: z.string().email('Email invalide'),
  phone: z.string().min(8, 'Téléphone requis'),
  address: z.string().min(3, 'Adresse requise'),
  city: z.string().min(2, 'Ville requise'),
  defaultLaborRateXaf: z.string().optional(),
});

type AdminForm = z.infer<typeof adminSchema>;
type WorkshopForm = z.infer<typeof workshopSchema>;

function parseLaborRate(value?: string): number | undefined {
  if (!value?.trim()) return undefined;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

type TeamDraft = {
  roleCode: SignupTeamRoleCode;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
};

const STEPS = [
  { id: 1, label: 'Vous', icon: User },
  { id: 2, label: 'Garage', icon: Building2 },
  { id: 3, label: 'Équipe', icon: Users },
] as const;

export function SignupWizard() {
  const router = useRouter();
  const { setSessionFromToken } = useAuth();
  const [step, setStep] = useState(1);
  const [checking, setChecking] = useState(true);
  const [unavailable, setUnavailable] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [teamCreated, setTeamCreated] = useState<SignupTeamCreated[] | null>(null);

  const [adminData, setAdminData] = useState<AdminForm | null>(null);
  const [workshopData, setWorkshopData] = useState<WorkshopForm | null>(null);
  const [selectedRoles, setSelectedRoles] = useState<SignupTeamRoleCode[]>([]);
  const [teamDrafts, setTeamDrafts] = useState<Partial<Record<SignupTeamRoleCode, TeamDraft>>>({});

  const adminForm = useForm<AdminForm>({
    resolver: zodResolver(adminSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      password: '',
      confirmPassword: '',
    },
  });

  const workshopForm = useForm<WorkshopForm>({
    resolver: zodResolver(workshopSchema),
    defaultValues: {
      shopName: '',
      tagline: '',
      niu: '',
      email: '',
      phone: '',
      address: '',
      city: 'Douala',
      defaultLaborRateXaf: '15000',
    },
  });

  useEffect(() => {
    signupApi
      .status()
      .then((s) => {
        if (!s.available) setUnavailable(s.reason ?? 'Inscription indisponible.');
      })
      .catch(() => setUnavailable('Impossible de vérifier l\u2019inscription.'))
      .finally(() => setChecking(false));
  }, []);

  useEffect(() => {
    if (adminData?.email && !workshopForm.getValues('email')) {
      workshopForm.setValue('email', adminData.email);
    }
    if (adminData?.phone && !workshopForm.getValues('phone')) {
      workshopForm.setValue('phone', adminData.phone);
    }
  }, [adminData, workshopForm]);

  function toggleRole(code: SignupTeamRoleCode) {
    setSelectedRoles((prev) => {
      if (prev.includes(code)) {
        const next = prev.filter((c) => c !== code);
        return next;
      }
      setTeamDrafts((d) => ({
        ...d,
        [code]: d[code] ?? {
          roleCode: code,
          firstName: '',
          lastName: '',
          email: '',
          phone: '',
        },
      }));
      return [...prev, code];
    });
  }

  function updateTeamDraft(code: SignupTeamRoleCode, patch: Partial<TeamDraft>) {
    setTeamDrafts((d) => ({
      ...d,
      [code]: { ...(d[code] as TeamDraft), ...patch, roleCode: code },
    }));
  }

  async function finishSignup(skipTeam: boolean) {
    if (!adminData || !workshopData) return;

    const team = skipTeam
      ? []
      : selectedRoles
          .map((code) => teamDrafts[code])
          .filter(
            (m): m is TeamDraft =>
              Boolean(m?.firstName?.trim() && m?.lastName?.trim()),
          )
          .map((m) => ({
            roleCode: m.roleCode,
            firstName: m.firstName.trim(),
            lastName: m.lastName.trim(),
            email: m.email?.trim() || undefined,
            phone: m.phone?.trim() || undefined,
          }));

    setSubmitting(true);
    try {
      const res = await signupApi.register({
        admin: {
          firstName: adminData.firstName,
          lastName: adminData.lastName,
          email: adminData.email,
          phone: adminData.phone || undefined,
          password: adminData.password,
        },
        workshop: {
          shopName: workshopData.shopName,
          tagline: workshopData.tagline || undefined,
          niu: workshopData.niu || undefined,
          email: workshopData.email,
          phone: workshopData.phone,
          address: workshopData.address,
          city: workshopData.city,
          defaultLaborRateXaf: parseLaborRate(workshopData.defaultLaborRateXaf),
        },
        team: team.length > 0 ? team : undefined,
      });

      await setSessionFromToken(res.access_token);

      if (res.teamCreated.length > 0) {
        setTeamCreated(res.teamCreated);
        setStep(4);
      } else {
        toast.success('Votre atelier est prêt !');
        router.replace('/dashboard');
      }
    } catch (err: unknown) {
      handleApiError(err, 'Inscription impossible');
    } finally {
      setSubmitting(false);
    }
  }

  if (checking) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-brand" />
      </div>
    );
  }

  if (unavailable) {
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-[var(--afrique-gold)]/25 bg-white p-8 text-center shadow-lg">
        <p className="text-slate-600">{unavailable}</p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Link href="/login" className={buttonVariants()}>
            Se connecter
          </Link>
          <Link href="/demo" className={buttonVariants({ variant: 'outline' })}>
            Demander une démo
          </Link>
        </div>
      </div>
    );
  }

  if (step === 4 && teamCreated) {
    return (
      <div className="mx-auto max-w-lg space-y-6">
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--afrique-forest-soft)] ring-2 ring-[var(--afrique-forest-ring)]">
            <CheckCircle2 className="h-8 w-8 text-[var(--afrique-forest)]" />
          </div>
          <h2 className="mt-4 text-2xl font-bold text-slate-800">Comptes équipe créés</h2>
          <p className="mt-2 text-sm text-slate-600">
            Communiquez ces identifiants à votre équipe (mot de passe temporaire).
          </p>
        </div>
        <ul className="space-y-3">
          {teamCreated.map((m) => (
            <li
              key={m.employeeCode}
              className="rounded-xl border border-[var(--afrique-gold)]/20 bg-white p-4 text-sm shadow-sm"
            >
              <p className="font-semibold text-slate-800">
                {m.firstName} {m.lastName}{' '}
                <span className="text-xs font-normal text-muted-foreground">
                  ({SIGNUP_TEAM_ROLES.find((r) => r.code === m.roleCode)?.label})
                </span>
              </p>
              <p className="mt-1 font-mono text-xs text-slate-600">
                Code : {m.employeeCode} · MDP : {m.tempPassword}
              </p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="mt-2 h-8 gap-1 text-brand"
                onClick={() => {
                  void navigator.clipboard.writeText(
                    `${m.firstName} ${m.lastName}\nCode: ${m.employeeCode}\nMot de passe: ${m.tempPassword}`,
                  );
                  toast.success('Copié');
                }}
              >
                <Copy className="h-3.5 w-3.5" /> Copier
              </Button>
            </li>
          ))}
        </ul>
        <Button
          className="w-full h-12 rounded-xl bg-gradient-to-r from-brand to-[var(--afrique-forest)] text-white"
          onClick={() => router.replace('/dashboard')}
        >
          Accéder au tableau de bord
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      {/* Stepper */}
      <div className="mb-8 flex items-center justify-between gap-2">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const active = step === s.id;
          const done = step > s.id;
          return (
            <div key={s.id} className="flex flex-1 flex-col items-center gap-1.5">
              <div
                className={cn(
                  'flex h-10 w-10 items-center justify-center rounded-full border-2 text-sm font-bold transition-all',
                  done &&
                    'border-[var(--afrique-forest)] bg-[var(--afrique-forest)] text-white',
                  active &&
                    'border-[var(--afrique-gold)] bg-[var(--afrique-gold-soft)] text-[var(--afrique-earth)] ring-4 ring-[var(--afrique-gold)]/20',
                  !active &&
                    !done &&
                    'border-slate-200 bg-white text-slate-400',
                )}
              >
                {done ? <CheckCircle2 className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
              </div>
              <span
                className={cn(
                  'text-[11px] font-semibold uppercase tracking-wide',
                  active ? 'text-[var(--afrique-earth)]' : 'text-slate-400',
                )}
              >
                {s.label}
              </span>
              {i < STEPS.length - 1 && (
                <div
                  className="absolute hidden h-0.5 w-full bg-gradient-to-r from-[var(--afrique-gold)]/40 to-[var(--afrique-forest)]/40 md:block"
                  aria-hidden
                />
              )}
            </div>
          );
        })}
      </div>

      <div className="overflow-hidden rounded-2xl border border-[var(--afrique-gold)]/20 bg-white shadow-xl shadow-[var(--afrique-terra-soft)] ring-1 ring-slate-900/[0.04]">
        <LandingKenteBar className="h-1.5" />
        <div className="p-6 sm:p-8">
          {step === 1 && (
            <>
              <h2 className="text-xl font-bold text-slate-800">Vos informations</h2>
              <p className="mt-1 text-sm text-slate-600">
                Vous serez administrateur de l&apos;atelier — accès complet à la gestion.
              </p>
              <form
                className="mt-6 space-y-4"
                onSubmit={adminForm.handleSubmit((data) => {
                  setAdminData(data);
                  setStep(2);
                })}
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Prénom" error={adminForm.formState.errors.firstName?.message}>
                    <Input {...adminForm.register('firstName')} className="h-11" />
                  </Field>
                  <Field label="Nom" error={adminForm.formState.errors.lastName?.message}>
                    <Input {...adminForm.register('lastName')} className="h-11" />
                  </Field>
                </div>
                <Field label="Email" error={adminForm.formState.errors.email?.message}>
                  <Input type="email" {...adminForm.register('email')} className="h-11" />
                </Field>
                <Field label="Téléphone (optionnel)" error={adminForm.formState.errors.phone?.message}>
                  <Input {...adminForm.register('phone')} className="h-11" placeholder="+237 6…" />
                </Field>
                <Field label="Mot de passe" error={adminForm.formState.errors.password?.message}>
                  <Input type="password" {...adminForm.register('password')} className="h-11" />
                </Field>
                <Field label="Confirmer" error={adminForm.formState.errors.confirmPassword?.message}>
                  <Input type="password" {...adminForm.register('confirmPassword')} className="h-11" />
                </Field>
                <Button
                  type="submit"
                  className="h-12 w-full rounded-xl bg-gradient-to-r from-brand via-[#1a6a9c] to-[var(--afrique-forest)] text-white shadow-md ring-1 ring-[var(--afrique-gold)]/30"
                >
                  Continuer <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </form>
            </>
          )}

          {step === 2 && (
            <>
              <h2 className="text-xl font-bold text-slate-800">Votre garage</h2>
              <p className="mt-1 text-sm text-slate-600">
                Ces informations apparaîtront sur vos devis et factures.
              </p>
              <form
                className="mt-6 space-y-4"
                onSubmit={workshopForm.handleSubmit((data) => {
                  setWorkshopData(data);
                  setStep(3);
                })}
              >
                <Field label="Nom de l'atelier / garage" error={workshopForm.formState.errors.shopName?.message}>
                  <Input {...workshopForm.register('shopName')} className="h-11" />
                </Field>
                <Field label="Ville" error={workshopForm.formState.errors.city?.message}>
                  <Input {...workshopForm.register('city')} className="h-11" />
                </Field>
                <Field label="Adresse" error={workshopForm.formState.errors.address?.message}>
                  <Input {...workshopForm.register('address')} className="h-11" />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Email garage" error={workshopForm.formState.errors.email?.message}>
                    <Input type="email" {...workshopForm.register('email')} className="h-11" />
                  </Field>
                  <Field label="Téléphone" error={workshopForm.formState.errors.phone?.message}>
                    <Input {...workshopForm.register('phone')} className="h-11" />
                  </Field>
                </div>
                <Field label="NIU (optionnel)" error={workshopForm.formState.errors.niu?.message}>
                  <Input {...workshopForm.register('niu')} className="h-11" placeholder="M012345678901X" />
                </Field>
                <Field
                  label="Taux main-d'œuvre par défaut (XAF/h)"
                  error={workshopForm.formState.errors.defaultLaborRateXaf?.message}
                >
                  <Input
                    type="number"
                    inputMode="numeric"
                    {...workshopForm.register('defaultLaborRateXaf')}
                    className="h-11"
                  />
                </Field>
                <div className="flex gap-2 pt-2">
                  <Button type="button" variant="outline" className="h-11 flex-1" onClick={() => setStep(1)}>
                    <ArrowLeft className="mr-2 h-4 w-4" /> Retour
                  </Button>
                  <Button
                    type="submit"
                    className="h-11 flex-[2] rounded-xl bg-gradient-to-r from-brand to-[var(--afrique-forest)] text-white"
                  >
                    Continuer <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </form>
            </>
          )}

          {step === 3 && (
            <>
              <h2 className="text-xl font-bold text-slate-800">Votre équipe</h2>
              <p className="mt-1 text-sm text-slate-600">
                Créez des comptes liés à votre garage (optionnel). Super Admin réservé à la plateforme.
              </p>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {SIGNUP_TEAM_ROLES.map((role) => {
                  const selected = selectedRoles.includes(role.code);
                  const Icon = role.icon;
                  return (
                    <div key={role.code} className="space-y-3">
                      <button
                        type="button"
                        onClick={() => toggleRole(role.code)}
                        className={cn(
                          'w-full rounded-xl border-2 p-4 text-left transition-all',
                          role.accent,
                          selected && `ring-2 ${role.ring} scale-[1.02]`,
                          !selected && 'opacity-90 hover:opacity-100',
                        )}
                      >
                        <div className={cn('mb-3 flex h-10 w-10 items-center justify-center rounded-lg', role.iconBg)}>
                          <Icon className="h-5 w-5" />
                        </div>
                        <p className="font-semibold text-slate-800">{role.label}</p>
                        <p className="mt-0.5 text-xs text-slate-600">{role.description}</p>
                        {selected && (
                          <span className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-[var(--afrique-forest)]">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Sélectionné
                          </span>
                        )}
                      </button>
                      {selected && (
                        <div className="space-y-2 rounded-lg border border-slate-100 bg-slate-50/80 p-3">
                          <div className="grid grid-cols-2 gap-2">
                            <Input
                              placeholder="Prénom"
                              value={teamDrafts[role.code]?.firstName ?? ''}
                              onChange={(e) =>
                                updateTeamDraft(role.code, { firstName: e.target.value })
                              }
                              className="h-9 text-sm"
                            />
                            <Input
                              placeholder="Nom"
                              value={teamDrafts[role.code]?.lastName ?? ''}
                              onChange={(e) =>
                                updateTeamDraft(role.code, { lastName: e.target.value })
                              }
                              className="h-9 text-sm"
                            />
                          </div>
                          <Input
                            placeholder="Email (optionnel)"
                            type="email"
                            value={teamDrafts[role.code]?.email ?? ''}
                            onChange={(e) => updateTeamDraft(role.code, { email: e.target.value })}
                            className="h-9 text-sm"
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="mt-8 flex flex-col gap-2 sm:flex-row">
                <Button type="button" variant="outline" className="h-11" onClick={() => setStep(2)}>
                  <ArrowLeft className="mr-2 h-4 w-4" /> Retour
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="h-11 text-slate-600"
                  disabled={submitting}
                  onClick={() => finishSignup(true)}
                >
                  Passer cette étape
                </Button>
                <Button
                  type="button"
                  className="h-11 flex-1 rounded-xl bg-gradient-to-r from-[var(--afrique-gold)] to-[var(--afrique-terracotta)] text-white shadow-md"
                  disabled={submitting}
                  onClick={() => finishSignup(false)}
                >
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      Créer mon atelier <CheckCircle2 className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-slate-700">{label}</label>
      {children}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
