'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { User, Mail, Phone, MapPin, History, ArrowLeft, Car, FileText, Plus, MessageSquare, CreditCard, Building2, Pencil } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { VehicleForm } from "@/components/forms/VehicleForm";
import { CustomerForm, CUSTOMER_FORM_DIALOG_CLASS } from "@/components/forms/CustomerForm";
import { customersApi } from "@/lib/api";
import { useApi } from "@/hooks/use-api";
import { useAuth } from "@/contexts/auth-context";
import { WORKSHOP_STATUS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

function customerName(c: any): string {
  if (c.customerType === 'COMPANY') return c.companyName || '—';
  return [c.firstName, c.lastName].filter(Boolean).join(' ') || '—';
}

function vehicleName(v: any): string {
  if (!v) return '—';
  return [v.make?.name, v.model?.name].filter(Boolean).join(' ') || 'Véhicule';
}

export default function CustomerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [isVehicleModalOpen, setIsVehicleModalOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const { hasRole } = useAuth();
  const canEdit = hasRole('ADMIN') || hasRole('CHEF_ATELIER') || hasRole('RECEPTIONNISTE');

  const { data: customer, loading, refetch } = useApi(
    () => customersApi.get(id) as Promise<any>,
    [id]
  );

  if (loading) return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Skeleton className="w-10 h-10 rounded-full" />
        <div className="space-y-2"><Skeleton className="h-6 w-48" /><Skeleton className="h-4 w-32" /></div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Skeleton className="h-64 rounded-xl" />
        <div className="lg:col-span-2 space-y-6">
          <Skeleton className="h-48 rounded-xl" />
          <Skeleton className="h-48 rounded-xl" />
        </div>
      </div>
    </div>
  );

  if (!customer) return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <User size={48} className="text-muted-foreground" strokeWidth={1} />
      <p className="text-muted-foreground">Client introuvable</p>
      <Button variant="outline" onClick={() => router.back()}>Retour</Button>
    </div>
  );

  const vehicles: any[] = customer.vehicles || [];
  const orders: any[] = customer.serviceOrders || [];
  const name = customerName(customer);
  const initials = name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-4 min-w-0">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="shrink-0">
            <ArrowLeft size={20} />
          </Button>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-foreground truncate">{name}</h1>
            <p className="text-muted-foreground text-sm">
              Client depuis le {new Date(customer.createdAt).toLocaleDateString('fr-FR')}
            </p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 w-full sm:w-auto">
          <Button variant="outline" className="gap-2 border-border w-full sm:w-auto" onClick={() => toast.info(`SMS à ${customer.phonePrimary}`)}>
            <MessageSquare size={18} />
            Contacter
          </Button>

          {/* Modifier le client — visible ADMIN / CHEF_ATELIER / RECEPTIONNISTE */}
          {canEdit && <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
            <DialogTrigger render={
              <Button variant="outline" className="gap-2 border-border w-full sm:w-auto">
                <Pencil size={18} />
                Modifier
              </Button>
            } />
            <DialogContent className={CUSTOMER_FORM_DIALOG_CLASS}>
              <DialogHeader className="px-4 pt-4 sm:px-0 sm:pt-0 shrink-0">
                <DialogTitle>Modifier le client</DialogTitle>
              </DialogHeader>
              <div className="px-4 pb-4 sm:px-0 sm:pb-0 min-h-0 flex-1 overflow-hidden flex flex-col max-sm:max-h-[calc(92dvh-5.5rem)]">
                <CustomerForm
                  customerId={id}
                  initialData={{
                    customerType: customer.customerType,
                    firstName:    customer.firstName,
                    lastName:     customer.lastName,
                    companyName:  customer.companyName,
                    email:        customer.email ?? '',
                    phonePrimary: customer.phonePrimary,
                    address:      customer.address,
                    city:         customer.city,
                    isVip:        customer.isVip ?? false,
                  }}
                  onSuccess={() => { setIsEditOpen(false); refetch(); }}
                />
              </div>
            </DialogContent>
          </Dialog>}

          <Dialog open={isVehicleModalOpen} onOpenChange={setIsVehicleModalOpen}>
            <DialogTrigger render={
              <Button className="bg-brand hover:bg-brand-hover gap-2 w-full sm:w-auto">
                <Plus size={18} />
                Nouveau Véhicule
              </Button>
            } />
            <DialogContent className="sm:max-w-[500px] bg-card border-border">
              <DialogHeader>
                <DialogTitle>Ajouter un véhicule pour {name}</DialogTitle>
              </DialogHeader>
              <VehicleForm customerId={id} onSuccess={() => { setIsVehicleModalOpen(false); refetch(); }} />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profil */}
        <Card className="border-border shadow-sm">
          <CardHeader className="flex flex-col items-center pb-2">
            <div className="w-24 h-24 rounded-full bg-brand/10 text-brand flex items-center justify-center text-3xl font-bold mb-4">
              {customer.customerType === 'COMPANY' ? <Building2 size={40} /> : initials}
            </div>
            <h2 className="text-xl font-bold text-foreground text-center">{name}</h2>
            <div className="flex items-center gap-1 mt-1">
              <Badge variant="secondary" className="border-none">
                {customer.customerType === 'COMPANY' ? 'Entreprise' : 'Particulier'}
              </Badge>
              {customer.isVip && <Badge className="bg-amber-500/10 text-amber-600 border-none">VIP</Badge>}
            </div>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            {customer.email && (
              <div className="flex items-center gap-3 text-muted-foreground">
                <Mail size={18} className="shrink-0" />
                <span className="text-sm truncate">{customer.email}</span>
              </div>
            )}
            <div className="flex items-center gap-3 text-muted-foreground">
              <Phone size={18} className="shrink-0" />
              <span className="text-sm font-mono">{customer.phonePrimary}</span>
            </div>
            {customer.address && (
              <div className="flex items-center gap-3 text-muted-foreground">
                <MapPin size={18} className="shrink-0" />
                <span className="text-sm">{customer.address}, {customer.city}</span>
              </div>
            )}
            <div className="pt-4 border-t border-border">
              <Button variant="outline" className="w-full gap-2 border-border" onClick={() => router.push('/billing')}>
                <CreditCard size={18} />
                Voir les factures
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="lg:col-span-2 space-y-6">
          {/* Véhicules */}
          <Card className="border-border shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <Car size={20} className="text-brand" />
                Véhicules ({vehicles.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {vehicles.length === 0
                ? <p className="text-sm text-muted-foreground text-center py-6">Aucun véhicule enregistré</p>
                : <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {vehicles.map(v => (
                    <div
                      key={v.id}
                      className="p-4 rounded-xl border border-border hover:bg-muted/50 cursor-pointer"
                      onClick={() => router.push(`/vehicles/${v.id}`)}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <Badge variant="outline" className="font-mono border-border">{v.plateNumber}</Badge>
                        <Car size={18} className="text-muted-foreground" />
                      </div>
                      <p className="font-bold text-foreground">{vehicleName(v)}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {v.year && `Année ${v.year}`}
                        {v.currentMileage && ` · ${v.currentMileage.toLocaleString()} km`}
                      </p>
                    </div>
                  ))}
                </div>
              }
            </CardContent>
          </Card>

          {/* Historique OT */}
          <Card className="border-border shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <History size={20} className="text-brand" />
                Historique des interventions ({orders.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {orders.length === 0
                ? <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
                  <FileText size={36} strokeWidth={1} />
                  <p className="text-sm">Aucune intervention enregistrée</p>
                </div>
                : <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="font-bold">Référence</TableHead>
                      <TableHead className="font-bold">Véhicule</TableHead>
                      <TableHead className="font-bold">Plainte</TableHead>
                      <TableHead className="font-bold">Statut</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.map(o => {
                      const st = WORKSHOP_STATUS[o.status] ?? { label: o.status, color: '', dot: '' };
                      return (
                        <TableRow
                          key={o.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => router.push(`/workshop/${o.id}`)}
                        >
                          <TableCell className="font-mono text-xs">{o.reference}</TableCell>
                          <TableCell className="text-sm">{vehicleName(o.vehicle)}</TableCell>
                          <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                            {o.clientComplaint}
                          </TableCell>
                          <TableCell>
                            <Badge className={cn("text-[10px] px-1.5 border-none", st.color)}>
                              {st.label}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              }
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
