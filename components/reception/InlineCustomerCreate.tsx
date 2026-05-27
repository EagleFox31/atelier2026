'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { customersApi, handleApiError } from '@/lib/api';
import { Loader2, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

function looksLikePhone(s: string) {
  const digits = s.replace(/\D/g, '');
  return digits.length >= 8;
}

export interface CreatedCustomer {
  id: string;
  label: string;
  sublabel?: string;
  raw: Record<string, unknown>;
}

interface InlineCustomerCreateProps {
  searchHint?: string;
  onCreated: (customer: CreatedCustomer) => void;
  className?: string;
}

export function InlineCustomerCreate({ searchHint = '', onCreated, className }: InlineCustomerCreateProps) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState(looksLikePhone(searchHint) ? searchHint.replace(/[^\d+\s]/g, '').trim() : '');
  const [submitting, setSubmitting] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim() || phone.replace(/\D/g, '').length < 8) {
      toast.error('Prénom, nom et téléphone (8 chiffres min.) sont requis');
      return;
    }
    setSubmitting(true);
    try {
      const created = await customersApi.create({
        customerType: 'INDIVIDUAL',
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phonePrimary: phone.trim(),
      }) as { id: string; firstName?: string; lastName?: string; phonePrimary?: string };
      const label = [created.firstName, created.lastName].filter(Boolean).join(' ');
      toast.success('Client créé');
      onCreated({
        id: created.id,
        label,
        sublabel: created.phonePrimary,
        raw: created as Record<string, unknown>,
      });
    } catch (err) {
      handleApiError(err, 'Impossible de créer le client');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleCreate} className={cn('space-y-3', className)}>
      <p className="text-sm font-semibold text-foreground flex items-center gap-2">
        <UserPlus size={16} className="text-brand" />
        Créer ce client
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Prénom <span className="text-destructive">*</span></Label>
          <Input value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="Jean" className="h-9" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Nom <span className="text-destructive">*</span></Label>
          <Input value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Mbarga" className="h-9" />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Téléphone <span className="text-destructive">*</span></Label>
        <Input
          type="tel"
          inputMode="tel"
          value={phone}
          onChange={e => setPhone(e.target.value)}
          placeholder="+237 6XX XX XX XX"
          className="h-9"
        />
      </div>
      <Button type="submit" disabled={submitting} className="w-full bg-brand hover:bg-brand-hover h-10">
        {submitting ? <Loader2 size={16} className="animate-spin" /> : 'Créer et sélectionner'}
      </Button>
    </form>
  );
}
