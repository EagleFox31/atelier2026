import { Great_Vibes } from 'next/font/google';
import { cn } from '@/lib/utils';

const brandScript = Great_Vibes({
  subsets: ['latin', 'latin-ext'],
  weight: '400',
  display: 'swap',
});

/** Nom de marque en style calligraphie (landing & accents marketing). */
export function BrandCalligraphy({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        brandScript.className,
        'inline-block align-baseline text-[1.75em] leading-[0.95] text-brand sm:text-[1.85em]',
        className,
      )}
    >
      {children}
    </span>
  );
}
