'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { CustomerSearchStep, type SelectedCustomer } from '@/components/reception/CustomerSearchStep';
import { VehicleSearchStep } from '@/components/reception/VehicleSearchStep';
import { useAuth } from '@/contexts/auth-context';
import { cn } from '@/lib/utils';
import { ArrowLeft, CheckCircle2, ChevronLeft, User, Car, ClipboardList } from 'lucide-react';

const STEPS = [
  { n: 1, label: 'Client', icon: User },
  { n: 2, label: 'Véhicule', icon: Car },
  { n: 3, label: 'Réception', icon: ClipboardList },
] as const;

export default function ReceptionExpressPage() {
  const router = useRouter();
  const { hasPermission } = useAuth();
  const canReceive = hasPermission('ORD_CREATE') && hasPermission('VEH_CREATE');

  const [step, setStep] = useState<1 | 2>(1);
  const [customer, setCustomer] = useState<SelectedCustomer | null>(null);

  if (!canReceive) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 px-4 text-center">
        <p className="text-muted-foreground">Vous n&apos;avez pas les droits pour la réception express.</p>
        <Button variant="outline" onClick={() => router.push('/')}>Retour</Button>
      </div>
    );
  }

  function goToReception(vehicleId: string) {
    router.push(`/vehicles/${vehicleId}/reception`);
  }

  return (
    <div className="space-y-6 pb-8 md:pb-6 max-w-2xl mx-auto">
      <div className="flex items-start gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="shrink-0 -ml-1">
          <ArrowLeft size={20} />
        </Button>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">Réception express</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Client → véhicule → contrôle d&apos;entrée
          </p>
        </div>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-1 sm:gap-2">
        {STEPS.map(({ n, label, icon: Icon }, idx) => {
          const done = step > n || (n === 1 && customer);
          const active = (n === 1 && step === 1) || (n === 2 && step === 2) || (n === 3 && false);
          return (
            <div key={n} className="flex items-center gap-1 sm:gap-2 flex-1 min-w-0">
              <div
                className={cn(
                  'flex items-center gap-1.5 min-w-0 flex-1',
                  n > 2 && 'opacity-50',
                )}
              >
                <span
                  className={cn(
                    'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 shrink-0',
                    done && n < 3 ? 'bg-green-500 border-green-500 text-white'
                    : active ? 'bg-brand border-brand text-white'
                    : 'border-muted-foreground/30 text-muted-foreground',
                  )}
                >
                  {done && n < step ? <CheckCircle2 size={14} /> : n}
                </span>
                <span className={cn(
                  'text-[10px] sm:text-xs font-medium truncate',
                  active ? 'text-brand' : 'text-muted-foreground',
                )}>
                  {label}
                </span>
              </div>
              {idx < STEPS.length - 1 && (
                <div className="h-px flex-1 bg-border min-w-2" />
              )}
            </div>
          );
        })}
      </div>

      <Card className="border-border shadow-sm">
        <CardContent className="p-4 sm:p-6">
          {step === 1 && (
            <CustomerSearchStep
              onSelected={(c) => {
                setCustomer(c);
                setStep(2);
              }}
            />
          )}

          {step === 2 && customer && (
            <>
              <VehicleSearchStep
                customer={customer}
                onContinue={goToReception}
              />
              <Button
                variant="ghost"
                className="mt-4 gap-1.5 text-muted-foreground w-full sm:w-auto"
                onClick={() => setStep(1)}
              >
                <ChevronLeft size={16} />
                Changer de client
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-center text-muted-foreground px-4">
        L&apos;étape 3 (plainte, kilométrage, checklist) s&apos;ouvre automatiquement après le véhicule.
      </p>
    </div>
  );
}
