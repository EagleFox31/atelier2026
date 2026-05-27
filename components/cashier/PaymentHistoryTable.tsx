'use client';

import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { formatXAF } from '@/lib/utils';
import {
  CASHIER_PAYMENT_METHOD_LABELS,
  customerDisplayName,
  flattenConfirmedPayments,
  type CashierInvoice,
} from '@/lib/cashier';

interface PaymentHistoryTableProps {
  invoices: CashierInvoice[];
  loading: boolean;
}

export function PaymentHistoryTable({ invoices, loading }: PaymentHistoryTableProps) {
  const [search, setSearch] = useState('');

  const rows = useMemo(() => {
    const all = flattenConfirmedPayments(invoices);
    const q = search.trim().toLowerCase();
    if (!q) return all.slice(0, 100);
    return all.filter(({ payment, invoice }) => {
      const name = customerDisplayName(invoice.customer).toLowerCase();
      return (
        invoice.reference?.toLowerCase().includes(q)
        || name.includes(q)
        || payment.transactionRef?.toLowerCase().includes(q)
      );
    }).slice(0, 100);
  }, [invoices, search]);

  return (
    <div className="space-y-4">
      <div className="relative max-w-md">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Facture, client, référence…"
          className="pl-9 h-11 rounded-xl"
        />
      </div>

      <div className="hidden md:block rounded-xl border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Facture</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Mode</TableHead>
              <TableHead className="text-right">Montant</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading
              ? Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={5}><Skeleton className="h-8" /></TableCell>
                </TableRow>
              ))
              : rows.length === 0
                ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-10">
                      Aucun paiement trouvé
                    </TableCell>
                  </TableRow>
                )
                : rows.map(({ payment, invoice }) => (
                  <TableRow key={payment.id}>
                    <TableCell className="text-xs">
                      {payment.paidAt
                        ? new Date(payment.paidAt).toLocaleString('fr-FR', {
                          day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
                        })
                        : '—'}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{invoice.reference}</TableCell>
                    <TableCell className="text-sm">{customerDisplayName(invoice.customer)}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-[10px] border-none">
                        {CASHIER_PAYMENT_METHOD_LABELS[payment.method ?? ''] ?? payment.method}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono font-bold">{formatXAF(Number(payment.amountXaf || 0))}</TableCell>
                  </TableRow>
                ))
            }
          </TableBody>
        </Table>
      </div>

      <div className="md:hidden space-y-2">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)
          : rows.length === 0
            ? <p className="text-sm text-muted-foreground text-center py-10">Aucun paiement trouvé</p>
            : rows.map(({ payment, invoice }) => (
              <div key={payment.id} className="p-3 rounded-xl border border-border bg-card space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[10px] text-muted-foreground">{invoice.reference}</span>
                  <span className="font-mono text-sm font-bold text-brand">{formatXAF(Number(payment.amountXaf || 0))}</span>
                </div>
                <p className="text-sm font-medium">{customerDisplayName(invoice.customer)}</p>
                <p className="text-[11px] text-muted-foreground">
                  {CASHIER_PAYMENT_METHOD_LABELS[payment.method ?? ''] ?? payment.method}
                  {payment.paidAt && ` · ${new Date(payment.paidAt).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}`}
                </p>
              </div>
            ))
        }
      </div>
    </div>
  );
}
