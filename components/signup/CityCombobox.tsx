'use client';

import { useMemo, useState } from 'react';
import { Check, ChevronsUpDown, MapPin } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { CAMEROON_CITIES, searchCameroonCities } from '@/lib/cameroon-cities';
import { cn } from '@/lib/utils';

interface CityComboboxProps {
  value: string;
  onChange: (value: string) => void;
  error?: string;
}

export function CityCombobox({ value, onChange, error }: CityComboboxProps) {
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);

  const results = useMemo(
    () => searchCameroonCities(query).slice(0, 10),
    [query],
  );

  function choose(city: string) {
    setQuery(city);
    onChange(city);
    setOpen(false);
  }

  return (
    <div className="relative">
      <div className="relative">
        <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
          aria-controls="signup-city-listbox"
          value={query}
          placeholder="Rechercher une ville…"
          className={cn('h-11 pl-9 pr-9', error && 'border-red-500')}
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            const next = event.target.value;
            setQuery(next);
            onChange(next);
            setOpen(true);
          }}
          onBlur={() => {
            window.setTimeout(() => setOpen(false), 120);
          }}
        />
        <ChevronsUpDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      </div>

      {open && (
        <div
          id="signup-city-listbox"
          role="listbox"
          className="absolute z-50 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-slate-200 bg-white p-1 shadow-xl"
        >
          {results.length > 0 ? (
            results.map((city) => (
              <button
                key={city}
                type="button"
                role="option"
                aria-selected={value === city}
                className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-50"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(city)}
              >
                <span>{city}</span>
                {value === city && <Check className="h-4 w-4 text-[var(--afrique-forest)]" />}
              </button>
            ))
          ) : (
            <p className="px-3 py-3 text-sm text-slate-500">
              Aucune ville trouvée. Vous pouvez conserver « {query} » si la ville n&apos;est pas dans la liste.
            </p>
          )}
          {!query && (
            <p className="px-3 pb-2 pt-1 text-[11px] text-slate-400">
              {CAMEROON_CITIES.length} villes camerounaises proposées.
            </p>
          )}
        </div>
      )}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
