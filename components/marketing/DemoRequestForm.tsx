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
      <div className="mx-auto w-full max-w-md text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10 ring-1 ring-green-500/20">
          <CheckCircle2 className="text-green-600" size={36} />
        </div>
        <h1 className="mt-6 text-2xl font-bold tracking-tight text-slate-800">
          Demande bien reçue
        </h1>
        <p className="mt-3 text-pretty text-slate-600 leading-relaxed">
          Merci pour votre intérêt. Notre équipe vous contactera sous{' '}
          <strong className="font-medium text-slate-800">48 heures ouvrées</strong> pour planifier
          une démonstration personnalisée de 30 minutes.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link href="/" className={cn(buttonVariants({ variant: 'outline' }), 'rounded-xl')}>
            Retour à l&apos;accueil
          </Link>
          <Link href="/login" className={cn(buttonVariants(), 'rounded-xl bg-brand text-white hover:bg-brand-hover')}>
            Accéder à l&apos;app
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-lg">
      <Link
        href="/"
        className="mb-8 inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition-colors hover:text-brand"
      >
        <ArrowLeft size={16} />
        Retour
      </Link>

      <div className="mb-8 flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand/10 ring-1 ring-brand/15">
          <CalendarDays className="text-brand" size={24} />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-800 sm:text-3xl">
            Réserver une démo
          </h1>
          <p className="mt-2 text-pretty text-slate-600 leading-relaxed">
            Présentation guidée d&apos;Atelier Maître — OT, facturation XAF, stock et planning.
            Sans engagement.
          </p>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5 rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm ring-1 ring-slate-900/[0.03] sm:p-8">
          <div className="grid gap-5 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="fullName"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>Nom complet</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="Jean Kengne"
                      className="h-11 border-slate-200 bg-slate-50/80 focus-visible:bg-white"
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
                      className="h-11 border-slate-200 bg-slate-50/80 focus-visible:bg-white"
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
                      className="h-11 border-slate-200 bg-slate-50/80 focus-visible:bg-white"
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
                      className="h-11 border-slate-200 bg-slate-50/80 focus-visible:bg-white"
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
                      className="h-11 border-slate-200 bg-slate-50/80 focus-visible:bg-white"
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
                      className="resize-none border-slate-200 bg-slate-50/80 focus-visible:bg-white"
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
            className="h-12 w-full gap-2 rounded-xl bg-brand text-base shadow-lg shadow-brand/20 hover:bg-brand-hover"
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
