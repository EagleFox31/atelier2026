'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ReceivablesList } from '@/components/cashier/ReceivablesList';
import { billingApi } from '@/lib/api';
import type { CashierInvoice } from '@/lib/cashier';

export default function CashierReceivablesPage() {
  const router = useRouter();
  const [invoices, setInvoices] = useState<CashierInvoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (billingApi.listInvoices() as Promise<CashierInvoice[]>)
      .then((d) => setInvoices(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">Impayés & relances</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Factures ouvertes à relancer ou encaisser.
        </p>
      </div>
      <ReceivablesList
        invoices={invoices}
        loading={loading}
        onOpenInvoice={(id) => router.push(`/cashier/collect?invoiceId=${id}`)}
      />
    </div>
  );
}
