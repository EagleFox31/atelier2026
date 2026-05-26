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

const teamSchema = z.object({
  name: z.string().min(2, "Le nom est requis"),
  specialty: z.string().min(2, "La spécialité est requise"),
  role: z.string().min(1, "Le rôle est requis"),
  email: z.string().email("Email invalide").optional().or(z.literal("")),
  phone: z.string().min(9, "Téléphone invalide"),
});

type TeamFormValues = z.infer<typeof teamSchema>;

interface TeamMemberFormProps {
  onSuccess?: () => void;
}

export function TeamMemberForm({ onSuccess }: TeamMemberFormProps) {
  const form = useForm<TeamFormValues>({
    resolver: zodResolver(teamSchema),
    defaultValues: {
      name: "",
      specialty: "",
      role: "TECHNICIAN",
      email: "",
      phone: "",
    },
  });

  function onSubmit(values: TeamFormValues) {
    console.log(values);
    toast.success(`${values.name} a été ajouté à l'équipe`);
    onSuccess?.();
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nom Complet</FormLabel>
              <FormControl>
                <Input placeholder="ex: Jean Dupont" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="role"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Rôle</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="CHEF_ATELIER">Chef d&apos;Atelier</SelectItem>
                    <SelectItem value="TECHNICIAN">Technicien</SelectItem>
                    <SelectItem value="RECEPTIONIST">Réceptionniste</SelectItem>
                    <SelectItem value="CASHIER">Caissier</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="specialty"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Spécialité</FormLabel>
                <FormControl>
                  <Input placeholder="ex: Mécanique, Électricité..." {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Téléphone</FormLabel>
                <FormControl>
                  <Input placeholder="+237 6..." {...field} />
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
                <FormLabel>Email (Optionnel)</FormLabel>
                <FormControl>
                  <Input placeholder="email@exemple.cm" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <Button type="submit" className="bg-brand hover:bg-brand-hover">
            Ajouter le membre
          </Button>
        </div>
      </form>
    </Form>
  );
}
