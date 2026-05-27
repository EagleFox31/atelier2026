'use client';

import { useEffect, useMemo, useState } from 'react';
import { PaymentHistoryTable } from '@/components/cashier/PaymentHistoryTable';
import { billingApi } from '@/lib/api';
import { formatXAF } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { flattenConfirmedPayments, paymentsTodayTotal, type CashierInvoice } from '@/lib/cashier';

export default function CashierHistoryPage() {
  const [invoices, setInvoices] = useState<CashierInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    (billingApi.listInvoices() as Promise<CashierInvoice[]>)
      .then((d) => setInvoices(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const todayCount = useMemo(() => {
    return flattenConfirmedPayments(invoices).filter(
      ({ payment }) => payment.paidAt && new Date(payment.paidAt).toISOString().split('T')[0] === today,
    ).length;
  }, [invoices, today]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">Historique caisse</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Paiements confirmés enregistrés dans l&apos;atelier.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 max-w-lg">
        <Card className="border-border ring-1 ring-border/50">
          <CardContent className="p-4">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Encaissé aujourd&apos;hui</p>
            <p className="text-xl font-bold font-mono mt-1">{formatXAF(paymentsTodayTotal(invoices, today))}</p>
          </CardContent>
        </Card>
        <Card className="border-border ring-1 ring-border/50">
          <CardContent className="p-4">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Opérations du jour</p>
            <p className="text-xl font-bold mt-1">{loading ? '…' : todayCount}</p>
          </CardContent>
        </Card>
      </div>

      <PaymentHistoryTable invoices={invoices} loading={loading} />
    </div>
  );
}
