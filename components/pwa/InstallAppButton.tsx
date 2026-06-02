'use client';

import { useState } from 'react';
import { Download, Check } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { usePwaInstall } from '@/components/pwa/pwa-install-context';
import { InstallAppDialog } from '@/components/pwa/InstallAppDialog';

type InstallAppButtonProps = {
  variant?: 'default' | 'outline' | 'ghost' | 'landing' | 'landing-outline' | 'landing-ghost';
  size?: 'default' | 'sm' | 'lg';
  className?: string;
  /** Masquer si l'app est déjà installée (défaut : true) */
  hideWhenInstalled?: boolean;
};

export function InstallAppButton({
  variant = 'outline',
  size = 'default',
  className,
  hideWhenInstalled = true,
}: InstallAppButtonProps) {
  const { isInstalled, canNativeInstall, installNative } = usePwaInstall();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  if (hideWhenInstalled && isInstalled) {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-2 text-sm text-muted-foreground',
          className,
        )}
      >
        <Check className="h-4 w-4 text-green-600" />
        Application installée
      </span>
    );
  }

  async function handleClick() {
    if (canNativeInstall) {
      setBusy(true);
      try {
        const ok = await installNative();
        if (!ok) setDialogOpen(true);
      } finally {
        setBusy(false);
      }
      return;
    }
    setDialogOpen(true);
  }

  const landingStyles: Record<string, string> = {
    landing:
      'h-12 rounded-xl bg-gradient-to-r from-[var(--afrique-forest)] to-brand text-white shadow-md ring-1 ring-[var(--afrique-gold)]/25 hover:opacity-95',
    'landing-outline':
      'h-12 rounded-xl border-slate-200/90 bg-white/60 text-slate-700 backdrop-blur-sm hover:bg-white hover:border-slate-300',
    'landing-ghost':
      'h-12 rounded-xl border-white/50 bg-white/5 text-white backdrop-blur-sm hover:bg-white/15',
  };

  const useLanding = variant.startsWith('landing');
  const buttonVariant =
    variant === 'default' || variant === 'outline' || variant === 'ghost'
      ? variant
      : 'outline';

  return (
    <>
      <Button
        type="button"
        variant={buttonVariant}
        size={size}
        disabled={busy}
        onClick={handleClick}
        className={cn('gap-2', useLanding && landingStyles[variant], className)}
      >
        <Download className={cn('shrink-0', size === 'sm' ? 'h-4 w-4' : 'h-[18px] w-[18px]')} />
        {busy ? 'Installation…' : 'Installer l\u2019app'}
      </Button>
      <InstallAppDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </>
  );
}

/** Lien compact pour le header marketing */
export function InstallAppHeaderLink({ className }: { className?: string }) {
  const { isInstalled, canNativeInstall, installNative } = usePwaInstall();
  const [dialogOpen, setDialogOpen] = useState(false);

  if (isInstalled) return null;

  async function handleClick() {
    if (canNativeInstall) {
      const ok = await installNative();
      if (!ok) setDialogOpen(true);
      return;
    }
    setDialogOpen(true);
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className={cn(
          buttonVariants({ variant: 'ghost', size: 'sm' }),
          'hidden gap-1.5 text-slate-600 sm:inline-flex',
          className,
        )}
      >
        <Download className="h-4 w-4" />
        Installer
      </button>
      <InstallAppDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </>
  );
}
