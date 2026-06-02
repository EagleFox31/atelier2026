import { Pinyon_Script } from 'next/font/google';
import { cn } from '@/lib/utils';

const brandScript = Pinyon_Script({
  subsets: ['latin'],
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
        'inline-block align-baseline text-[2em] leading-[0.95] text-brand sm:text-[2.1em]',
        className,
      )}
    >
      {children}
    </span>
  );
}
