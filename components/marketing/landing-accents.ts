/** Accents couleur par carte fonctionnalité (rotation palette africaine). */
export const FEATURE_ACCENTS = [
  {
    iconBox: 'bg-[var(--afrique-brand-soft)] ring-[var(--afrique-brand-ring)]',
    icon: 'text-brand',
    hoverBar: 'bg-gradient-to-r from-transparent via-brand/40 to-transparent',
    hoverBorder: 'hover:border-brand/30',
  },
  {
    iconBox: 'bg-[var(--afrique-gold-soft)] ring-[var(--afrique-gold-ring)]',
    icon: 'text-[var(--afrique-gold)]',
    hoverBar: 'bg-gradient-to-r from-transparent via-[var(--afrique-gold)]/50 to-transparent',
    hoverBorder: 'hover:border-[var(--afrique-gold)]/35',
  },
  {
    iconBox: 'bg-[var(--afrique-forest-soft)] ring-[var(--afrique-forest-ring)]',
    icon: 'text-[var(--afrique-forest)]',
    hoverBar: 'bg-gradient-to-r from-transparent via-[var(--afrique-forest)]/45 to-transparent',
    hoverBorder: 'hover:border-[var(--afrique-forest)]/30',
  },
  {
    iconBox: 'bg-[var(--afrique-terra-soft)] ring-[var(--afrique-terra-ring)]',
    icon: 'text-[var(--afrique-terracotta)]',
    hoverBar: 'bg-gradient-to-r from-transparent via-[var(--afrique-terracotta)]/45 to-transparent',
    hoverBorder: 'hover:border-[var(--afrique-terracotta)]/35',
  },
] as const;

export const PAIN_CARD_STYLES = [
  'border-[var(--afrique-terracotta)]/25 bg-gradient-to-br from-[var(--afrique-terra-soft)] to-white text-[#6b3d28]',
  'border-[var(--afrique-gold)]/30 bg-gradient-to-br from-[var(--afrique-gold-soft)] to-white text-[#6b5520]',
  'border-[var(--afrique-coral)]/25 bg-gradient-to-br from-[rgb(212_93_74/0.1)] to-white text-[#7a3d34]',
  'border-[var(--afrique-earth)]/25 bg-gradient-to-br from-[rgb(139_94_60/0.1)] to-white text-[#5c4535]',
] as const;
