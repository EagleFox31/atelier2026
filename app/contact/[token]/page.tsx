'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { AlertCircle, MapPin, PhoneCall, Wrench, Loader2, RotateCcw, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

type Contact = {
  garageName: string;
  city: string;
  address: string;
  phone: string;
  dialNumber: string;
};

type LoadState =
  | { status: 'loading' }
  | { status: 'success'; contact: Contact }
  | { status: 'expired' | 'invalid' | 'unavailable' };

export default function GarageContactPage() {
  const params = useParams<{ token: string }>();
  const token = typeof params?.token === 'string' ? params.token : '';
  const [state, setState] = useState<LoadState>({ status: 'loading' });

  const load = useCallback(async () => {
    setState({ status: 'loading' });
    if (!/^[A-Za-z0-9_-]{43}$/.test(token)) {
      setState({ status: 'invalid' });
      return;
    }
    try {
      const response = await fetch(`/api/public/garage-contact/${token}`, {
        cache: 'no-store',
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
      });
      if (response.status === 404) return setState({ status: 'invalid' });
      if (response.status === 410) return setState({ status: 'expired' });
      if (!response.ok) return setState({ status: 'unavailable' });
      const contact: Contact = await response.json();
      if (!contact.garageName || !/^\+?[0-9]{8,15}$/.test(contact.dialNumber)) {
        return setState({ status: 'unavailable' });
      }
      setState({ status: 'success', contact });
    } catch {
      setState({ status: 'unavailable' });
    }
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  const loading = state.status === 'loading';
  const contact = state.status === 'success' ? state.contact : null;

  return (
    <main className="min-h-screen bg-background px-4 py-10 sm:py-16">
      <div className="mx-auto flex w-full max-w-lg flex-col gap-6">
        <header className="flex flex-col items-center gap-3 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand text-white shadow-lg shadow-brand/20">
            <Wrench aria-hidden size={29} />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Atelier Maître</p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
              {contact?.garageName ?? 'Contacter votre atelier'}
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Les coordonnées de votre atelier, disponibles directement depuis votre notification.
            </p>
          </div>
        </header>

        {loading ? (
          <Card aria-live="polite" className="border-border">
            <CardContent className="flex justify-center gap-2 py-12 text-muted-foreground">
              <Loader2 className="animate-spin" aria-hidden size={20} /> Chargement des coordonnées…
            </CardContent>
          </Card>
        ) : contact ? (
          <Card className="border-border shadow-lg">
            <CardHeader>
              <CardTitle>Votre atelier</CardTitle>
              <CardDescription>Vous pouvez appeler directement le garage qui vous a envoyé la notification.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex items-start gap-3 rounded-xl bg-muted/60 p-4">
                <PhoneCall className="mt-1 shrink-0 text-brand" aria-hidden size={20} />
                <div className="min-w-0">
                  <p className="text-xs font-medium text-muted-foreground">Téléphone</p>
                  <p className="mt-1 break-all text-lg font-semibold">{contact.phone}</p>
                </div>
              </div>
              {(contact.address || contact.city) && (
                <div className="flex items-start gap-3 px-2">
                  <MapPin className="mt-1 shrink-0 text-brand" aria-hidden size={20} />
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Adresse</p>
                    <p className="mt-1 text-sm">
                      {[contact.address, contact.city].filter(Boolean).join(', ')}
                    </p>
                  </div>
                </div>
              )}
              <Button asChild className="h-12 w-full bg-brand text-white hover:bg-brand-hover">
                <a href={`tel:${contact.dialNumber}`} rel="noreferrer" aria-label={`Appeler ${contact.garageName}`}>
                  <PhoneCall aria-hidden size={18} /> Appeler l’atelier
                </a>
              </Button>
              <p className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
                <ShieldCheck className="shrink-0" aria-hidden size={16} />
                Cette page ne contient aucune donnée de facture ni information personnelle du client.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-border" role="alert">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="text-brand" aria-hidden size={20} />
                {state.status === 'expired' ? 'Lien expiré' :
                 state.status === 'invalid' ? 'Lien indisponible' : 'Service temporairement indisponible'}
              </CardTitle>
              <CardDescription>
                {state.status === 'expired' ?
                  'Ce lien n’est plus valable. Demandez un nouveau message à votre atelier.' :
                 state.status === 'invalid' ?
                  'Ce lien est invalide ou le garage n’est plus disponible.' :
                  'Impossible de charger les coordonnées pour le moment.'}
              </CardDescription>
            </CardHeader>
            {state.status === 'unavailable' && (
              <CardContent>
                <Button variant="outline" className="w-full" onClick={() => void load()}>
                  <RotateCcw aria-hidden size={16} /> Réessayer
                </Button>
              </CardContent>
            )}
          </Card>
        )}
        <p className="text-center text-xs text-muted-foreground">
          Une page de contact sécurisée, proposée par Atelier Maître.
        </p>
      </div>
    </main>
  );
}
