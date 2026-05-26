'use client';

import { Combobox } from '@/components/ui/combobox';
import { customersApi } from '@/lib/api';

interface CustomerComboboxProps {
  value?:         string;
  onChange?:      (customerId: string | null, customer: any | null) => void;
  disabled?:      boolean;
  initialLabel?:  string;
  initialSublabel?: string;
}

function customerLabel(c: any): string {
  if (c.customerType === 'COMPANY') return c.companyName ?? '—';
  return [c.firstName, c.lastName].filter(Boolean).join(' ') || '—';
}

export function CustomerCombobox({ value, onChange, disabled, initialLabel, initialSublabel }: CustomerComboboxProps) {
  async function fetchOptions(search: string) {
    const data = await customersApi.list({ search }) as any[];
    return data.map(c => ({
      id:       c.id,
      label:    customerLabel(c),
      sublabel: c.phonePrimary,
      _raw:     c,
    }));
  }

  const initialOption = value && initialLabel
    ? { id: value, label: initialLabel, sublabel: initialSublabel }
    : undefined;

  return (
    <Combobox
      placeholder="Rechercher un client..."
      value={value}
      disabled={disabled}
      fetchOptions={fetchOptions}
      initialOption={initialOption}
      onChange={(id, opt) => onChange?.(id, (opt as any)?._raw ?? null)}
    />
  );
}
