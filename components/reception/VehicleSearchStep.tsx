'use client';

import { useCallback, useState } from 'react';
import { Combobox } from '@/components/ui/combobox';
import { vehiclesApi } from '@/lib/api';
import { InlineVehicleCreate, type CreatedVehicle } from '@/components/reception/InlineVehicleCreate';
import { Label } from '@/components/ui/label';
import { Car } from 'lucide-react';
import type { SelectedCustomer } from '@/components/reception/CustomerSearchStep';

function vehicleSublabel(v: Record<string, unknown>) {
  return [v.make as { name?: string } | undefined, v.model as { name?: string } | undefined]
    .filter(Boolean)
    .map(m => (m as { name?: string }).name)
    .join(' ') || 'Véhicule';
}

interface VehicleSearchStepProps {
  customer: SelectedCustomer;
  onContinue: (vehicleId: string) => void;
}

export function VehicleSearchStep({ customer, onContinue }: VehicleSearchStepProps) {
  const [value, setValue] = useState<string | undefined>();

  const fetchOptions = useCallback(async (search: string) => {
    const data = await vehiclesApi.list({ customerId: customer.id, search }) as Record<string, unknown>[];
    return data.map(v => ({
      id: v.id as string,
      label: v.plateNumber as string,
      sublabel: vehicleSublabel(v),
      _raw: v,
    }));
  }, [customer.id]);

  function handleChange(id: string | null) {
    setValue(id ?? undefined);
    if (id) onContinue(id);
  }

  function handleCreated(v: CreatedVehicle) {
    setValue(v.id);
    onContinue(v.id);
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm">
        <span className="text-muted-foreground">Client : </span>
        <span className="font-semibold text-foreground">{customer.label}</span>
        {customer.sublabel && (
          <span className="text-muted-foreground font-mono text-xs ml-2">{customer.sublabel}</span>
        )}
      </div>

      <div className="space-y-2">
        <Label className="flex items-center gap-2 text-sm font-semibold">
          <Car size={16} className="text-brand" />
          Véhicule du client
        </Label>
        <p className="text-xs text-muted-foreground">
          Recherchez par plaque. Sinon, enregistrez le véhicule ci-dessous.
        </p>
        <Combobox
          placeholder="Plaque d'immatriculation…"
          value={value}
          fetchOptions={fetchOptions}
          minSearchLength={2}
          onChange={id => handleChange(id)}
          renderNoResults={(search) => (
            <InlineVehicleCreate
              customerId={customer.id}
              searchHint={search}
              onCreated={handleCreated}
            />
          )}
        />
      </div>

    </div>
  );
}
