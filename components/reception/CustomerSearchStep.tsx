'use client';

import { useState, useCallback } from 'react';
import { Combobox } from '@/components/ui/combobox';
import { customersApi } from '@/lib/api';
import { InlineCustomerCreate, type CreatedCustomer } from '@/components/reception/InlineCustomerCreate';
import { Label } from '@/components/ui/label';
import { Phone } from 'lucide-react';

function customerLabel(c: Record<string, unknown>): string {
  if (c.customerType === 'COMPANY') return (c.companyName as string) ?? '—';
  return [c.firstName, c.lastName].filter(Boolean).join(' ') || '—';
}

export interface SelectedCustomer {
  id: string;
  label: string;
  sublabel?: string;
}

interface CustomerSearchStepProps {
  onSelected: (customer: SelectedCustomer) => void;
}

export function CustomerSearchStep({ onSelected }: CustomerSearchStepProps) {
  const [value, setValue] = useState<string | undefined>();
  const [searchHint, setSearchHint] = useState('');

  const fetchOptions = useCallback(async (search: string) => {
    setSearchHint(search);
    const data = await customersApi.list({ search }) as Record<string, unknown>[];
    return data.map(c => ({
      id: c.id as string,
      label: customerLabel(c),
      sublabel: c.phonePrimary as string | undefined,
      _raw: c,
    }));
  }, []);

  function handleChange(id: string | null, opt: { id: string; label: string; sublabel?: string } | null) {
    setValue(id ?? undefined);
    if (id && opt) {
      onSelected({ id, label: opt.label, sublabel: opt.sublabel });
    }
  }

  function handleCreated(c: CreatedCustomer) {
    setValue(c.id);
    onSelected({ id: c.id, label: c.label, sublabel: c.sublabel });
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label className="flex items-center gap-2 text-sm font-semibold">
          <Phone size={16} className="text-brand" />
          Rechercher le client
        </Label>
        <p className="text-xs text-muted-foreground">
          Saisissez le téléphone ou le nom. Si le client n&apos;existe pas, un formulaire de création s&apos;affiche.
        </p>
        <Combobox
          placeholder="Téléphone ou nom du client…"
          value={value}
          fetchOptions={fetchOptions}
          minSearchLength={2}
          onChange={(id, opt) => handleChange(id, opt as { id: string; label: string; sublabel?: string } | null)}
          renderNoResults={(search) => (
            <InlineCustomerCreate searchHint={search} onCreated={handleCreated} />
          )}
        />
      </div>
    </div>
  );
}
