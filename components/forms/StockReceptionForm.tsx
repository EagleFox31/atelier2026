'use client';

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { stockApi } from "@/lib/api";
import { Loader2 } from "lucide-react";

const schema = z.object({
  partId:    z.string().min(1, "La pièce est requise"),
  quantity:  z.coerce.number().min(1, "Quantité minimum : 1"),
  supplier:  z.string().min(2, "Le fournisseur est requis"),
  reference: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

interface StockReceptionFormProps { onSuccess?: () => void; }

export function StockReceptionForm({ onSuccess }: StockReceptionFormProps) {
  const [parts, setParts]         = useState<any[]>([]);
  const [loadingParts, setLoadingParts] = useState(true);
  const [submitting, setSubmitting]     = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema) as any,
    defaultValues: { partId: '', quantity: 1, supplier: '', reference: '' },
  });

  useEffect(() => {
    (async () => {
      try { setParts(await stockApi.listParts() as any[]); }
      catch {} finally { setLoadingParts(false); }
    })();
  }, []);

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    try {
      await stockApi.applyMovement({
        partId:       values.partId,
        type:         'PURCHASE',
        quantity:     values.quantity,
        referenceDoc: values.reference || undefined,
      });
      toast.success(`Réception de ${values.quantity} unité(s) enregistrée`);
      onSuccess?.();
    } catch (err: any) {
      toast.error(err?.message || 'Erreur lors de la réception');
    } finally { setSubmitting(false); }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField control={form.control} name="partId" render={({ field }) => (
          <FormItem>
            <FormLabel>Pièce à réceptionner</FormLabel>
            {loadingParts
              ? <Skeleton className="h-10 w-full rounded-md" />
              : <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl><SelectTrigger><SelectValue placeholder="Sélectionner une pièce" /></SelectTrigger></FormControl>
                  <SelectContent>
                    {parts.map(p => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.reference} — {p.nameFr}
                        <span className="ml-2 text-muted-foreground text-xs">(stock: {Number(p.qtyInStock)})</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
            }
            <FormMessage />
          </FormItem>
        )} />

        <div className="grid grid-cols-2 gap-4">
          <FormField control={form.control} name="quantity" render={({ field }) => (
            <FormItem>
              <FormLabel>Quantité reçue</FormLabel>
              <FormControl><Input type="number" min={1} {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="reference" render={({ field }) => (
            <FormItem>
              <FormLabel>N° Bon de Livraison</FormLabel>
              <FormControl><Input placeholder="ex: BL-2026-001" {...field} /></FormControl>
            </FormItem>
          )} />
        </div>

        <FormField control={form.control} name="supplier" render={({ field }) => (
          <FormItem>
            <FormLabel>Fournisseur</FormLabel>
            <FormControl><Input placeholder="ex: CFAO Motors, Tractafric..." {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />

        <Button type="submit" className="w-full bg-brand hover:bg-brand-hover" disabled={submitting || loadingParts}>
          {submitting ? <><Loader2 size={16} className="animate-spin mr-2" />Enregistrement...</> : 'Valider la réception'}
        </Button>
      </form>
    </Form>
  );
}
