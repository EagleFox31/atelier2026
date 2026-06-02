'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Building2,
  Wrench,
  Bell,
  ShieldCheck,
  Save,
  Smartphone,
  Percent,
  Clock,
  Loader2,
  PlusCircle,
  MapPin,
} from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/auth-context';
import { handleApiError, settingsApi } from '@/lib/api';
import type { WorkshopSettings } from '@/lib/workshop-settings';
import { toast } from 'sonner';

type GeneralForm = Pick<
  WorkshopSettings,
  'shopName' | 'tagline' | 'niu' | 'email' | 'phone' | 'address'
>;

type BusinessForm = Pick<WorkshopSettings, 'defaultLaborRateXaf' | 'taxRatePct'>;

export default function SettingsPage() {
  const { hasRole } = useAuth();
  const canEdit = hasRole('ADMIN') || hasRole('SUPER_ADMIN');

  const [loading, setLoading] = useState(true);
  const [savingGeneral, setSavingGeneral] = useState(false);
  const [savingBusiness, setSavingBusiness] = useState(false);
  const [settings, setSettings] = useState<WorkshopSettings | null>(null);

  const [general, setGeneral] = useState<GeneralForm>({
    shopName: '',
    tagline: '',
    niu: '',
    email: '',
    phone: '',
    address: '',
  });

  const [business, setBusiness] = useState<BusinessForm>({
    defaultLaborRateXaf: 15000,
    taxRatePct: 19.25,
  });

  useEffect(() => {
    settingsApi.getWorkshop()
      .then(data => {
        setSettings(data);
        setGeneral({
          shopName: data.shopName,
          tagline: data.tagline,
          niu: data.niu ?? '',
          email: data.email,
          phone: data.phone,
          address: data.address,
        });
        setBusiness({
          defaultLaborRateXaf: data.defaultLaborRateXaf ?? 15000,
          taxRatePct: data.taxRatePct,
        });
      })
      .catch(err => handleApiError(err, 'Impossible de charger les paramètres'))
      .finally(() => setLoading(false));
  }, []);

  async function saveAll(partial: Partial<WorkshopSettings>, kind: 'general' | 'business') {
    if (!canEdit) {
      toast.error('Seuls les administrateurs peuvent modifier les paramètres');
      return;
    }
    const setSaving = kind === 'general' ? setSavingGeneral : setSavingBusiness;
    setSaving(true);
    try {
      const payload = {
        shopName: general.shopName.trim(),
        tagline: general.tagline.trim(),
        niu: (general.niu ?? '').trim() || undefined,
        email: general.email.trim(),
        phone: general.phone.trim(),
        address: general.address.trim(),
        defaultLaborRateXaf: business.defaultLaborRateXaf ?? undefined,
        taxRatePct: business.taxRatePct,
        ...partial,
      };
      const updated = await settingsApi.updateWorkshop(payload);
      setSettings(updated);
      toast.success('Paramètres enregistrés — les prochains devis utiliseront ces informations');
    } catch (err) {
      handleApiError(err, 'Erreur lors de l\'enregistrement');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Paramètres</h1>
            <p className="text-slate-500">Configurez votre atelier et vos préférences</p>
            {settings?.updatedAt && !loading && (
              <p className="text-xs text-slate-400 mt-1">
                Dernière mise à jour : {new Date(settings.updatedAt).toLocaleString('fr-FR')}
              </p>
            )}
          </div>
          {canEdit && (
            <Button
              variant="outline"
              className="gap-2 shrink-0 border-brand/30 text-brand hover:bg-brand/5"
              onClick={() => toast.info('Fonctionnalité bientôt disponible — ajout de garage secondaire', { duration: 4000 })}
            >
              <PlusCircle size={16} />
              <MapPin size={14} />
              Ajouter un garage
            </Button>
          )}
        </div>

        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-10 w-full max-w-xl" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : (
          <Tabs defaultValue="general" className="space-y-6">
            <TabsList className="bg-slate-100 p-1">
              <TabsTrigger value="general" className="gap-2">
                <Building2 size={16} />
                Atelier
              </TabsTrigger>
              <TabsTrigger value="workshop" className="gap-2">
                <Wrench size={16} />
                Métier
              </TabsTrigger>
              <TabsTrigger value="notifications" className="gap-2">
                <Bell size={16} />
                Notifications
              </TabsTrigger>
              <TabsTrigger value="security" className="gap-2">
                <ShieldCheck size={16} />
                Sécurité
              </TabsTrigger>
            </TabsList>

            <TabsContent value="general">
              <Card className="border-none shadow-sm">
                <CardHeader>
                  <CardTitle>Informations de l&apos;Atelier</CardTitle>
                  <CardDescription>
                    Ces informations apparaissent sur vos devis et factures.
                    {!canEdit && ' (lecture seule — contactez un administrateur pour modifier)'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="shopName">Nom de l&apos;atelier</Label>
                      <Input
                        id="shopName"
                        value={general.shopName}
                        disabled={!canEdit}
                        onChange={e => setGeneral(g => ({ ...g, shopName: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="tagline">Sous-titre / activité</Label>
                      <Input
                        id="tagline"
                        value={general.tagline}
                        disabled={!canEdit}
                        onChange={e => setGeneral(g => ({ ...g, tagline: e.target.value }))}
                        placeholder="Garage automobile — Yaoundé, Cameroun"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="niu">Numéro d&apos;Identifiant Unique (NIU)</Label>
                      <Input
                        id="niu"
                        value={general.niu ?? ''}
                        disabled={!canEdit}
                        onChange={e => setGeneral(g => ({ ...g, niu: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email de contact</Label>
                      <Input
                        id="email"
                        type="email"
                        value={general.email}
                        disabled={!canEdit}
                        onChange={e => setGeneral(g => ({ ...g, email: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Téléphone</Label>
                      <Input
                        id="phone"
                        value={general.phone}
                        disabled={!canEdit}
                        onChange={e => setGeneral(g => ({ ...g, phone: e.target.value }))}
                      />
                    </div>
                    <div className="md:col-span-2 space-y-2">
                      <Label htmlFor="address">Adresse physique</Label>
                      <Input
                        id="address"
                        value={general.address}
                        disabled={!canEdit}
                        onChange={e => setGeneral(g => ({ ...g, address: e.target.value }))}
                      />
                    </div>
                  </div>
                  <Separator />
                  {canEdit && (
                    <div className="flex justify-end">
                      <Button
                        className="bg-brand hover:bg-brand-hover gap-2"
                        disabled={savingGeneral}
                        onClick={() => saveAll({}, 'general')}
                      >
                        {savingGeneral ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                        Enregistrer les modifications
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="workshop">
              <Card className="border-none shadow-sm">
                <CardHeader>
                  <CardTitle>Paramètres Métier</CardTitle>
                  <CardDescription>Tarifs et taxes par défaut de l&apos;atelier.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <Clock size={16} className="text-slate-400" />
                        Taux horaire main d&apos;œuvre (XAF/h)
                      </Label>
                      <Input
                        type="number"
                        min={0}
                        disabled={!canEdit}
                        value={business.defaultLaborRateXaf ?? ''}
                        onChange={e => setBusiness(b => ({
                          ...b,
                          defaultLaborRateXaf: Number(e.target.value) || 0,
                        }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <Percent size={16} className="text-slate-400" />
                        TVA (%)
                      </Label>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        step={0.01}
                        disabled={!canEdit}
                        value={business.taxRatePct}
                        onChange={e => setBusiness(b => ({
                          ...b,
                          taxRatePct: Number(e.target.value) || 0,
                        }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Devise par défaut</Label>
                      <Input defaultValue="XAF (Franc CFA)" disabled />
                    </div>
                  </div>
                  <Separator />
                  {canEdit && (
                    <div className="flex justify-end">
                      <Button
                        className="bg-brand hover:bg-brand-hover gap-2"
                        disabled={savingBusiness}
                        onClick={() => saveAll({}, 'business')}
                      >
                        {savingBusiness ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                        Enregistrer les tarifs
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="notifications">
              <Card className="border-none shadow-sm">
                <CardHeader>
                  <CardTitle>Configuration SMS & Alertes</CardTitle>
                  <CardDescription>Gérez l&apos;envoi automatique de SMS à vos clients.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 rounded-xl border border-slate-100">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center">
                          <Smartphone size={20} />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-900">SMS de réception véhicule</p>
                          <p className="text-xs text-slate-500">Envoyé dès qu&apos;un OT est créé.</p>
                        </div>
                      </div>
                      <Button variant="outline" size="sm">Configurer le template</Button>
                    </div>
                    <div className="flex items-center justify-between p-4 rounded-xl border border-slate-100">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-green-50 text-green-600 flex items-center justify-center">
                          <Smartphone size={20} />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-900">SMS véhicule prêt</p>
                          <p className="text-xs text-slate-500">Envoyé quand le statut passe à &quot;PRÊT&quot;.</p>
                        </div>
                      </div>
                      <Button variant="outline" size="sm">Configurer le template</Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
    </div>
  );
}
