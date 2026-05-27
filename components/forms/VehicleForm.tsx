'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from "@/components/ui/button";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { Input as UIInput } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { vehiclesApi, handleApiError } from "@/lib/api";

const FUEL_OPTIONS = [
  { value: 'PETROL',   label: 'Essence' },
  { value: 'DIESEL',   label: 'Diesel' },
  { value: 'HYBRID',   label: 'Hybride' },
  { value: 'ELECTRIC', label: 'Électrique' },
  { value: 'LPG',      label: 'GPL' },
  { value: 'OTHER',    label: 'Autre' },
];

const vehicleSchema = z.object({
  plateNumber:    z.string().min(2, "L'immatriculation est requise"),
  makeId:         z.string().min(1, 'La marque est requise'),
  modelId:        z.string().min(1, 'Le modèle est requis'),
  year:           z.coerce.number().min(1900).max(new Date().getFullYear() + 1),
  fuelType:       z.string().optional(),
  vin:            z.string().optional(),
  currentMileage: z.coerce.number().min(0),
});

type FormValues = z.infer<typeof vehicleSchema>;

interface VehicleFormProps {
  customerId?: string;
  vehicleId?: string;
  initialData?: Partial<FormValues>;
  onSuccess?: (vehicle?: { id: string }) => void;
}

export function VehicleForm({ customerId, vehicleId, initialData, onSuccess }: VehicleFormProps) {
  const router = useRouter();
  const isEdit = !!vehicleId;
  const [makes, setMakes]     = useState<{ id: string; name: string }[]>([]);
  const [models, setModels]   = useState<{ id: string; name: string }[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const prevMakeId = useRef(initialData?.makeId ?? '');

  const form = useForm<FormValues>({
    resolver: zodResolver(vehicleSchema) as any,
    defaultValues: {
      plateNumber:    initialData?.plateNumber    ?? '',
      makeId:         initialData?.makeId         ?? '',
      modelId:        initialData?.modelId        ?? '',
      year:           initialData?.year           ?? new Date().getFullYear(),
      fuelType:       initialData?.fuelType       ?? '',
      vin:            initialData?.vin            ?? '',
      currentMileage: initialData?.currentMileage ?? 0,
    },
  });

  const selectedMakeId = form.watch('makeId');

  useEffect(() => {
    vehiclesApi.makes().then((data: any) => setMakes(data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedMakeId) { setModels([]); return; }
    if (selectedMakeId !== prevMakeId.current) {
      form.setValue('modelId', '');
    }
    prevMakeId.current = selectedMakeId;
    setModelsLoading(true);
    vehiclesApi.models(selectedMakeId)
      .then((data: any) => setModels(Array.isArray(data) ? data : []))
      .catch(() => setModels([]))
      .finally(() => setModelsLoading(false));
  }, [selectedMakeId, form]);

  function onSubmit(values: FormValues) {
    if (isEdit) {
      vehiclesApi
        .update(vehicleId, {
          plateNumber:    values.plateNumber,
          makeId:         values.makeId,
          modelId:        values.modelId,
          year:           values.year,
          fuelType:       values.fuelType || undefined,
          vin:            values.vin || undefined,
          currentMileage: values.currentMileage,
        })
        .then(() => {
          toast.success('Véhicule modifié avec succès');
          onSuccess?.({ id: vehicleId });
        })
        .catch((err: unknown) => handleApiError(err, 'Impossible de modifier le véhicule'));
      return;
    }

    if (!customerId) {
      toast.error('Sélectionnez d\'abord un client');
      return;
    }

    vehiclesApi
      .create({
        customerId,
        plateNumber:    values.plateNumber,
        makeId:         values.makeId,
        modelId:        values.modelId,
        year:           values.year,
        fuelType:       values.fuelType || undefined,
        vin:            values.vin || undefined,
        currentMileage: values.currentMileage,
      })
      .then((created: unknown) => {
        const vehicle = created as { id: string };
        toast.success('Véhicule enregistré avec succès');
        onSuccess?.(vehicle);
        if (vehicle?.id) router.push(`/vehicles/${vehicle.id}`);
      })
      .catch((err: unknown) => handleApiError(err, 'Impossible d\'enregistrer le véhicule'));
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">

        {/* Plaque */}
        <FormField
          control={form.control}
          name="plateNumber"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Immatriculation <span className="text-red-500">*</span></FormLabel>
              <FormControl>
                <UIInput placeholder="ex: LT-123-AA" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Marque + Modèle */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="makeId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Marque <span className="text-red-500">*</span></FormLabel>
                <Select value={field.value} onValueChange={(v) => v && field.onChange(v)}>
                  <FormControl>
                    <SelectTrigger className="w-full bg-muted border-border">
                      <SelectValue placeholder="Sélectionner…">
                        {makes.find(m => m.id === field.value)?.name}
                      </SelectValue>
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {makes.map(m => (
                      <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="modelId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Modèle <span className="text-red-500">*</span></FormLabel>
                <Select
                  value={field.value}
                  onValueChange={(v) => v && field.onChange(v)}
                  disabled={!selectedMakeId || modelsLoading}
                >
                  <FormControl>
                    <SelectTrigger className="w-full bg-muted border-border">
                      <SelectValue placeholder={
                        !selectedMakeId ? 'Choisir la marque d\'abord'
                        : modelsLoading ? 'Chargement…'
                        : models.length === 0 ? 'Aucun modèle disponible'
                        : 'Sélectionner…'
                      }>
                        {models.find(m => m.id === field.value)?.name}
                      </SelectValue>
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {models.map(m => (
                      <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Année + Carburant */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="year"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Année</FormLabel>
                <FormControl>
                  <UIInput type="number" {...field} className="bg-muted border-border" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="fuelType"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Carburant</FormLabel>
                <Select value={field.value ?? ''} onValueChange={(v) => field.onChange(v)}>
                  <FormControl>
                    <SelectTrigger className="w-full bg-muted border-border">
                      <SelectValue placeholder="Sélectionner…">
                        {FUEL_OPTIONS.find(f => f.value === field.value)?.label}
                      </SelectValue>
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {FUEL_OPTIONS.map(f => (
                      <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Kilométrage + VIN */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="currentMileage"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Kilométrage actuel</FormLabel>
                <FormControl>
                  <UIInput type="number" {...field} className="bg-muted border-border" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="vin"
            render={({ field }) => (
              <FormItem>
                <FormLabel>N° de châssis (VIN)</FormLabel>
                <FormControl>
                  <UIInput placeholder="Optionnel" {...field} className="bg-muted border-border" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <Button type="submit" className="bg-brand hover:bg-brand-hover w-full sm:w-auto">
            {isEdit ? 'Enregistrer les modifications' : 'Enregistrer le véhicule'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
