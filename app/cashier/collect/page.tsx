'use client';

import { useSearchParams } from 'next/navigation';
import { CollectPaymentPanel } from '@/components/cashier/CollectPaymentPanel';

export default function CashierCollectPage() {
  const searchParams = useSearchParams();
  const invoiceId = searchParams.get('invoiceId');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">Encaisser</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Sélectionnez une facture et enregistrez le paiement client.
        </p>
      </div>
      <CollectPaymentPanel preselectedInvoiceId={invoiceId} />
    </div>
  );
}
