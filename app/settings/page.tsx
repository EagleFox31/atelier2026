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
  Target,
  Pencil,
  Trash2,
  Check,
  X,
} from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/auth-context';
import { handleApiError, settingsApi, reportsApi, type MonthlyTargetRow } from '@/lib/api';
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

  // Objectifs mensuels
  const currentYear = new Date().getFullYear();
  const [targetYear, setTargetYear]       = useState(currentYear);
  const [targets, setTargets]             = useState<MonthlyTargetRow[]>([]);
  const [targetsLoading, setTargetsLoading] = useState(false);
  const [editingMonth, setEditingMonth]   = useState<number | null>(null);
  const [editValue, setEditValue]         = useState('');

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

  // ── Objectifs mensuels ────────────────────────────────────────────────────
  React.useEffect(() => {
    if (!canEdit) return;
    setTargetsLoading(true);
    reportsApi.targets(targetYear)
      .then(d => setTargets(d))
      .catch(() => {})
      .finally(() => setTargetsLoading(false));
  }, [targetYear, canEdit]);

  async function saveTarget(month: number) {
    const val = parseFloat(editValue.replace(/\s/g, '').replace(',', '.'));
    if (!val || val <= 0) { setEditingMonth(null); return; }
    try {
      await reportsApi.upsertTarget({ year: targetYear, month, targetXaf: val });
      toast.success('Objectif enregistré');
    } catch { toast.error('Erreur lors de la sauvegarde'); }
    setEditingMonth(null);
    const data = await reportsApi.targets(targetYear);
    setTargets(data);
  }

  async function removeTarget(id: string) {
    try {
      await reportsApi.deleteTarget(id);
      const data = await reportsApi.targets(targetYear);
      setTargets(data);
    } catch { toast.error('Erreur lors de la suppression'); }
  }

  async function applyToAll(value: number) {
    const missing = targets.filter(r => r.targetXaf === null);
    if (missing.length === 0) { toast.info('Tous les mois ont déjà un objectif.'); return; }
    await Promise.all(
      missing.map(r => reportsApi.upsertTarget({ year: targetYear, month: r.month, targetXaf: value }))
    );
    toast.success(`Objectif ${value.toLocaleString('fr-FR')} XAF appliqué à ${missing.length} mois`);
    const data = await reportsApi.targets(targetYear);
    setTargets(data);
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
              {canEdit && (
                <TabsTrigger value="objectifs" className="gap-2">
                  <Target size={16} />
                  Objectifs
                </TabsTrigger>
              )}
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

            {/* Objectifs mensuels */}
            {canEdit && (
              <TabsContent value="objectifs">
                <Card className="border-none shadow-sm">
                  <CardHeader>
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <Target size={18} className="text-brand" /> Objectifs mensuels
                        </CardTitle>
                        <CardDescription>
                          Définissez votre chiffre d&apos;affaires cible par mois.
                          Les résultats s&apos;affichent dans la page Rapports.
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => setTargetYear(y => y - 1)} className="px-2 py-1 rounded text-slate-500 hover:bg-slate-100 text-sm">‹</button>
                        <span className="font-bold text-slate-800 min-w-[3rem] text-center">{targetYear}</span>
                        <button onClick={() => setTargetYear(y => y + 1)} disabled={targetYear > currentYear} className="px-2 py-1 rounded text-slate-500 hover:bg-slate-100 text-sm disabled:opacity-30">›</button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {targetsLoading ? (
                      <div className="space-y-2">{[...Array(6)].map((_, i) => <div key={i} className="h-10 bg-slate-100 animate-pulse rounded" />)}</div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-slate-100">
                              <th className="text-left py-2 pr-4 font-semibold text-slate-500 text-xs uppercase tracking-wide w-32">Mois</th>
                              <th className="text-right py-2 px-3 font-semibold text-slate-500 text-xs uppercase tracking-wide">Objectif CA (XAF)</th>
                              <th className="w-16" />
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                            {targets.map(row => {
                              const isEditing = editingMonth === row.month;
                              return (
                                <tr key={row.month} className="group hover:bg-slate-50/60 transition-colors">
                                  <td className="py-3 pr-4 font-medium text-slate-700">
                                    {['Jan','Fév','Mar','Avr','Mai','Juin','Juil','Aoû','Sep','Oct','Nov','Déc'][row.month - 1]} {targetYear}
                                  </td>
                                  <td className="py-3 px-3 text-right">
                                    {isEditing ? (
                                      <div className="flex items-center justify-end gap-1.5">
                                        <input
                                          autoFocus
                                          type="text"
                                          value={editValue}
                                          onChange={e => setEditValue(e.target.value)}
                                          onKeyDown={e => {
                                            if (e.key === 'Enter') void saveTarget(row.month);
                                            if (e.key === 'Escape') setEditingMonth(null);
                                          }}
                                          className="w-36 text-right border border-brand rounded-lg px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20"
                                          placeholder="ex : 1 500 000"
                                        />
                                        <button onClick={() => void saveTarget(row.month)} className="text-green-600 hover:text-green-700 p-1">
                                          <Check size={15} />
                                        </button>
                                        <button onClick={() => setEditingMonth(null)} className="text-slate-400 hover:text-slate-600 p-1">
                                          <X size={15} />
                                        </button>
                                      </div>
                                    ) : (
                                      <button
                                        onClick={() => { setEditingMonth(row.month); setEditValue(row.targetXaf?.toString() ?? ''); }}
                                        className="flex items-center gap-1.5 ml-auto text-slate-700 hover:text-brand group/edit transition-colors"
                                      >
                                        {row.targetXaf
                                          ? <span className="font-semibold">{row.targetXaf.toLocaleString('fr-FR')} XAF</span>
                                          : <span className="text-slate-400 italic text-xs">Cliquer pour définir</span>}
                                        <Pencil size={12} className="opacity-0 group-hover/edit:opacity-50 transition-opacity" />
                                      </button>
                                    )}
                                  </td>
                                  <td className="py-3 text-right">
                                    {row.targetId && (
                                      <div className="flex items-center justify-end gap-1">
                                        {targets.some(r => r.targetXaf === null) && (
                                          <button
                                            onClick={() => void applyToAll(Number(row.targetXaf))}
                                            className="opacity-0 group-hover:opacity-80 hover:!opacity-100 text-xs text-brand hover:text-brand-hover transition-all px-1.5 py-0.5 rounded hover:bg-brand/10 whitespace-nowrap"
                                            title="Appliquer cette valeur à tous les mois sans objectif"
                                          >
                                            → Copier à tous
                                          </button>
                                        )}
                                        <button
                                          onClick={() => void removeTarget(row.targetId!)}
                                          className="opacity-0 group-hover:opacity-60 hover:!opacity-100 text-slate-400 hover:text-red-500 transition-all p-1"
                                          title="Supprimer l'objectif"
                                        >
                                          <Trash2 size={14} />
                                        </button>
                                      </div>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                        <p className="mt-4 text-xs text-slate-400">
                          Entrée pour valider · Échap pour annuler · Survol pour supprimer
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            )}
          </Tabs>
        )}
    </div>
  );
}
