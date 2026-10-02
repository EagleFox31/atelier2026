'use client';

import { useState } from 'react';
import { ArrowRight, Check, CreditCard, Loader2, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  getApiErrorMessage,
  subscriptionApi,
  type SubscriptionBillingCycle,
} from '@/lib/api';
import { cn } from '@/lib/utils';

const BILLING_OPTIONS: Array<{
  cycle: SubscriptionBillingCycle;
  label: string;
  price: string;
  cadence: string;
  note: string;
}> = [
  {
    cycle: 'monthly',
    label: 'Mensuel',
    price: '45 000 FCFA',
    cadence: '/ mois',
    note: 'Flexible, renouvelé chaque mois',
  },
  {
    cycle: 'annual',
    label: 'Annuel',
    price: '450 000 FCFA',
    cadence: '/ an',
    note: 'Économisez 90 000 FCFA par an',
  },
];

function isTrustedNotchPayCheckoutUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      (url.hostname === 'notchpay.co' || url.hostname.endsWith('.notchpay.co'))
    );
  } catch {
    return false;
  }
}

export function SubscriptionCheckoutButton({
  label = 'Activer le forfait Pro',
  className,
}: {
  label?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [billingCycle, setBillingCycle] = useState<SubscriptionBillingCycle>('annual');
  const [isStarting, setIsStarting] = useState(false);

  async function startCheckout() {
    setIsStarting(true);
    try {
      const checkout = await subscriptionApi.createCheckout(billingCycle);
      if (!isTrustedNotchPayCheckoutUrl(checkout.authorizationUrl)) {
        throw new Error('L’adresse de paiement reçue est invalide.');
      }
      window.location.assign(checkout.authorizationUrl);
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Impossible de démarrer le paiement'));
      setIsStarting(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        className={cn('gap-2 bg-brand text-white hover:bg-brand-hover', className)}
        onClick={() => setOpen(true)}
      >
        <CreditCard aria-hidden />
        {label}
      </Button>

      <Dialog open={open} onOpenChange={(nextOpen) => !isStarting && setOpen(nextOpen)}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-lg rounded-2xl border-border bg-card">
          <DialogHeader>
            <DialogTitle>Activer Atelier Maître Pro</DialogTitle>
            <DialogDescription>
              Choisissez votre fréquence de facturation. Le montant final tient compte du nombre
              de garages actifs et sera confirmé avant le paiement.
            </DialogDescription>
          </DialogHeader>

          <fieldset className="grid gap-3 py-2 sm:grid-cols-2">
            <legend className="sr-only">Fréquence de facturation</legend>
            {BILLING_OPTIONS.map((option) => {
              const selected = billingCycle === option.cycle;
              return (
                <label
                  key={option.cycle}
                  className={cn(
                    'relative cursor-pointer rounded-2xl border p-4 text-left transition-colors focus-within:ring-2 focus-within:ring-brand',
                    selected
                      ? 'border-brand bg-[var(--afrique-brand-soft)]'
                      : 'border-border bg-background hover:border-brand/40',
                    isStarting && 'cursor-not-allowed opacity-60',
                  )}
                >
                  <input
                    type="radio"
                    name="subscription-billing-cycle"
                    value={option.cycle}
                    checked={selected}
                    onChange={() => setBillingCycle(option.cycle)}
                    disabled={isStarting}
                    className="sr-only"
                  />
                  {selected && (
                    <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-brand text-white">
                      <Check className="h-3.5 w-3.5" aria-hidden />
                    </span>
                  )}
                  <span className="text-sm font-semibold text-foreground">{option.label}</span>
                  <span className="mt-3 block text-xl font-bold text-[var(--afrique-earth)]">
                    {option.price}
                  </span>
                  <span className="text-xs text-muted-foreground">{option.cadence}</span>
                  <span className="mt-3 block text-xs font-medium text-brand">{option.note}</span>
                </label>
              );
            })}
          </fieldset>

          <div className="flex items-start gap-3 rounded-xl bg-[var(--afrique-forest-soft)] p-3 text-sm text-[var(--afrique-earth)]">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[var(--afrique-forest)]" aria-hidden />
            <p>
              Paiement hébergé par NotchPay. Un garage est inclus ; chaque garage supplémentaire
              coûte 20 000 FCFA par mois.
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isStarting}>
              Annuler
            </Button>
            <Button
              type="button"
              className="gap-2 bg-brand text-white hover:bg-brand-hover"
              onClick={() => void startCheckout()}
              disabled={isStarting}
            >
              {isStarting ? (
                <Loader2 className="animate-spin" aria-hidden />
              ) : (
                <ArrowRight aria-hidden />
              )}
              {isStarting ? 'Ouverture du paiement…' : 'Continuer vers NotchPay'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
