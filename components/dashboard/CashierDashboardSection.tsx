'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { motion } from 'motion/react';
import { AlertCircle, BellRing, Phone, Receipt, TrendingUp, Wallet } from 'lucide-react';
import { cn } from '@/lib/utils';

type PaymentLike = {
  amountXaf?: number | string | null;
  paidAt?: string | null;
};

type CustomerLike = {
  firstName?: string | null;
  lastName?: string | null;
  phonePrimary?: string | null;
};

type InvoiceLike = {
  id: string;
  reference?: string | null;
  status?: string | null;
  totalXaf?: number | string | null;
  amountPaidXaf?: number | string | null;
  balanceXaf?: number | string | null;
  dueDate?: string | null;
  customer?: CustomerLike | null;
  payments?: PaymentLike[] | null;
};

interface CashierDashboardSectionProps {
  invoices: InvoiceLike[];
  loading: boolean;
  onOpenInvoice: (invoiceId: string) => void;
}

function formatXaf(value: number) {
  const rounded = Math.round(Number(value || 0));
  return `${String(rounded).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} XAF`;
}

function phoneHref(raw?: string | null) {
  if (!raw) return '';
  const normalized = raw.replace(/[^\d+]/g, '');
  return normalized ? `tel:${normalized}` : '';
}

export function CashierDashboardSection({ invoices, loading, onOpenInvoice }: CashierDashboardSectionProps) {
  const today = new Date().toISOString().split('T')[0];

  const pendingInvoices = invoices
    .filter((inv) => ['ISSUED', 'PARTIAL'].includes(inv.status ?? ''))
    .sort((a, b) => {
      const aDue = a.dueDate ? new Date(a.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
      const bDue = b.dueDate ? new Date(b.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
      return aDue - bDue;
    });

  const overdueInvoices = pendingInvoices
    .filter((inv) => inv.dueDate && new Date(inv.dueDate).getTime() < Date.now());

  const totalCollectedToday = invoices.reduce((sum, inv) => {
    const payments = Array.isArray(inv.payments) ? inv.payments : [];
    const todayPaid = payments
      .filter((p) => {
        if (!p?.paidAt) return false;
        const paidDay = new Date(p.paidAt).toISOString().split('T')[0];
        return paidDay === today;
      })
      .reduce((acc, p) => acc + Number(p.amountXaf || 0), 0);
    return sum + todayPaid;
  }, 0);

  const ticketCountToday = invoices.reduce((sum, inv) => {
    const payments = Array.isArray(inv.payments) ? inv.payments : [];
    const todayCount = payments.filter((p) => {
      if (!p?.paidAt) return false;
      const paidDay = new Date(p.paidAt).toISOString().split('T')[0];
      return paidDay === today;
    }).length;
    return sum + todayCount;
  }, 0);

  const averageTicket = ticketCountToday > 0
    ? Math.round(totalCollectedToday / ticketCountToday)
    : 0;

  const pendingAmount = pendingInvoices.reduce(
    (sum, inv) => sum + Math.max(0, Number(inv.balanceXaf ?? Number(inv.totalXaf || 0) - Number(inv.amountPaidXaf || 0))),
    0,
  );

  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)
          : [
              { title: "Encaissements aujourd'hui", value: formatXaf(totalCollectedToday), icon: Wallet, color: 'text-brand', bg: 'bg-brand/10' },
              { title: 'Factures à encaisser', value: String(pendingInvoices.length), icon: Receipt, color: 'text-amber-600', bg: 'bg-amber-500/10' },
              { title: 'Montant en attente', value: formatXaf(pendingAmount), icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-500/10' },
              { title: 'Ticket moyen', value: formatXaf(averageTicket), icon: TrendingUp, color: 'text-green-600', bg: 'bg-green-500/10' },
            ].map((stat, i) => {
              const Icon = stat.icon;
              return (
                <motion.div key={stat.title} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}>
                  <Card className="bg-card border-border shadow-sm hover:shadow-md transition-all ring-1 ring-border/50 h-full">
                    <CardContent className="p-4 md:p-6">
                      <div className="flex items-center justify-between">
                        <div className={cn(stat.bg, 'p-2 md:p-3 rounded-xl ring-1 ring-brand/10')}><Icon className={stat.color} size={18} /></div>
                      </div>
                      <div className="mt-3 md:mt-5">
                        <p className="text-muted-foreground text-[10px] md:text-xs font-medium leading-tight">{stat.title}</p>
                        <p className="text-xl md:text-3xl font-bold text-foreground mt-1">{stat.value}</p>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })
        }
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="bg-card border-border ring-1 ring-border/50 shadow-sm lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <div>
              <CardTitle className="text-lg font-bold">A encaisser maintenant</CardTitle>
              <CardDescription className="text-xs">Factures à encaisser (non soldées)</CardDescription>
            </div>
            <Badge className="bg-brand/10 text-brand border-none h-6 min-w-6 px-2 flex items-center justify-center rounded-full text-[10px] font-bold">
              {loading ? '…' : pendingInvoices.length}
            </Badge>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading
              ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)
              : pendingInvoices.length === 0
                ? <p className="text-sm text-muted-foreground text-center py-8">Aucune facture en attente d&apos;encaissement</p>
                : pendingInvoices.slice(0, 6).map((inv) => (
                  <div key={inv.id} className="p-3 rounded-xl border border-border bg-muted/40 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[10px] text-muted-foreground">{inv.reference}</span>
                      <Badge className={cn(
                        'text-[9px] border-none',
                        inv.status === 'PARTIAL' ? 'bg-amber-500/20 text-amber-700' : 'bg-violet-500/20 text-violet-700',
                      )}>
                        {inv.status === 'PARTIAL' ? 'Paiement partiel' : 'À encaisser'}
                      </Badge>
                    </div>
                    <p className="text-sm font-bold text-foreground truncate">
                      {inv.customer ? [inv.customer.firstName, inv.customer.lastName].filter(Boolean).join(' ') : 'Client'}
                    </p>
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>Total: {formatXaf(Number(inv.totalXaf || 0))}</span>
                      <span>Reste: {formatXaf(Number(inv.balanceXaf ?? (Number(inv.totalXaf || 0) - Number(inv.amountPaidXaf || 0))))}</span>
                    </div>
                    <Button size="sm" variant="outline" className="w-full text-xs border-border" onClick={() => onOpenInvoice(inv.id)}>
                      Ouvrir la facture
                    </Button>
                  </div>
                ))
            }
          </CardContent>
        </Card>

        <Card className="bg-card border-border ring-1 ring-border/50 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <div>
              <CardTitle className="text-lg font-bold">Relances impayés</CardTitle>
              <CardDescription className="text-xs">Factures dépassées</CardDescription>
            </div>
            <div className="w-6 h-6 rounded-full bg-red-500/10 flex items-center justify-center">
              <BellRing className="text-red-500" size={16} />
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading
              ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)
              : overdueInvoices.length === 0
                ? <p className="text-sm text-muted-foreground text-center py-6">Aucune relance urgente</p>
                : overdueInvoices.slice(0, 5).map((inv) => {
                  const href = phoneHref(inv.customer?.phonePrimary);
                  return (
                    <div key={inv.id} className="p-3 rounded-xl border border-red-200 bg-red-50/40 dark:bg-red-950/20 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-[10px] text-muted-foreground">{inv.reference}</span>
                        <Badge className="text-[9px] border-none bg-red-500/20 text-red-700">En retard</Badge>
                      </div>
                      <p className="text-sm font-bold text-foreground truncate">
                        {inv.customer ? [inv.customer.firstName, inv.customer.lastName].filter(Boolean).join(' ') : 'Client'}
                      </p>
                      <p className="text-[11px] text-muted-foreground">Reste: {formatXaf(Number(inv.balanceXaf ?? 0))}</p>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" className="flex-1 text-xs border-border" onClick={() => onOpenInvoice(inv.id)}>
                          Voir
                        </Button>
                        {href && (
                          <a href={href} className="flex-1">
                            <Button size="sm" className="w-full text-xs bg-brand hover:bg-brand-hover gap-1.5">
                              <Phone size={13} /> Appeler
                            </Button>
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })
            }
          </CardContent>
        </Card>
      </div>
    </>
  );
}
