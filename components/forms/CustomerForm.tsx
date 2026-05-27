'use client';

import React from 'react';
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { customersApi, handleApiError } from "@/lib/api";
import { Building2, User } from "lucide-react";
import { MobileFormActionBar } from "@/components/ui/mobile-form-action-bar";

const schema = z.object({
  customerType: z.enum(['INDIVIDUAL', 'COMPANY']),
  firstName:   z.string().optional(),
  lastName:    z.string().optional(),
  companyName: z.string().optional(),
  email:       z.union([z.string().email("Email invalide"), z.literal('')]).optional(),
  phonePrimary: z.string().min(8, "Téléphone requis"),
  address:     z.string().optional(),
  city:        z.string().optional(),
  isVip:       z.boolean(),
}).superRefine((d, ctx) => {
  if (d.customerType === 'INDIVIDUAL') {
    if (!d.firstName?.trim()) ctx.addIssue({ code: 'custom', message: 'Prénom requis', path: ['firstName'] });
    if (!d.lastName?.trim())  ctx.addIssue({ code: 'custom', message: 'Nom requis',    path: ['lastName'] });
  } else {
    if (!d.companyName?.trim()) ctx.addIssue({ code: 'custom', message: 'Raison sociale requise', path: ['companyName'] });
  }
});

type FormValues = z.infer<typeof schema>;

export interface CustomerFormProps {
  onSuccess?: (customer?: { id: string }) => void;
  customerId?: string;
  initialData?: Partial<FormValues>;
}

/** Classes DialogContent pour formulaire client (bottom sheet mobile + hauteur limitée). */
export const CUSTOMER_FORM_DIALOG_CLASS =
  "sm:max-w-[600px] bg-card border-border gap-0 p-0 sm:p-6 flex flex-col max-h-[92dvh] overflow-hidden max-sm:top-auto max-sm:bottom-0 max-sm:left-0 max-sm:right-0 max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-b-none max-sm:rounded-t-2xl";

export function CustomerForm({ onSuccess, customerId, initialData }: CustomerFormProps) {
  const router = useRouter();
  const isEdit = !!customerId;
  const formId = customerId ? `customer-form-${customerId}` : 'customer-form-new';
  const submitLabel = isEdit ? 'Enregistrer les modifications' : 'Créer le client';

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      customerType: initialData?.customerType ?? 'INDIVIDUAL',
      firstName:    initialData?.firstName    ?? '',
      lastName:     initialData?.lastName     ?? '',
      companyName:  initialData?.companyName  ?? '',
      email:        initialData?.email        ?? '',
      phonePrimary: initialData?.phonePrimary ?? '',
      address:      initialData?.address      ?? '',
      city:         initialData?.city         ?? '',
      isVip:        initialData?.isVip        ?? false,
    },
  });

  const customerType = form.watch('customerType');

  async function onSubmit(values: FormValues) {
    const body = {
      customerType: values.customerType,
      email:        values.email || undefined,
      phonePrimary: values.phonePrimary,
      address:      values.address  || undefined,
      city:         values.city     || undefined,
      isVip:        values.isVip,
      ...(values.customerType === 'INDIVIDUAL'
        ? { firstName: values.firstName, lastName: values.lastName }
        : { companyName: values.companyName }),
    };

    try {
      if (isEdit) {
        await customersApi.update(customerId, body);
        toast.success("Client mis à jour");
        onSuccess?.({ id: customerId });
      } else {
        const created = await customersApi.create(body) as { id: string };
        toast.success("Client enregistré");
        onSuccess?.(created);
        if (created?.id) router.push(`/customers/${created.id}`);
      }
    } catch (err) {
      handleApiError(err, isEdit ? "Impossible de modifier le client" : "Impossible d'enregistrer le client");
    }
  }

  return (
    <>
    <Form {...form}>
      <form id={formId} onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col min-h-0 h-full">
        <div className="space-y-5 overflow-y-auto overscroll-contain min-h-0 flex-1 max-sm:pb-28 sm:max-h-[min(58vh,520px)] pr-0.5 -mr-0.5">

        {/* ── Type de client ── */}
        <FormField
          control={form.control}
          name="customerType"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Type de client</FormLabel>
              <div className="flex rounded-lg border border-border overflow-hidden">
                {(['INDIVIDUAL', 'COMPANY'] as const).map(type => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => field.onChange(type)}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors",
                      field.value === type
                        ? "bg-brand text-white"
                        : "bg-transparent text-muted-foreground hover:bg-muted"
                    )}
                  >
                    {type === 'INDIVIDUAL' ? <User size={15} /> : <Building2 size={15} />}
                    {type === 'INDIVIDUAL' ? 'Particulier' : 'Entreprise'}
                  </button>
                ))}
              </div>
            </FormItem>
          )}
        />

        {/* ── Identité (conditionnel) ── */}
        {customerType === 'INDIVIDUAL' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField control={form.control} name="firstName" render={({ field }) => (
              <FormItem>
                <FormLabel>Prénom <span className="text-destructive">*</span></FormLabel>
                <FormControl><Input placeholder="Jean" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="lastName" render={({ field }) => (
              <FormItem>
                <FormLabel>Nom <span className="text-destructive">*</span></FormLabel>
                <FormControl><Input placeholder="Mbarga" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
          </div>
        ) : (
          <FormField control={form.control} name="companyName" render={({ field }) => (
            <FormItem>
              <FormLabel>Raison sociale <span className="text-destructive">*</span></FormLabel>
              <FormControl><Input placeholder="Sobea Cameroun SARL" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
        )}

        {/* ── Contact ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField control={form.control} name="phonePrimary" render={({ field }) => (
            <FormItem>
              <FormLabel>Téléphone <span className="text-destructive">*</span></FormLabel>
              <FormControl><Input placeholder="+237 6XX XX XX XX" type="tel" inputMode="tel" autoComplete="tel" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="email" render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl><Input placeholder="client@email.cm" type="email" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>

        {/* ── Localisation ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField control={form.control} name="address" render={({ field }) => (
            <FormItem>
              <FormLabel>Adresse / Quartier</FormLabel>
              <FormControl><Input placeholder="Bastos" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="city" render={({ field }) => (
            <FormItem>
              <FormLabel>Ville</FormLabel>
              <FormControl><Input placeholder="Yaoundé" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>

        {/* ── VIP ── */}
        <FormField control={form.control} name="isVip" render={({ field }) => (
          <FormItem className="flex items-center justify-between rounded-lg border border-border p-4">
            <div>
              <FormLabel className="text-base cursor-pointer">Client VIP</FormLabel>
              <p className="text-xs text-muted-foreground mt-0.5">Priorité de traitement et remises spéciales</p>
            </div>
            <FormControl>
              <Switch checked={field.value} onCheckedChange={field.onChange} />
            </FormControl>
          </FormItem>
        )} />

        </div>

        <div className="hidden md:block shrink-0 border-t border-border bg-card pt-3 mt-3">
          <Button
            type="submit"
            disabled={form.formState.isSubmitting}
            className="bg-brand hover:bg-brand-hover w-full h-11 text-base font-semibold"
          >
            {submitLabel}
          </Button>
        </div>
      </form>
    </Form>
    <MobileFormActionBar
      formId={formId}
      label={submitLabel}
      loading={form.formState.isSubmitting}
    />
    </>
  );
}
