'use client';

import { useMemo, useState } from 'react';
import { Combobox } from '@/components/ui/combobox';
import { InlineCustomerCreate } from '@/components/reception/InlineCustomerCreate';
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
  const [createdOption, setCreatedOption] = useState<{ id: string; label: string; sublabel?: string; _raw: any } | null>(null);

  async function fetchOptions(search: string) {
    const data = await customersApi.list({ search }) as any[];
    return data.map(c => ({
      id:       c.id,
      label:    customerLabel(c),
      sublabel: c.phonePrimary,
      _raw:     c,
    }));
  }

  const initialOption = useMemo(() => {
    if (createdOption && value === createdOption.id) return createdOption;
    if (value && initialLabel) {
      return { id: value, label: initialLabel, sublabel: initialSublabel };
    }
    return undefined;
  }, [createdOption, value, initialLabel, initialSublabel]);

  return (
    <Combobox
      placeholder="Téléphone ou nom du client…"
      value={value}
      disabled={disabled}
      fetchOptions={fetchOptions}
      initialOption={initialOption}
      minSearchLength={2}
      onChange={(id, opt) => onChange?.(id, (opt as any)?._raw ?? null)}
      renderNoResults={(search) => (
        <InlineCustomerCreate
          searchHint={search}
          onCreated={(c) => {
            const option = { id: c.id, label: c.label, sublabel: c.sublabel, _raw: c.raw };
            setCreatedOption(option);
            onChange?.(c.id, c.raw);
          }}
        />
      )}
    />
  );
}
