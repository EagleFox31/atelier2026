'use client';

import { useMemo } from 'react';
import { Combobox } from '@/components/ui/combobox';

const CAMEROON_CITIES = [
  'Abong-Mbang',
  'Akonolinga',
  'Ambam',
  'Bafia',
  'Bafang',
  'Bafoussam',
  'Bali',
  'Bamenda',
  'Bangangté',
  'Banyo',
  'Batouri',
  'Bertoua',
  'Buea',
  'Douala',
  'Dschang',
  'Ebolowa',
  'Edéa',
  'Eseka',
  'Foumban',
  'Foumbot',
  'Fundong',
  'Garoua',
  'Garoua-Boulaï',
  'Guider',
  'Kousséri',
  'Kribi',
  'Kumba',
  'Kumbo',
  'Limbe',
  'Lolodorf',
  'Loum',
  'Mamfe',
  'Manjo',
  'Maroua',
  'Mbalmayo',
  'Mbouda',
  'Meiganga',
  'Melong',
  'Mokolo',
  'Monatélé',
  'Mora',
  'Muyuka',
  'Ngaoundal',
  'Ngaoundéré',
  'Nkongsamba',
  'Obala',
  'Poli',
  'Sangmélima',
  'Tibati',
  'Tiko',
  'Tcholliré',
  'Wum',
  'Yabassi',
  'Yagoua',
  'Yaoundé',
  'Yokadouma',
] as const;

function normalize(value: string) {
  return value
    .toLocaleLowerCase('fr')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function levenshtein(a: string, b: string) {
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  const curr = new Array<number>(b.length + 1);

  for (let i = 1; i <= a.length; i += 1) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      curr[j] = Math.min(
        curr[j - 1] + 1,
        prev[j] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    for (let j = 0; j <= b.length; j += 1) prev[j] = curr[j];
  }

  return prev[b.length];
}

function scoreCity(city: string, query: string) {
  const c = normalize(city);
  const q = normalize(query);
  if (!q) return 0;
  if (c === q) return 0;
  if (c.startsWith(q)) return 1;
  if (c.includes(q)) return 2;

  const tolerance = q.length >= 7 ? 3 : q.length >= 4 ? 2 : 1;
  const distance = levenshtein(c, q);
  if (distance <= tolerance) return 10 + distance;

  // Une faute au début ne doit pas empêcher une ville longue d'apparaître.
  const prefix = c.slice(0, Math.min(c.length, q.length + 2));
  const prefixDistance = levenshtein(prefix, q);
  if (prefixDistance <= tolerance) return 20 + prefixDistance;

  return Number.POSITIVE_INFINITY;
}

export function CityCombobox({
  value,
  onChange,
}: {
  value: string;
  onChange: (city: string) => void;
}) {
  const initialOption = useMemo(
    () => (value ? { id: value, label: value } : undefined),
    [value],
  );

  async function fetchOptions(search: string) {
    return CAMEROON_CITIES
      .map((city) => ({ city, score: scoreCity(city, search) }))
      .filter(({ score }) => Number.isFinite(score))
      .sort((a, b) => a.score - b.score || a.city.localeCompare(b.city, 'fr'))
      .slice(0, 12)
      .map(({ city }) => ({ id: city, label: city }));
  }

  return (
    <Combobox
      placeholder="Saisissez une ville…"
      value={value}
      initialOption={initialOption}
      minSearchLength={1}
      debounce={80}
      fetchOptions={fetchOptions}
      onChange={(id) => onChange(id ?? '')}
    />
  );
}
