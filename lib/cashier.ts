import type { LucideIcon } from 'lucide-react';
import { Banknote, CreditCard, Smartphone } from 'lucide-react';

export type CashierInvoice = {
  id: string;
  reference?: string | null;
  status?: string | null;
  totalXaf?: number | string | null;
  amountPaidXaf?: number | string | null;
  balanceXaf?: number | string | null;
  dueDate?: string | null;
  createdAt?: string | null;
  customer?: {
    firstName?: string | null;
    lastName?: string | null;
    companyName?: string | null;
    customerType?: string | null;
    phonePrimary?: string | null;
  } | null;
  serviceOrder?: { reference?: string | null } | null;
  payments?: CashierPayment[] | null;
};

export type CashierPayment = {
  id: string;
  amountXaf?: number | string | null;
  method?: string | null;
  paidAt?: string | null;
  transactionRef?: string | null;
  status?: string | null;
};

export const CASHIER_PAYMENT_METHODS: Array<{ value: string; label: string; icon: LucideIcon }> = [
  { value: 'CASH', label: 'Espèces', icon: Banknote },
  { value: 'ORANGE_MONEY', label: 'Orange Money', icon: Smartphone },
  { value: 'MTN_MOBILE_MONEY', label: 'MTN MoMo', icon: Smartphone },
  { value: 'BANK_TRANSFER', label: 'Virement', icon: CreditCard },
  { value: 'CHECK', label: 'Chèque', icon: CreditCard },
];

export const CASHIER_PAYMENT_METHOD_LABELS: Record<string, string> = Object.fromEntries(
  CASHIER_PAYMENT_METHODS.map((m) => [m.value, m.label]),
);

export function customerDisplayName(c: CashierInvoice['customer']): string {
  if (!c) return 'Client';
  if (c.customerType === 'COMPANY' && c.companyName) return c.companyName;
  return [c.firstName, c.lastName].filter(Boolean).join(' ') || 'Client';
}

export function invoiceBalance(inv: Pick<CashierInvoice, 'balanceXaf' | 'totalXaf' | 'amountPaidXaf'>): number {
  if (inv.balanceXaf != null && inv.balanceXaf !== '') {
    return Math.max(0, Number(inv.balanceXaf));
  }
  return Math.max(0, Number(inv.totalXaf || 0) - Number(inv.amountPaidXaf || 0));
}

export function isInvoiceCollectible(inv: CashierInvoice): boolean {
  return ['ISSUED', 'PARTIAL'].includes(inv.status ?? '') && invoiceBalance(inv) > 0;
}

export function isInvoiceOverdue(inv: CashierInvoice): boolean {
  if (!inv.dueDate || !isInvoiceCollectible(inv)) return false;
  return new Date(inv.dueDate).getTime() < Date.now();
}

export function phoneHref(raw?: string | null): string {
  if (!raw) return '';
  const normalized = raw.replace(/[^\d+]/g, '');
  return normalized ? `tel:${normalized}` : '';
}

export function paymentsTodayTotal(invoices: CashierInvoice[], dayIso = new Date().toISOString().split('T')[0]): number {
  return invoices.reduce((sum, inv) => {
    const payments = Array.isArray(inv.payments) ? inv.payments : [];
    const todayPaid = payments
      .filter((p) => p.status === 'CONFIRMED' && p.paidAt && new Date(p.paidAt).toISOString().split('T')[0] === dayIso)
      .reduce((acc, p) => acc + Number(p.amountXaf || 0), 0);
    return sum + todayPaid;
  }, 0);
}

export function flattenConfirmedPayments(invoices: CashierInvoice[]) {
  return invoices
    .flatMap((inv) =>
      (inv.payments ?? [])
        .filter((p) => p.status === 'CONFIRMED')
        .map((p) => ({ payment: p, invoice: inv })),
    )
    .sort((a, b) => new Date(b.payment.paidAt ?? 0).getTime() - new Date(a.payment.paidAt ?? 0).getTime());
}
