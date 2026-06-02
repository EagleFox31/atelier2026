'use client';

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { teamApi } from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";
import {
  Eye, EyeOff, ShieldCheck, Wrench, Settings, UserCheck,
  CreditCard, ChevronRight, ChevronLeft, Check, Copy,
} from 'lucide-react';
import { cn } from "@/lib/utils";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChevronsUpDown } from 'lucide-react';

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
  ADMIN:        ['CHEF_ATELIER', 'TECHNICIEN', 'RECEPTIONNISTE', 'CAISSIER'],
  CHEF_ATELIER: ['TECHNICIEN', 'RECEPTIONNISTE'],
};

const SPECIALTIES = ['Mécanique', 'Électricité', 'Carrosserie', 'Climatisation', 'Pneumatiques', 'Diagnostic', 'Autre'];

// ── Helpers ───────────────────────────────────────────────────────────────────

function generatePassword(firstName: string): string {
  const digits = Math.floor(1000 + Math.random() * 9000);
  const base = firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase();
  return `${base}${digits}!`;
}

function toEmployeeCode(first: string, last: string): string {
  const n = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]/g, '');
  return `${n(first)}.${n(last)}`;
}

// ── Schéma ────────────────────────────────────────────────────────────────────

const infoSchema = z.object({
  firstName: z.string().min(2, "Prénom requis"),
  lastName:  z.string().min(2, "Nom requis"),
  specialty: z.string().optional(),
  phone:     z.string().optional(),
  email:     z.string().email("Email invalide").optional().or(z.literal("")),
});
type InfoValues = z.infer<typeof infoSchema>;

// ── Stepper indicator ─────────────────────────────────────────────────────────

const STEPS = ['Type de compte', 'Informations', 'Récapitulatif'];

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-6">
      {STEPS.map((label, i) => (
        <React.Fragment key={i}>
          <div className="flex items-center gap-1.5">
            <div className={cn(
              "w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold border-2 transition-all",
              i < current   ? "bg-brand border-brand text-white" :
              i === current ? "border-brand text-brand bg-white" :
                              "border-slate-200 text-slate-400 bg-white"
            )}>
              {i < current ? <Check size={13} /> : i + 1}
            </div>
            <span className={cn("text-xs font-medium hidden sm:block",
              i === current ? "text-brand" : "text-slate-400")}>{label}</span>
          </div>
          {i < STEPS.length - 1 && (
            <div className={cn("h-px w-8 transition-all", i < current ? "bg-brand" : "bg-slate-200")} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

// ── Combobox spécialité ───────────────────────────────────────────────────────

function SpecialtyCombobox({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');

  const options = SPECIALTIES.filter(s => !input || s.toLowerCase().includes(input.toLowerCase()));
  const showCreate = input && !SPECIALTIES.some(s => s.toLowerCase() === input.toLowerCase());

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className="w-full flex items-center justify-between h-10 px-3 py-2 rounded-md border border-slate-200 bg-white text-sm text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand/20">
        {value || 'Sélectionner ou saisir'}
        <ChevronsUpDown size={14} className="ml-2 text-slate-400" />
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" align="start">
        <Command>
          <CommandInput placeholder="Rechercher ou saisir..." value={input}
            onValueChange={setInput} />
          <CommandEmpty>Aucun résultat</CommandEmpty>
          <CommandGroup>
            {options.map(s => (
              <CommandItem key={s} value={s} onSelect={() => { onChange(s); setInput(''); setOpen(false); }}>
                <Check size={14} className={cn("mr-2", value === s ? "opacity-100" : "opacity-0")} />
                {s}
              </CommandItem>
            ))}
            {showCreate && (
              <CommandItem value={input} onSelect={() => { onChange(input); setInput(''); setOpen(false); }}>
                <span className="text-brand mr-2">+</span> Ajouter «{input}»
              </CommandItem>
            )}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// ── Composant principal ───────────────────────────────────────────────────────

interface TeamMemberFormProps { onSuccess?: () => void; }

export function TeamMemberForm({ onSuccess }: TeamMemberFormProps) {
  const { hasRole } = useAuth();
  const [step, setStep]               = useState(0);
  const [selectedRole, setRole]       = useState<RoleCode | null>(null);
  const [generatedPwd, setGenPwd]     = useState('');
  const [showPwd, setShowPwd]         = useState(false);
  const [submitting, setSubmitting]   = useState(false);
  const [copied, setCopied]           = useState(false);
  const [duplicates, setDuplicates]   = useState<any[]>([]);
  const [checkingDup, setCheckingDup] = useState(false);

  const infoForm = useForm<InfoValues>({
    resolver: zodResolver(infoSchema) as any,
    defaultValues: { firstName: '', lastName: '', specialty: '', phone: '', email: '' },
  });

  const { firstName, lastName } = infoForm.watch();
  const previewCode = firstName && lastName ? toEmployeeCode(firstName, lastName) : null;

  // Génère le mot de passe dès que le prénom est saisi
  useEffect(() => {
    if (firstName?.length >= 2) setGenPwd(generatePassword(firstName));
  }, [firstName]);

  const availableRoles = (Object.entries(CREATABLE_BY) as [string, RoleCode[]][])
    .filter(([r]) => hasRole(r))
    .flatMap(([, roles]) => roles)
    .filter((v, i, a) => a.indexOf(v) === i);

  function copyPassword() {
    navigator.clipboard.writeText(generatedPwd);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleCreate() {
    if (!selectedRole) return;
    const info = infoForm.getValues();
    setSubmitting(true);
    try {
      const created = await teamApi.create({
        firstName: info.firstName,
        lastName:  info.lastName,
        phone:     info.phone     || undefined,
        email:     info.email     || undefined,
        specialty: info.specialty || undefined,
        roleCode:  selectedRole,
        password:  generatedPwd,
      }) as any;
      toast.success(`Compte créé — identifiant : ${created.employeeCode}`, { duration: 8000 });
      infoForm.reset();
      setStep(0); setRole(null); setGenPwd('');
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

      {/* ── Étape 1 : Rôle ── */}
      {step === 0 && (
        <div className="space-y-3">
          <p className="text-sm text-slate-500 text-center mb-4">
            Quel type de compte souhaitez-vous créer ?
          </p>
          {availableRoles.map(code => {
            const cfg = ROLE_CONFIG[code];
            const Icon = cfg.icon;
            return (
              <button key={code} type="button" onClick={() => setRole(code)}
                className={cn(
                  "w-full flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-all",
                  selectedRole === code ? `${cfg.color} shadow-sm` : "border-slate-100 hover:border-slate-200 bg-white"
                )}>
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

      {/* ── Étape 2 : Informations ── */}
      {step === 1 && (
        <Form {...infoForm}>
          <form onSubmit={async e => {
              e.preventDefault();
              const ok = await infoForm.trigger();
              if (!ok) return;
              const { firstName, lastName } = infoForm.getValues();
              setCheckingDup(true);
              try {
                const results = await teamApi.list({ search: `${firstName} ${lastName}` }) as any[];
                const found = results.filter((m: any) =>
                  m.firstName.toLowerCase() === firstName.toLowerCase() &&
                  m.lastName.toLowerCase() === lastName.toLowerCase()
                );
                setDuplicates(found);
              } catch { setDuplicates([]); }
              finally { setCheckingDup(false); }
              setStep(2);
            }}
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

            {/* Preview identifiant + mdp */}
            {previewCode && (
              <div className="rounded-lg bg-slate-50 border border-slate-200 px-4 py-3 space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">Identifiant</span>
                  <span className="font-mono font-semibold text-brand">{previewCode}</span>
                </div>
                {generatedPwd && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">Mot de passe</span>
                    <span className="font-mono font-semibold text-slate-700">{generatedPwd}</span>
                  </div>
                )}
              </div>
            )}

            {/* Spécialité — uniquement pour TECHNICIEN */}
            {selectedRole === 'TECHNICIEN' && (
              <FormField control={infoForm.control} name="specialty" render={({ field }) => (
                <FormItem>
                  <FormLabel>Spécialité</FormLabel>
                  <FormControl>
                    <SpecialtyCombobox value={field.value ?? ''} onChange={field.onChange} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
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

      {/* ── Étape 3 : Récapitulatif ── */}
      {step === 2 && selectedRole && (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 divide-y divide-slate-100 text-sm overflow-hidden">
            {[
              { label: 'Rôle',        value: ROLE_CONFIG[selectedRole].label },
              { label: 'Nom complet', value: `${infoForm.getValues('firstName')} ${infoForm.getValues('lastName')}` },
              ...(infoForm.getValues('specialty') ? [{ label: 'Spécialité', value: infoForm.getValues('specialty')! }] : []),
              ...(infoForm.getValues('phone') ? [{ label: 'Téléphone', value: infoForm.getValues('phone')! }] : []),
              { label: 'Identifiant', value: previewCode ?? '' },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between px-4 py-2.5">
                <span className="text-slate-500">{label}</span>
                <span className={cn("font-semibold", label === 'Identifiant' && "font-mono text-brand")}>{value}</span>
              </div>
            ))}

            {/* Mot de passe avec bouton révéler + copier */}
            <div className="flex items-center justify-between px-4 py-2.5">
              <span className="text-slate-500">Mot de passe</span>
              <div className="flex items-center gap-2">
                <span className="font-mono font-semibold text-slate-700">
                  {showPwd ? generatedPwd : '••••••••'}
                </span>
                <button type="button" onClick={() => setShowPwd(v => !v)}
                  className="text-slate-400 hover:text-slate-600">
                  {showPwd ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
                <button type="button" onClick={copyPassword}
                  className="text-slate-400 hover:text-brand transition-colors">
                  {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                </button>
              </div>
            </div>
          </div>

          <p className="text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
            ⚠️ Notez ce mot de passe maintenant — vous pourrez toujours le voir depuis la page Équipe.
          </p>

          {/* Alerte doublons */}
          {checkingDup && (
            <p className="text-xs text-slate-500 text-center animate-pulse">Vérification des doublons...</p>
          )}
          {!checkingDup && duplicates.length > 0 && (
            <div className="rounded-lg border border-orange-200 bg-orange-50 px-3 py-2.5 text-sm">
              <p className="font-semibold text-orange-700 mb-1">
                ⚠️ {duplicates.length === 1 ? 'Un employé' : 'Des employés'} du même nom exist{duplicates.length === 1 ? 'e' : 'ent'} déjà :
              </p>
              {duplicates.map((d: any) => (
                <p key={d.id} className="text-orange-600 font-mono text-xs">
                  {d.firstName} {d.lastName} — <span className="font-semibold">{d.employeeCode}</span>
                  {d.roles?.[0]?.role?.label && <span className="ml-1 text-orange-500">({d.roles[0].role.label})</span>}
                </p>
              ))}
              <p className="mt-1.5 text-orange-600 text-xs">Vous pouvez quand même créer ce compte si c&apos;est intentionnel.</p>
            </div>
          )}

          <div className="flex justify-between pt-2">
            <Button type="button" variant="outline" onClick={() => { setStep(1); setDuplicates([]); }}>
              <ChevronLeft size={16} className="mr-1" /> Retour
            </Button>
            <Button onClick={handleCreate} disabled={submitting} className="bg-brand hover:bg-brand-hover">
              {submitting ? 'Création...' : duplicates.length > 0 ? 'Créer quand même' : 'Créer le compte'}
              {!submitting && <Check size={16} className="ml-1" />}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
