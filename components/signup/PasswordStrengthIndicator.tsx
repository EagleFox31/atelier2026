'use client';

import { getPasswordStrength } from '@/lib/password-strength';
import { cn } from '@/lib/utils';

const BAR_COLORS = {
  weak: 'bg-[var(--afrique-coral)]',
  medium: 'bg-[var(--afrique-gold)]',
  strong: 'bg-[var(--afrique-forest)]',
} as const;

const LABEL_COLORS = {
  weak: 'text-[var(--afrique-coral)]',
  medium: 'text-[#8a6914]',
  strong: 'text-[var(--afrique-forest)]',
} as const;

export function PasswordStrengthIndicator({ password }: { password: string }) {
  const strength = getPasswordStrength(password);

  if (!password) return null;

  return (
    <div className="mt-2 space-y-2" aria-live="polite">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="text-slate-500">Robustesse</span>
        <span className={cn('font-semibold', LABEL_COLORS[strength.level])}>
          {strength.label}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
        <div
          className={cn('h-full rounded-full transition-all duration-300', BAR_COLORS[strength.level])}
          style={{ width: `${strength.percent}%` }}
        />
      </div>
      {strength.level !== 'strong' && strength.hints.length > 0 && (
        <p className="text-[11px] leading-snug text-slate-500">
          Pour renforcer : {strength.hints.slice(0, 3).join(' · ')}
        </p>
      )}
    </div>
  );
}
