'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { usePwaInstall } from '@/components/pwa/pwa-install-context';
import { Share, MoreVertical, Monitor, Smartphone } from 'lucide-react';

export function InstallAppDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { isIos } = usePwaInstall();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Installer Atelier Maître</DialogTitle>
          <DialogDescription>
            Ajoutez l&apos;application sur votre écran d&apos;accueil pour un accès rapide,
            comme une app native — sans passer par le Play Store.
          </DialogDescription>
        </DialogHeader>

        {isIos ? (
          <ol className="space-y-4 text-sm text-slate-600">
            <li className="flex gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
                1
              </span>
              <span>
                Ouvrez ce site dans <strong>Safari</strong> (pas Chrome sur iPhone).
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
                <Share className="h-4 w-4" />
              </span>
              <span>
                Touchez <strong>Partager</strong> en bas de l&apos;écran.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
                2
              </span>
              <span>
                Choisissez <strong>Sur l&apos;écran d&apos;accueil</strong>, puis{' '}
                <strong>Ajouter</strong>.
              </span>
            </li>
          </ol>
        ) : (
          <div className="space-y-4 text-sm text-slate-600">
            <div className="flex gap-3 rounded-xl border border-slate-100 bg-slate-50/80 p-4">
              <Smartphone className="mt-0.5 h-5 w-5 shrink-0 text-brand" />
              <div>
                <p className="font-medium text-slate-800">Android (Chrome)</p>
                <p className="mt-1">
                  Menu <MoreVertical className="inline h-3.5 w-3.5" /> →{' '}
                  <strong>Installer l&apos;application</strong> ou{' '}
                  <strong>Ajouter à l&apos;écran d&apos;accueil</strong>.
                </p>
              </div>
            </div>
            <div className="flex gap-3 rounded-xl border border-slate-100 bg-slate-50/80 p-4">
              <Monitor className="mt-0.5 h-5 w-5 shrink-0 text-brand" />
              <div>
                <p className="font-medium text-slate-800">Ordinateur (Chrome / Edge)</p>
                <p className="mt-1">
                  Icône <strong>Installer</strong> dans la barre d&apos;adresse, ou menu du
                  navigateur → Installer Atelier Maître.
                </p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              L&apos;installation nécessite une connexion HTTPS (site en production ou localhost).
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
