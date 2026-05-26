'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
import { CustomerForm } from '@/components/forms/CustomerForm';
import { customersApi, handleApiError } from '@/lib/api';
import { UserPlus, Search, Mail, Phone, ExternalLink } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function customerName(c: any) {
  if (c.customerType === 'COMPANY') return c.companyName || '—';
  return [c.firstName, c.lastName].filter(Boolean).join(' ') || '—';
}

function customerInitials(c: any) {
  return customerName(c).split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
}

// ─── Définition des colonnes ─────────────────────────────────────────────────

function makeColumns(router: AppRouterInstance): DataTableColumn[] {
  return [
    {
      key: 'name',
      label: 'Client',
      sortable: true,
      sortValue: (c) => customerName(c),
      render: (c) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-brand/10 text-brand flex items-center justify-center font-bold text-sm shrink-0">
            {customerInitials(c)}
          </div>
          <div>
            <p className="font-bold text-foreground">{customerName(c)}</p>
            <div className="flex items-center gap-1 mt-0.5">
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 border-none">
                {c.customerType === 'COMPANY' ? 'Entreprise' : 'Particulier'}
              </Badge>
              {c.isVip && (
                <Badge className="text-[10px] px-1.5 py-0 bg-amber-500/10 text-amber-600 border-none">VIP</Badge>
              )}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: 'contact',
      label: 'Contact',
      render: (c) => (
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Phone size={14} />
            <span className="font-mono">{c.phonePrimary}</span>
          </div>
          {c.email && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Mail size={14} />
              <span>{c.email}</span>
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'city',
      label: 'Ville',
      sortable: true,
      className: 'text-sm text-muted-foreground',
      render: (c) => c.city || '—',
    },
    {
      key: 'createdAt',
      label: 'Inscription',
      sortable: true,
      sortValue: (c) => new Date(c.createdAt),
      className: 'text-sm text-muted-foreground whitespace-nowrap',
      render: (c) => new Date(c.createdAt).toLocaleDateString('fr-FR'),
    },
    {
      key: 'actions',
      label: '',
      headerClassName: 'w-12',
      render: (c) => (
        <div className="flex justify-end">
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-brand"
            onClick={e => { e.stopPropagation(); router.push(`/customers/${c.id}`); }}
          >
            <ExternalLink size={18} />
          </Button>
        </div>
      ),
    },
  ];
}

// ─── Filtres rapides ─────────────────────────────────────────────────────────

type TypeFilter = 'ALL' | 'INDIVIDUAL' | 'COMPANY';

// ─── Page ────────────────────────────────────────────────────────────────────

export default function CustomersPage() {
  const router = useRouter();
  const columns = React.useMemo(() => makeColumns(router), [router]);
  const [search, setSearch]         = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('ALL');
  const [vipOnly, setVipOnly]       = useState(false);
  const [customers, setCustomers]   = useState<any[]>([]);
  const [loading, setLoading]       = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await customersApi.list({ search: search || undefined });
      setCustomers(data as any[]);
    } catch (err) {
      handleApiError(err, 'Impossible de charger les clients');
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

  // Filtres client-side (type + vip)
  const filtered = customers.filter(c => {
    if (typeFilter === 'INDIVIDUAL' && c.customerType !== 'INDIVIDUAL') return false;
    if (typeFilter === 'COMPANY'    && c.customerType !== 'COMPANY')    return false;
    if (vipOnly && !c.isVip) return false;
    return true;
  });

  const emptyMessage = search
    ? `Aucun client trouvé pour "${search}"`
    : 'Aucun client enregistré';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Clients</h1>
          <p className="text-muted-foreground">Gérez votre base de données clients et leur historique</p>
        </div>
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogTrigger render={
            <Button className="bg-brand hover:bg-brand-hover gap-2">
              <UserPlus size={18} />
              Nouveau Client
            </Button>
          } />
          <DialogContent className="sm:max-w-[600px] bg-card border-border">
            <DialogHeader>
              <DialogTitle>Ajouter un nouveau client</DialogTitle>
            </DialogHeader>
            <CustomerForm onSuccess={() => { setIsModalOpen(false); load(); }} />
          </DialogContent>
        </Dialog>
      </div>

      {/* Barre de recherche + filtres */}
      <Card className="border-border shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
              <Input
                placeholder="Rechercher par nom, email ou téléphone..."
                className="pl-10 bg-muted border-border"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {(['ALL', 'INDIVIDUAL', 'COMPANY'] as TypeFilter[]).map(t => (
                <Button
                  key={t}
                  size="sm"
                  variant={typeFilter === t ? 'default' : 'outline'}
                  className={typeFilter === t ? 'bg-brand hover:bg-brand-hover' : 'border-border'}
                  onClick={() => setTypeFilter(t)}
                >
                  {t === 'ALL' ? 'Tous' : t === 'INDIVIDUAL' ? 'Particuliers' : 'Entreprises'}
                </Button>
              ))}
              <Button
                size="sm"
                variant={vipOnly ? 'default' : 'outline'}
                className={vipOnly ? 'bg-amber-500 hover:bg-amber-600 text-white' : 'border-border'}
                onClick={() => setVipOnly(v => !v)}
              >
                VIP
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tableau */}
      <Card className="border-border shadow-sm">
        <CardContent className="p-0">
          <DataTable
            columns={columns}
            data={filtered}
            loading={loading}
            keyExtractor={(c) => c.id}
            onRowClick={(c) => router.push(`/customers/${c.id}`)}
            emptyMessage={emptyMessage}
          />
        </CardContent>
      </Card>
    </div>
  );
}
