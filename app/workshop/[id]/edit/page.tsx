'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, ArrowLeft } from 'lucide-react';
import { workshopApi } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';
import { OrderForm } from '@/components/forms/OrderForm';

function customerName(c: any) {
  if (!c) return '';
  return c.customerType === 'COMPANY'
    ? c.companyName ?? ''
    : [c.firstName, c.lastName].filter(Boolean).join(' ');
}

function vehicleLabel(v: any) {
  return [v?.make?.name, v?.model?.name].filter(Boolean).join(' ');
}

export default function EditOrderPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const { hasRole } = useAuth();

  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const canEdit = hasRole('ADMIN') || hasRole('RECEPTIONNISTE');

  useEffect(() => {
    workshopApi.getOT(id)
      .then((data: any) => {
        if (data.status !== 'DRAFT') {
          router.replace(`/workshop/${id}`);
          return;
        }
        setOrder(data);
      })
      .catch(() => setError('Impossible de charger cet ordre de travail.'))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!loading && !canEdit) {
      router.replace(`/workshop/${id}`);
    }
  }, [loading, canEdit]);

  if (loading) return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <Skeleton className="h-9 w-48 rounded-xl" />
      <Skeleton className="h-[400px] rounded-2xl" />
    </div>
  );

  if (error || !order) return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center">
        <AlertCircle size={28} className="text-red-400" strokeWidth={1.5} />
      </div>
      <p className="text-muted-foreground text-sm">{error ?? 'Ordre de travail introuvable'}</p>
      <Button variant="outline" className="rounded-xl" onClick={() => router.back()}>Retour</Button>
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="rounded-xl h-9 w-9 shrink-0"
          onClick={() => router.push(`/workshop/${id}`)}
        >
          <ArrowLeft size={18} />
        </Button>
        <div>
          <h1 className="text-xl font-bold text-foreground">
            Modifier l&apos;OT <span className="font-mono">{order.reference}</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">Seuls les OT en brouillon peuvent être modifiés</p>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card shadow-sm p-6">
        <OrderForm
          editId={id}
          initialCustomerId={order.customerId}
          initialCustomerLabel={customerName(order.customer)}
          initialCustomerPhone={order.customer?.phonePrimary}
          initialVehicleId={order.vehicleId}
          initialVehicleLabel={vehicleLabel(order.vehicle)}
          initialVehicleSub={order.vehicle?.plateNumber}
          initialClientComplaint={order.clientComplaint}
          initialPriority={order.priority}
          initialMileageIn={order.mileageIn ?? undefined}
        />
      </div>
    </div>
  );
}
