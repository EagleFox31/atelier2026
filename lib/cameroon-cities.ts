export const CAMEROON_CITIES = [
  'Bafang',
  'Bafia',
  'Bafoussam',
  'Bali',
  'Bamenda',
  'Bangangté',
  'Batouri',
  'Bertoua',
  'Buéa',
  'Douala',
  'Dschang',
  'Edéa',
  'Ebolowa',
  'Eséka',
  'Foumban',
  'Garoua',
  'Guider',
  'Kousséri',
  'Kribi',
  'Kumba',
  'Limbe',
  'Loum',
  'Maroua',
  'Mbalmayo',
  'Mbanga',
  'Mbouda',
  'Meiganga',
  'Melong',
  'Mora',
  'Ngaoundéré',
  'Nkongsamba',
  'Sangmélima',
  'Tiko',
  'Wum',
  'Yaoundé',
  'Yagoua',
] as const;

function normalize(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function levenshtein(a: string, b: string) {
  if (a === b) return 0;
  if (!a) return b.length;
  if (!b) return a.length;

  const previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  const current = new Array<number>(b.length + 1);

  for (let i = 1; i <= a.length; i += 1) {
    current[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    for (let j = 0; j <= b.length; j += 1) previous[j] = current[j];
  }

  return previous[b.length];
}

export function searchCameroonCities(query: string) {
  const q = normalize(query);
  if (!q) return [...CAMEROON_CITIES];

  const maxDistance = q.length <= 4 ? 2 : 3;

  return CAMEROON_CITIES
    .map((city) => {
      const normalized = normalize(city);
      const starts = normalized.startsWith(q);
      const contains = normalized.includes(q);
      const distance = levenshtein(q, normalized.slice(0, Math.max(q.length, normalized.length)));
      return { city, starts, contains, distance };
    })
    .filter(({ starts, contains, distance }) => starts || contains || distance <= maxDistance)
    .sort((a, b) => {
      if (a.starts !== b.starts) return a.starts ? -1 : 1;
      if (a.contains !== b.contains) return a.contains ? -1 : 1;
      return a.distance - b.distance || a.city.localeCompare(b.city, 'fr');
    })
    .map(({ city }) => city);
}
