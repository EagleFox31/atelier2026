'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { ArrowLeft, CalendarDays, CheckCircle2, Loader2, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { marketingApi, getApiErrorMessage } from '@/lib/api';
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';
import { BrandCalligraphy } from '@/components/marketing/brand-calligraphy';
import { LandingKenteBar } from '@/components/marketing/LandingKenteBar';

const schema = z.object({
  fullName: z.string().min(2, 'Nom requis'),
  email: z.string().email('Email invalide'),
  phone: z.string().min(8, 'Téléphone requis (min. 8 caractères)'),
  garageName: z.string().min(2, 'Nom de l\'atelier requis'),
  city: z.string().optional(),
  message: z.string().max(2000).optional(),
});

type FormValues = z.infer<typeof schema>;

export function DemoRequestForm() {
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      fullName: '',
      email: '',
      phone: '',
      garageName: '',
      city: '',
      message: '',
    },
  });

  const loading = form.formState.isSubmitting;

  async function onSubmit(values: FormValues) {
    setSubmitError(null);
    try {
      await marketingApi.requestDemo({
        fullName: values.fullName.trim(),
        email: values.email.trim(),
        phone: values.phone.trim(),
        garageName: values.garageName.trim(),
        city: values.city?.trim() || undefined,
        message: values.message?.trim() || undefined,
      });
      setSubmitted(true);
    } catch (err: unknown) {
      setSubmitError(
        getApiErrorMessage(err, 'Une erreur est survenue. Veuillez réessayer.'),
      );
    }
  }

  if (submitted) {
    return (
      <div className="mx-auto w-full max-w-md overflow-hidden rounded-2xl border border-[var(--afrique-gold)]/25 bg-white text-center shadow-xl shadow-[var(--afrique-terra-soft)] ring-1 ring-slate-900/[0.04]">
        <LandingKenteBar className="h-1.5" />
        <div className="p-8 sm:p-10">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[var(--afrique-forest-soft)] ring-2 ring-[var(--afrique-forest-ring)]">
            <CheckCircle2 className="text-[var(--afrique-forest)]" size={36} />
          </div>
          <p className="mt-6 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--afrique-earth)]">
            Merci
          </p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-800">
            Demande <span className="landing-accent-underline">bien reçue</span>
          </h1>
          <p className="mt-3 text-pretty text-slate-600 leading-relaxed">
            Notre équipe vous contactera sous{' '}
            <strong className="font-medium text-[var(--afrique-forest)]">48 h ouvrées</strong> pour
            une démo de <BrandCalligraphy className="text-[1.2em]">30 min</BrandCalligraphy>.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/"
              className={cn(
                buttonVariants({ variant: 'outline' }),
                'rounded-xl border-[var(--afrique-gold)]/30',
              )}
            >
              Retour à l&apos;accueil
            </Link>
            <Link
              href="/login"
              className={cn(
                buttonVariants(),
                'rounded-xl landing-auth-btn-primary shadow-sm',
              )}
            >
              Accéder à l&apos;app
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-lg">
      <Link
        href="/"
        className="mb-8 inline-flex items-center gap-2 text-sm font-medium text-[var(--afrique-earth)] transition-colors hover:text-brand"
      >
        <ArrowLeft size={16} />
        Retour
      </Link>

      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--afrique-earth)]">
        Démonstration
      </p>
      <div className="mb-8 flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--afrique-gold-soft)] ring-1 ring-[var(--afrique-gold-ring)]">
          <CalendarDays className="text-[#8a6914]" size={24} />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-800 sm:text-3xl">
            Réserver une <span className="landing-accent-underline">démo</span>
          </h1>
        </div>
      </div>

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="relative overflow-hidden space-y-5 rounded-2xl border border-[var(--afrique-gold)]/20 bg-white p-6 pt-7 shadow-xl shadow-[var(--afrique-terra-soft)] ring-1 ring-slate-900/[0.04] sm:p-8 sm:pt-9"
        >
          <LandingKenteBar className="absolute inset-x-0 top-0 h-1" />
          <div className="grid gap-5 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="fullName"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel className="text-slate-700">Nom complet</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="Jean Kengne"
                      className="h-11 border-[var(--afrique-gold)]/20 bg-[var(--afrique-sand)]/50 focus-visible:border-brand focus-visible:ring-brand/20"
                      disabled={loading}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="email"
                      autoComplete="email"
                      placeholder="vous@atelier.cm"
                      className="h-11 border-[var(--afrique-gold)]/20 bg-[var(--afrique-sand)]/50 focus-visible:border-brand focus-visible:ring-brand/20"
                      disabled={loading}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Téléphone</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="tel"
                      autoComplete="tel"
                      placeholder="+237 6XX XXX XXX"
                      className="h-11 border-[var(--afrique-gold)]/20 bg-[var(--afrique-sand)]/50 focus-visible:border-brand focus-visible:ring-brand/20"
                      disabled={loading}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="garageName"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>Nom de l&apos;atelier</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="Garage Akwa Mécanique"
                      className="h-11 border-[var(--afrique-gold)]/20 bg-[var(--afrique-sand)]/50 focus-visible:border-brand focus-visible:ring-brand/20"
                      disabled={loading}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="city"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>
                    Ville <span className="font-normal text-slate-400">(optionnel)</span>
                  </FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="Douala, Yaoundé…"
                      className="h-11 border-[var(--afrique-gold)]/20 bg-[var(--afrique-sand)]/50 focus-visible:border-brand focus-visible:ring-brand/20"
                      disabled={loading}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="message"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>
                    Message <span className="font-normal text-slate-400">(optionnel)</span>
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      rows={3}
                      placeholder="Nombre de techniciens, besoins particuliers…"
                      className="resize-none border-[var(--afrique-gold)]/20 bg-[var(--afrique-sand)]/50 focus-visible:border-brand focus-visible:ring-brand/20"
                      disabled={loading}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {submitError && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {submitError}
            </p>
          )}

          <Button
            type="submit"
            disabled={loading}
            className="landing-auth-btn-primary h-12 w-full gap-2 rounded-xl text-base shadow-sm"
          >
            {loading ? (
              <>
                <Loader2 className="animate-spin" size={18} />
                Envoi en cours…
              </>
            ) : (
              <>
                Envoyer ma demande
                <Send size={18} />
              </>
            )}
          </Button>

          <p className="text-center text-xs leading-relaxed text-slate-500">
            En envoyant ce formulaire, vous acceptez d&apos;être recontacté pour une démonstration
            produit. Vos données ne sont utilisées que dans ce cadre.
          </p>
        </form>
      </Form>
    </div>
  );
}
