'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { useMarkGettingStartedVisit } from '@/hooks/use-mark-getting-started-visit';
import {
  demoRequestsApi,
  handleApiError,
  type DemoRequest,
  type DemoRequestStatus,
} from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';
import {
  Mail,
  Phone,
  Presentation,
  RefreshCw,
  Search,
  MapPin,
  Building2,
  User,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const STATUS_META: Record<
  DemoRequestStatus,
  { label: string; className: string }
> = {
  NEW: { label: 'Nouvelle', className: 'bg-amber-50 text-amber-800 border-amber-200' },
  CONTACTED: { label: 'Contactée', className: 'bg-blue-50 text-blue-800 border-blue-200' },
  SCHEDULED: { label: 'Démo planifiée', className: 'bg-violet-50 text-violet-800 border-violet-200' },
  CONVERTED: { label: 'Convertie', className: 'bg-green-50 text-green-800 border-green-200' },
  REJECTED: { label: 'Refusée', className: 'bg-slate-100 text-slate-600 border-slate-200' },
};

const STATUS_OPTIONS = Object.entries(STATUS_META) as [DemoRequestStatus, { label: string }][];

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function DemoRequestsPage() {
  useMarkGettingStartedVisit('demo');
  const { hasRole, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedId = searchParams.get('id');

  const [items, setItems] = useState<DemoRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selected, setSelected] = useState<DemoRequest | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editStatus, setEditStatus] = useState<DemoRequestStatus>('NEW');
  const [editNotes, setEditNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const isSuperAdmin = hasRole('SUPER_ADMIN');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await demoRequestsApi.list({
        status: statusFilter !== 'all' ? (statusFilter as DemoRequestStatus) : undefined,
        q: search.trim() || undefined,
        limit: 100,
      });
      setItems(data);
    } catch (err: unknown) {
      handleApiError(err, 'Impossible de charger les demandes de démo');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, search]);

  useEffect(() => {
    if (!authLoading && !isSuperAdmin) {
      router.replace('/dashboard');
    }
  }, [authLoading, isSuperAdmin, router]);

  useEffect(() => {
    if (isSuperAdmin) load();
  }, [isSuperAdmin, load]);

  const openDetail = useCallback(async (id: string) => {
    try {
      const row = await demoRequestsApi.get(id);
      setSelected(row);
      setEditStatus(row.status);
      setEditNotes(row.adminNotes ?? '');
      setSheetOpen(true);
      router.replace(`/demo-requests?id=${id}`, { scroll: false });
    } catch (err: unknown) {
      handleApiError(err, 'Demande introuvable');
    }
  }, [router]);

  useEffect(() => {
    if (!selectedId || !isSuperAdmin) return;
    openDetail(selectedId);
  }, [selectedId, isSuperAdmin, openDetail]);

  function closeSheet() {
    setSheetOpen(false);
    setSelected(null);
    router.replace('/demo-requests', { scroll: false });
  }

  async function handleSave() {
    if (!selected) return;
    setSaving(true);
    try {
      const updated = await demoRequestsApi.update(selected.id, {
        status: editStatus,
        adminNotes: editNotes,
      });
      setSelected(updated);
      setItems((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      toast.success('Demande mise à jour');
    } catch (err: unknown) {
      handleApiError(err, 'Enregistrement impossible');
    } finally {
      setSaving(false);
    }
  }

  if (authLoading || !isSuperAdmin) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Presentation className="h-7 w-7 text-brand" />
            Demandes de démo
          </h1>
          <p className="text-muted-foreground">
            Prospects issus du formulaire public — suivi et prise de contact
          </p>
        </div>
        <Button variant="outline" size="icon" onClick={() => load()} className="shrink-0">
          <RefreshCw size={16} />
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher nom, email, atelier…"
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && load()}
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v ?? 'all')}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Tous les statuts" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            {STATUS_OPTIONS.map(([value, { label }]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={() => load()}>Filtrer</Button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Aucune demande pour ces critères.
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="md:hidden space-y-3">
            {items.map((row) => (
              <Card
                key={row.id}
                className="cursor-pointer hover:border-brand/40 transition-colors"
                onClick={() => openDetail(row.id)}
              >
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">{row.garageName}</p>
                      <p className="text-sm text-muted-foreground">{row.fullName}</p>
                    </div>
                    <Badge variant="outline" className={cn('shrink-0', STATUS_META[row.status].className)}>
                      {STATUS_META[row.status].label}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{formatDate(row.createdAt)}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="hidden md:block rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3 font-medium">Atelier</th>
                  <th className="text-left p-3 font-medium">Contact</th>
                  <th className="text-left p-3 font-medium">Ville</th>
                  <th className="text-left p-3 font-medium">Statut</th>
                  <th className="text-left p-3 font-medium">Reçue le</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr
                    key={row.id}
                    className="border-t hover:bg-muted/30 cursor-pointer"
                    onClick={() => openDetail(row.id)}
                  >
                    <td className="p-3 font-medium">{row.garageName}</td>
                    <td className="p-3">
                      <div>{row.fullName}</div>
                      <div className="text-muted-foreground text-xs">{row.email}</div>
                    </td>
                    <td className="p-3 text-muted-foreground">{row.city ?? '—'}</td>
                    <td className="p-3">
                      <Badge variant="outline" className={STATUS_META[row.status].className}>
                        {STATUS_META[row.status].label}
                      </Badge>
                    </td>
                    <td className="p-3 text-muted-foreground whitespace-nowrap">
                      {formatDate(row.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <Sheet open={sheetOpen} onOpenChange={(open) => !open && closeSheet()}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle>{selected.garageName}</SheetTitle>
                <p className="text-sm text-muted-foreground">
                  Reçue le {formatDate(selected.createdAt)}
                </p>
              </SheetHeader>

              <div className="mt-6 space-y-4">
                <div className="space-y-3 text-sm">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span>{selected.fullName}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span>{selected.garageName}</span>
                  </div>
                  {selected.city && (
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span>{selected.city}</span>
                    </div>
                  )}
                  <a
                    href={`mailto:${selected.email}`}
                    className="flex items-center gap-2 text-brand hover:underline"
                  >
                    <Mail className="h-4 w-4" />
                    {selected.email}
                  </a>
                  <a
                    href={`tel:${selected.phone}`}
                    className="flex items-center gap-2 text-brand hover:underline"
                  >
                    <Phone className="h-4 w-4" />
                    {selected.phone}
                  </a>
                </div>

                {selected.message && (
                  <div className="rounded-lg bg-muted/50 p-3 text-sm">
                    <p className="font-medium text-xs text-muted-foreground mb-1">Message</p>
                    <p className="whitespace-pre-wrap">{selected.message}</p>
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-sm font-medium">Statut</label>
                  <Select
                    value={editStatus}
                    onValueChange={(v) => setEditStatus(v as DemoRequestStatus)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map(([value, { label }]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Notes internes</label>
                  <Textarea
                    rows={4}
                    placeholder="Rappel prévu, objections, prochaine étape…"
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                  />
                </div>

                {selected.handledBy && (
                  <p className="text-xs text-muted-foreground">
                    Dernière mise à jour par {selected.handledBy.firstName}{' '}
                    {selected.handledBy.lastName}
                  </p>
                )}

                <Button className="w-full" onClick={handleSave} disabled={saving}>
                  {saving ? 'Enregistrement…' : 'Enregistrer'}
                </Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
