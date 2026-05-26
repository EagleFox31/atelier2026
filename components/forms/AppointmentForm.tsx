'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { CustomerCombobox } from '@/components/forms/CustomerCombobox';
import { VehicleCombobox } from '@/components/forms/VehicleCombobox';
import { planningApi } from '@/lib/api';
import { CalendarDays, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const schema = z.object({
  customerId:  z.string().min(1, 'Client requis'),
  vehicleId:   z.string().optional(),
  scheduledAt: z.string().min(1, 'Date et heure requises'),
  reason:      z.string().min(3, 'Motif requis'),
  notes:       z.string().optional(),
});

type FormValues = z.infer<typeof schema>;
interface AppointmentFormProps { onSuccess?: () => void; initialDate?: string; }

export function AppointmentForm({ onSuccess, initialDate }: AppointmentFormProps) {
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const defaultDate = initialDate
    ? `${initialDate}T08:00`
    : `${new Date().toISOString().split('T')[0]}T08:00`;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema) as any,
    defaultValues: { customerId: '', vehicleId: '', scheduledAt: defaultDate, reason: '', notes: '' },
  });

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    try {
      await planningApi.create({
        customerId:  values.customerId,
        vehicleId:   values.vehicleId || undefined,
        scheduledAt: new Date(values.scheduledAt).toISOString(),
        reason:      values.reason,
        notes:       values.notes || undefined,
      });
      toast.success('Rendez-vous enregistré');
      onSuccess?.();
    } catch (err: any) {
      toast.error(err?.message || 'Erreur lors de la création');
    } finally { setSubmitting(false); }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">

        <FormItem>
          <FormLabel>Client</FormLabel>
          <CustomerCombobox
            value={form.watch('customerId')}
            onChange={(id) => {
              form.setValue('customerId', id ?? '');
              form.setValue('vehicleId', '');
              setCustomerId(id);
            }}
          />
          {form.formState.errors.customerId && (
            <p className="text-xs text-red-500">{form.formState.errors.customerId.message}</p>
          )}
        </FormItem>

        <FormItem>
          <FormLabel>Véhicule <span className="text-muted-foreground text-xs">(optionnel)</span></FormLabel>
          <VehicleCombobox
            customerId={customerId ?? undefined}
            value={form.watch('vehicleId')}
            onChange={(id) => form.setValue('vehicleId', id ?? '')}
          />
        </FormItem>

        <FormField control={form.control} name="scheduledAt" render={({ field }) => (
          <FormItem>
            <FormLabel>Date et heure</FormLabel>
            <FormControl>
              <div className="relative">
                <Input type="datetime-local" {...field} />
                <CalendarDays size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              </div>
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />

        <FormField control={form.control} name="reason" render={({ field }) => (
          <FormItem>
            <FormLabel>Motif du rendez-vous</FormLabel>
            <FormControl><Input placeholder="ex: Révision 50 000 km, Diagnostic freins..." {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />

        <FormField control={form.control} name="notes" render={({ field }) => (
          <FormItem>
            <FormLabel>Notes <span className="text-muted-foreground text-xs">(optionnel)</span></FormLabel>
            <FormControl><Textarea placeholder="Informations complémentaires..." className="min-h-[60px]" {...field} /></FormControl>
          </FormItem>
        )} />

        <Button type="submit" className="w-full bg-brand hover:bg-brand-hover" disabled={submitting}>
          {submitting ? <><Loader2 size={16} className="animate-spin mr-2" />Enregistrement...</> : 'Enregistrer le Rendez-vous'}
        </Button>
      </form>
    </Form>
  );
}
