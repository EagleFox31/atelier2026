'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { CustomerCombobox } from '@/components/forms/CustomerCombobox';
import { VehicleCombobox } from '@/components/forms/VehicleCombobox';
import { workshopApi } from '@/lib/api';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const schema = z.object({
  customerId:      z.string().min(1, 'Client requis'),
  vehicleId:       z.string().min(1, 'Véhicule requis'),
  clientComplaint: z.string().min(10, 'Décrivez les symptômes (min 10 caractères)'),
  priority:        z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']),
  mileageIn:       z.coerce.number().optional(),
});

type FormValues = z.infer<typeof schema>;

interface OrderFormProps {
  onSuccess?: () => void;
  initialCustomerId?:    string;
  initialCustomerLabel?: string;
  initialCustomerPhone?: string;
  initialVehicleId?:     string;
  initialVehicleLabel?:  string;
  initialVehicleSub?:    string;
}

export function OrderForm({
  onSuccess,
  initialCustomerId, initialCustomerLabel, initialCustomerPhone,
  initialVehicleId, initialVehicleLabel, initialVehicleSub,
}: OrderFormProps) {
  const [customerId, setCustomerId] = useState<string | null>(initialCustomerId ?? null);
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema) as any,
    defaultValues: {
      customerId:      initialCustomerId  ?? '',
      vehicleId:       initialVehicleId   ?? '',
      clientComplaint: '',
      priority:        'NORMAL',
    },
  });

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    try {
      await workshopApi.createOT({
        customerId:      values.customerId,
        vehicleId:       values.vehicleId,
        clientComplaint: values.clientComplaint,
        priority:        values.priority,
        mileageIn:       values.mileageIn,
      });
      toast.success('Ordre de travail ouvert avec succès');
      onSuccess?.();
    } catch (err: any) {
      toast.error(err?.message || 'Erreur lors de la création');
    } finally { setSubmitting(false); }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">

        {/* Client */}
        <FormItem>
          <FormLabel>Client</FormLabel>
          <CustomerCombobox
            value={form.watch('customerId')}
            initialLabel={initialCustomerLabel}
            initialSublabel={initialCustomerPhone}
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

        {/* Véhicule */}
        <FormItem>
          <FormLabel>Véhicule</FormLabel>
          <VehicleCombobox
            customerId={customerId ?? undefined}
            value={form.watch('vehicleId')}
            initialLabel={initialVehicleLabel}
            initialSublabel={initialVehicleSub}
            onChange={(id) => form.setValue('vehicleId', id ?? '')}
          />
          {form.formState.errors.vehicleId && (
            <p className="text-xs text-red-500">{form.formState.errors.vehicleId.message}</p>
          )}
        </FormItem>

        {/* Priorité */}
        <FormField control={form.control} name="priority" render={({ field }) => (
          <FormItem>
            <FormLabel>Priorité</FormLabel>
            <FormControl>
              <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex flex-wrap gap-4">
                {[['LOW','Basse','text-slate-500'],['NORMAL','Normale','text-blue-600'],['HIGH','Haute','text-amber-600'],['URGENT','Urgent','text-red-600']].map(([v,l,c]) => (
                  <FormItem key={v} className="flex items-center space-x-2 space-y-0">
                    <FormControl><RadioGroupItem value={v} /></FormControl>
                    <FormLabel className={`font-normal ${c}`}>{l}</FormLabel>
                  </FormItem>
                ))}
              </RadioGroup>
            </FormControl>
          </FormItem>
        )} />

        {/* Kilométrage */}
        <FormField control={form.control} name="mileageIn" render={({ field }) => (
          <FormItem>
            <FormLabel>Kilométrage à l&apos;entrée <span className="text-muted-foreground text-xs">(optionnel)</span></FormLabel>
            <FormControl><Input type="number" placeholder="ex: 45000" {...field} /></FormControl>
          </FormItem>
        )} />

        {/* Plainte */}
        <FormField control={form.control} name="clientComplaint" render={({ field }) => (
          <FormItem>
            <FormLabel>Symptômes / travaux demandés</FormLabel>
            <FormControl>
              <Textarea placeholder="ex: Bruit métallique au freinage, fumée noire à l'accélération..." className="min-h-[90px]" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />

        <Button type="submit" className="w-full bg-brand hover:bg-brand-hover" disabled={submitting}>
          {submitting ? <><Loader2 size={16} className="animate-spin mr-2" />Création...</> : "Ouvrir l'Ordre de Travail"}
        </Button>
      </form>
    </Form>
  );
}
