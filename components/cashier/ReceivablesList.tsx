'use client';

import { useMemo, useState } from 'react';
import { Phone, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { formatXAF } from '@/lib/utils';
import {
  customerDisplayName,
  invoiceBalance,
  isInvoiceCollectible,
  isInvoiceOverdue,
  phoneHref,
  type CashierInvoice,
} from '@/lib/cashier';

interface ReceivablesListProps {
  invoices: CashierInvoice[];
  loading: boolean;
  onOpenInvoice: (invoiceId: string) => void;
}

export function ReceivablesList({ invoices, loading, onOpenInvoice }: ReceivablesListProps) {
  const [search, setSearch] = useState('');
  const [onlyOverdue, setOnlyOverdue] = useState(false);

  const pending = useMemo(() => {
    const base = invoices
      .filter(isInvoiceCollectible)
      .sort((a, b) => {
        const aDue = a.dueDate ? new Date(a.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
        const bDue = b.dueDate ? new Date(b.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
        return aDue - bDue;
      });

    const q = search.trim().toLowerCase();
    return base.filter((inv) => {
      if (onlyOverdue && !isInvoiceOverdue(inv)) return false;
      if (!q) return true;
      const name = customerDisplayName(inv.customer).toLowerCase();
      return inv.reference?.toLowerCase().includes(q) || name.includes(q);
    });
  }, [invoices, search, onlyOverdue]);

  const overdueCount = useMemo(
    () => invoices.filter((inv) => isInvoiceOverdue(inv)).length,
    [invoices],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher client ou facture…"
            className="pl-9 h-11 rounded-xl"
          />
        </div>
        <Button
          type="button"
          variant={onlyOverdue ? 'default' : 'outline'}
          className={onlyOverdue ? 'bg-brand hover:bg-brand-hover' : 'rounded-xl'}
          onClick={() => setOnlyOverdue((v) => !v)}
        >
          En retard ({overdueCount})
        </Button>
      </div>

      <div className="space-y-3">
        {loading
          ? Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)
          : pending.length === 0
            ? <p className="text-sm text-muted-foreground text-center py-12">Aucun impayé pour ce filtre</p>
            : pending.map((inv) => {
              const href = phoneHref(inv.customer?.phonePrimary);
              const overdue = isInvoiceOverdue(inv);
              return (
                <div
                  key={inv.id}
                  className="p-4 rounded-xl border border-border bg-card space-y-3 ring-1 ring-border/40"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs text-muted-foreground">{inv.reference}</span>
                    <div className="flex gap-1.5">
                      {overdue && (
                        <Badge className="text-[9px] border-none bg-red-500/20 text-red-700">En retard</Badge>
                      )}
                      <Badge className="text-[9px] border-none bg-amber-500/20 text-amber-700">
                        {inv.status === 'PARTIAL' ? 'Paiement partiel' : 'À encaisser'}
                      </Badge>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-foreground">{customerDisplayName(inv.customer)}</p>
                    {inv.dueDate && (
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Échéance {new Date(inv.dueDate).toLocaleDateString('fr-FR')}
                      </p>
                    )}
                  </div>
                  <p className="text-sm font-mono font-bold text-amber-600">
                    Reste {formatXAF(invoiceBalance(inv))}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 rounded-xl text-xs"
                      onClick={() => onOpenInvoice(inv.id)}
                    >
                      Encaisser
                    </Button>
                    {href && (
                      <a href={href} className="flex-1">
                        <Button size="sm" className="w-full rounded-xl text-xs bg-brand hover:bg-brand-hover gap-1.5">
                          <Phone size={13} /> Appeler
                        </Button>
                      </a>
                    )}
                  </div>
                </div>
              );
            })
        }
      </div>
    </div>
  );
}
