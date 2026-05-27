'use client';

import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { MOBILE_BOTTOM_NAV_OFFSET } from '@/lib/constants';

interface MobileFormActionBarProps {
  formId: string;
  label: string;
  loading?: boolean;
  disabled?: boolean;
}

/** Barre d'action fixe au-dessus de la BottomNav — même logique que TechMobileBar. */
export function MobileFormActionBar({ formId, label, loading, disabled }: MobileFormActionBarProps) {
  return (
    <div
      className="md:hidden fixed left-0 right-0 z-[110] border-t border-border bg-card/95 backdrop-blur-xl px-3 py-2 shadow-[0_-4px_16px_rgba(0,0,0,0.08)]"
      style={{ bottom: MOBILE_BOTTOM_NAV_OFFSET }}
    >
      <Button
        type="submit"
        form={formId}
        disabled={disabled || loading}
        className="w-full max-w-lg mx-auto flex h-11 bg-brand hover:bg-brand-hover font-bold text-base"
      >
        {loading && <Loader2 size={16} className="animate-spin mr-2" />}
        {label}
      </Button>
    </div>
  );
}
