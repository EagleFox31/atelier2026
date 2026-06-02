'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { teamApi } from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";
import { Eye, EyeOff, ShieldCheck, Wrench, Settings, UserCheck, CreditCard, ChevronRight, ChevronLeft, Check } from 'lucide-react';
import { cn } from "@/lib/utils";

// ── Config rôles ──────────────────────────────────────────────────────────────

const ROLE_CONFIG = {
  ADMIN: {
    label: 'Administrateur',
    description: 'Accès complet — gestion équipe, paramètres, rapports',
    icon: ShieldCheck,
    color: 'text-purple-600 bg-purple-50 border-purple-200',
  },
  CHEF_ATELIER: {
    label: "Chef d'Atelier",
    description: "Gestion des OT, supervision technique et stock",
    icon: Wrench,
    color: 'text-blue-600 bg-blue-50 border-blue-200',
  },
  TECHNICIEN: {
    label: 'Technicien',
    description: 'Consultation des ordres de travail et du stock',
    icon: Settings,
    color: 'text-green-600 bg-green-50 border-green-200',
  },
  RECEPTIONNISTE: {
    label: 'Réceptionnaire',
    description: 'Accueil clients, création des OT et véhicules',
    icon: UserCheck,
    color: 'text-orange-600 bg-orange-50 border-orange-200',
  },
  CAISSIER: {
    label: 'Caissier',
    description: 'Facturation, encaissements et suivi des paiements',
    icon: CreditCard,
    color: 'text-teal-600 bg-teal-50 border-teal-200',
  },
} as const;

type RoleCode = keyof typeof ROLE_CONFIG;

const CREATABLE_BY: Record<string, RoleCode[]> = {
  SUPER_ADMIN: ['ADMIN', 'CHEF_ATELIER', 'TECHNICIEN', 'RECEPTIONNISTE', 'CAISSIER'],
  ADMIN:       ['CHEF_ATELIER', 'TECHNICIEN', 'RECEPTIONNISTE', 'CAISSIER'],
  CHEF_ATELIER: ['TECHNICIEN', 'RECEPTIONNISTE'],
};

// ── Schéma ────────────────────────────────────────────────────────────────────

const infoSchema = z.object({
  firstName: z.string().min(2, "Prénom requis"),
  lastName:  z.string().min(2, "Nom requis"),
  phone:     z.string().optional(),
  email:     z.string().email("Email invalide").optional().or(z.literal("")),
});
type InfoValues = z.infer<typeof infoSchema>;

const accessSchema = z.object({
  password: z.string().min(6, "Minimum 6 caractères").optional().or(z.literal("")),
});
type AccessValues = z.infer<typeof accessSchema>;

// ── Composant stepper ─────────────────────────────────────────────────────────

const STEPS = ['Type de compte', 'Informations', 'Accès'];

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-6">
      {STEPS.map((label, i) => (
        <React.Fragment key={i}>
          <div className="flex items-center gap-1.5">
            <div className={cn(
              "w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold border-2 transition-all",
              i < current  ? "bg-brand border-brand text-white" :
              i === current ? "border-brand text-brand bg-white" :
                             "border-slate-200 text-slate-400 bg-white"
            )}>
              {i < current ? <Check size={13} /> : i + 1}
            </div>
            <span className={cn(
              "text-xs font-medium hidden sm:block",
              i === current ? "text-brand" : "text-slate-400"
            )}>{label}</span>
          </div>
          {i < STEPS.length - 1 && (
            <div className={cn("h-px w-8 transition-all", i < current ? "bg-brand" : "bg-slate-200")} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface TeamMemberFormProps {
  onSuccess?: () => void;
}

export function TeamMemberForm({ onSuccess }: TeamMemberFormProps) {
  const { hasRole } = useAuth();
  const [step, setStep]           = useState(0);
  const [selectedRole, setRole]   = useState<RoleCode | null>(null);
  const [showPassword, setShowPwd] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const infoForm = useForm<InfoValues>({
    resolver: zodResolver(infoSchema) as any,
    defaultValues: { firstName: '', lastName: '', phone: '', email: '' },
  });
  const accessForm = useForm<AccessValues>({
    resolver: zodResolver(accessSchema) as any,
    defaultValues: { password: '' },
  });

  // Rôles que l'utilisateur connecté peut créer
  const availableRoles = Object.entries(CREATABLE_BY)
    .filter(([creatorRole]) => hasRole(creatorRole))
    .flatMap(([, roles]) => roles)
    .filter((v, i, a) => a.indexOf(v) === i) as RoleCode[];

  // Preview identifiant
  const { firstName, lastName } = infoForm.watch();
  const previewCode = firstName && lastName
    ? `${firstName}.${lastName}`
        .toLowerCase()
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z.]/g, '')
    : null;

  async function handleFinalSubmit() {
    const infoValid = await infoForm.trigger();
    if (!infoValid || !selectedRole) return;

    const infoValues  = infoForm.getValues();
    const accessValues = accessForm.getValues();

    setSubmitting(true);
    try {
      const created = await teamApi.create({
        firstName: infoValues.firstName,
        lastName:  infoValues.lastName,
        phone:     infoValues.phone  || undefined,
        email:     infoValues.email  || undefined,
        roleCode:  selectedRole,
        password:  accessValues.password || undefined,
      }) as any;

      toast.success(
        `${infoValues.firstName} ${infoValues.lastName} créé — identifiant : ${created.employeeCode}`,
        { duration: 8000 }
      );
      infoForm.reset();
      accessForm.reset();
      setStep(0);
      setRole(null);
      onSuccess?.();
    } catch {
      toast.error("Erreur lors de la création");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-w-0">
      <StepIndicator current={step} />

      {/* ── Étape 1 : Choix du rôle ── */}
      {step === 0 && (
        <div className="space-y-3">
          <p className="text-sm text-slate-500 text-center mb-4">
            Quel type de compte souhaitez-vous créer ?
          </p>
          {availableRoles.map(code => {
            const cfg = ROLE_CONFIG[code];
            const Icon = cfg.icon;
            return (
              <button
                key={code}
                type="button"
                onClick={() => setRole(code)}
                className={cn(
                  "w-full flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-all",
                  selectedRole === code
                    ? `${cfg.color} shadow-sm`
                    : "border-slate-100 hover:border-slate-200 bg-white"
                )}
              >
                <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0", cfg.color)}>
                  <Icon size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-800 text-sm">{cfg.label}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{cfg.description}</p>
                </div>
                {selectedRole === code && <Check size={18} className="text-brand flex-shrink-0" />}
              </button>
            );
          })}
          <div className="flex justify-end pt-2">
            <Button onClick={() => setStep(1)} disabled={!selectedRole} className="bg-brand hover:bg-brand-hover">
              Suivant <ChevronRight size={16} className="ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* ── Étape 2 : Informations personnelles ── */}
      {step === 1 && (
        <Form {...infoForm}>
          <form onSubmit={e => { e.preventDefault(); infoForm.trigger().then(ok => ok && setStep(2)); }}
            className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField control={infoForm.control} name="firstName" render={({ field }) => (
                <FormItem>
                  <FormLabel>Prénom</FormLabel>
                  <FormControl><Input placeholder="Jean" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={infoForm.control} name="lastName" render={({ field }) => (
                <FormItem>
                  <FormLabel>Nom</FormLabel>
                  <FormControl><Input placeholder="Dupont" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            {previewCode && (
              <div className="rounded-lg bg-slate-50 border border-slate-200 px-4 py-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-brand/10 flex items-center justify-center text-brand font-bold text-sm">
                  {firstName[0]?.toUpperCase()}
                </div>
                <div>
                  <p className="text-xs text-slate-500">Identifiant de connexion généré</p>
                  <p className="font-mono font-semibold text-slate-800">{previewCode}</p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <FormField control={infoForm.control} name="phone" render={({ field }) => (
                <FormItem>
                  <FormLabel>Téléphone <span className="text-slate-400 font-normal">(optionnel)</span></FormLabel>
                  <FormControl><Input placeholder="+237 6..." {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={infoForm.control} name="email" render={({ field }) => (
                <FormItem>
                  <FormLabel>Email <span className="text-slate-400 font-normal">(optionnel)</span></FormLabel>
                  <FormControl><Input placeholder="jean@exemple.cm" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <div className="flex justify-between pt-2">
              <Button type="button" variant="outline" onClick={() => setStep(0)}>
                <ChevronLeft size={16} className="mr-1" /> Retour
              </Button>
              <Button type="submit" className="bg-brand hover:bg-brand-hover">
                Suivant <ChevronRight size={16} className="ml-1" />
              </Button>
            </div>
          </form>
        </Form>
      )}

      {/* ── Étape 3 : Accès ── */}
      {step === 2 && selectedRole && (
        <div className="space-y-4">
          {/* Récap */}
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Rôle</span>
              <span className="font-semibold">{ROLE_CONFIG[selectedRole].label}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Nom</span>
              <span className="font-semibold">{infoForm.getValues('firstName')} {infoForm.getValues('lastName')}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Identifiant</span>
              <span className="font-mono font-semibold text-brand">{previewCode}</span>
            </div>
          </div>

          <Form {...accessForm}>
            <form onSubmit={e => { e.preventDefault(); handleFinalSubmit(); }} className="space-y-4">
              <FormField control={accessForm.control} name="password" render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Mot de passe&nbsp;
                    <span className="text-slate-400 font-normal text-xs">(défaut : Atelier2026!)</span>
                  </FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Laisser vide pour le mot de passe par défaut"
                        {...field}
                      />
                      <button type="button" onClick={() => setShowPwd(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <div className="flex justify-between pt-2">
                <Button type="button" variant="outline" onClick={() => setStep(1)}>
                  <ChevronLeft size={16} className="mr-1" /> Retour
                </Button>
                <Button type="submit" disabled={submitting} className="bg-brand hover:bg-brand-hover">
                  {submitting ? 'Création...' : 'Créer le compte'}
                  {!submitting && <Check size={16} className="ml-1" />}
                </Button>
              </div>
            </form>
          </Form>
        </div>
      )}
    </div>
  );
}
