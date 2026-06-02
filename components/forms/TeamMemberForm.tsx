'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from "@/components/ui/button";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { teamApi } from "@/lib/api";
import { Eye, EyeOff } from 'lucide-react';

const teamSchema = z.object({
  firstName: z.string().min(2, "Le prénom est requis"),
  lastName:  z.string().min(2, "Le nom est requis"),
  roleCode:  z.string().min(1, "Le rôle est requis"),
  phone:     z.string().optional(),
  email:     z.string().email("Email invalide").optional().or(z.literal("")),
  password:  z.string().min(6, "Minimum 6 caractères").optional().or(z.literal("")),
});

type TeamFormValues = z.infer<typeof teamSchema>;

interface TeamMemberFormProps {
  onSuccess?: () => void;
}

export function TeamMemberForm({ onSuccess }: TeamMemberFormProps) {
  const [showPassword, setShowPassword] = useState(false);
  const form = useForm<TeamFormValues>({
    resolver: zodResolver(teamSchema) as any,
    defaultValues: { firstName: '', lastName: '', roleCode: '', phone: '', email: '', password: '' },
  });

  async function onSubmit(values: TeamFormValues) {
    try {
      const payload = {
        firstName: values.firstName,
        lastName:  values.lastName,
        roleCode:  values.roleCode,
        phone:     values.phone || undefined,
        email:     values.email || undefined,
        password:  values.password || undefined,
      };
      const created = await teamApi.create(payload) as any;
      toast.success(
        `${values.firstName} ${values.lastName} ajouté — identifiant : ${created.employeeCode}`,
        { duration: 6000 }
      );
      form.reset();
      onSuccess?.();
    } catch {
      toast.error("Erreur lors de la création du membre");
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <FormField control={form.control} name="firstName" render={({ field }) => (
            <FormItem>
              <FormLabel>Prénom</FormLabel>
              <FormControl><Input placeholder="Jean" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="lastName" render={({ field }) => (
            <FormItem>
              <FormLabel>Nom</FormLabel>
              <FormControl><Input placeholder="Dupont" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>

        <FormField control={form.control} name="roleCode" render={({ field }) => (
          <FormItem>
            <FormLabel>Rôle</FormLabel>
            <Select onValueChange={field.onChange} defaultValue={field.value}>
              <FormControl>
                <SelectTrigger><SelectValue placeholder="Sélectionner un rôle" /></SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value="CHEF_ATELIER">Chef d&apos;Atelier</SelectItem>
                <SelectItem value="TECHNICIEN">Technicien</SelectItem>
                <SelectItem value="RECEPTIONNISTE">Réceptionniste</SelectItem>
                <SelectItem value="CAISSIER">Caissier</SelectItem>
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )} />

        <div className="grid grid-cols-2 gap-4">
          <FormField control={form.control} name="phone" render={({ field }) => (
            <FormItem>
              <FormLabel>Téléphone</FormLabel>
              <FormControl><Input placeholder="+237 6..." {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="email" render={({ field }) => (
            <FormItem>
              <FormLabel>Email (optionnel)</FormLabel>
              <FormControl><Input placeholder="jean@atelier.cm" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>

        <FormField control={form.control} name="password" render={({ field }) => (
          <FormItem>
            <FormLabel>Mot de passe <span className="text-slate-400 font-normal">(défaut : Atelier2026!)</span></FormLabel>
            <FormControl>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Laisser vide pour mot de passe par défaut"
                  {...field}
                />
                <button type="button" onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />

        <div className="flex justify-end gap-3 pt-4">
          <Button type="submit" disabled={form.formState.isSubmitting} className="bg-brand hover:bg-brand-hover">
            {form.formState.isSubmitting ? 'Création...' : 'Ajouter le membre'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
