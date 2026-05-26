'use client';

import { useCallback } from 'react';
import { Combobox } from '@/components/ui/combobox';
import { vehiclesApi } from '@/lib/api';

interface VehicleComboboxProps {
  customerId?:    string;
  value?:         string;
  onChange?:      (vehicleId: string | null, vehicle: any | null) => void;
  disabled?:      boolean;
  initialLabel?:  string;
  initialSublabel?: string;
}

function vehicleLabel(v: any): string {
  return [v.make?.name, v.model?.name].filter(Boolean).join(' ') || v.plateNumber;
}

export function VehicleCombobox({ customerId, value, onChange, disabled, initialLabel, initialSublabel }: VehicleComboboxProps) {
  const fetchOptions = useCallback(async (search: string) => {
    const data = await vehiclesApi.list({ customerId, search }) as any[];
    return data.map(v => ({
      id:       v.id,
      label:    v.plateNumber,
      sublabel: vehicleLabel(v),
      _raw:     v,
    }));
  }, [customerId]);

  const initialOption = value && initialLabel
    ? { id: value, label: initialLabel, sublabel: initialSublabel }
    : undefined;

  return (
    <Combobox
      placeholder={customerId ? "Rechercher un véhicule..." : "Sélectionnez d'abord un client"}
      value={value}
      disabled={disabled || !customerId}
      fetchOptions={fetchOptions}
      initialOption={initialOption}
      onChange={(id, opt) => onChange?.(id, (opt as any)?._raw ?? null)}
    />
  );
}
