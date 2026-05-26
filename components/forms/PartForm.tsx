'use client';

import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

const partSchema = z.object({
  code: z.string().min(2, "Le code est requis"),
  name: z.string().min(2, "La désignation est requise"),
  category: z.string().min(1, "La catégorie est requise"),
  price: z.coerce.number().min(0, "Le prix doit être positif"),
  minThreshold: z.coerce.number().min(0, "Le seuil doit être positif"),
  initialQuantity: z.coerce.number().min(0, "La quantité doit être positive"),
});

type PartFormValues = z.infer<typeof partSchema>;

interface PartFormProps {
  onSuccess?: () => void;
}

export function PartForm({ onSuccess }: PartFormProps) {
  const form = useForm<PartFormValues>({
    resolver: zodResolver(partSchema) as any,
    defaultValues: {
      code: "",
      name: "",
      category: "",
      price: 0,
      minThreshold: 5,
      initialQuantity: 0,
    },
  });

  function onSubmit(values: PartFormValues) {
    console.log(values);
    toast.success("Pièce enregistrée avec succès");
    onSuccess?.();
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="code"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Code Référence</FormLabel>
                <FormControl>
                  <Input placeholder="ex: FIL-OIL-TY" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="category"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Catégorie</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="Filtration">Filtration</SelectItem>
                    <SelectItem value="Freinage">Freinage</SelectItem>
                    <SelectItem value="Suspension">Suspension</SelectItem>
                    <SelectItem value="Électricité">Électricité</SelectItem>
                    <SelectItem value="Moteur">Moteur</SelectItem>
                    <SelectItem value="Pneumatique">Pneumatique</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Désignation</FormLabel>
              <FormControl>
                <Input placeholder="ex: Filtre à huile Toyota Hilux" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-3 gap-4">
          <FormField
            control={form.control}
            name="price"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Prix Unitaire (XAF)</FormLabel>
                <FormControl>
                  <Input type="number" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="initialQuantity"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Qté Initiale</FormLabel>
                <FormControl>
                  <Input type="number" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="minThreshold"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Seuil Alerte</FormLabel>
                <FormControl>
                  <Input type="number" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <Button type="submit" className="bg-brand hover:bg-brand-hover">
            Enregistrer la pièce
          </Button>
        </div>
      </form>
    </Form>
  );
}
