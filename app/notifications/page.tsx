'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import {
  Bell, Smartphone, Mail, CheckCircle2, AlertCircle, Search, Filter, Send,
  RefreshCw
} from "lucide-react";
import { cn } from "@/lib/utils";
import { notificationsApi } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";

interface SmsNotification {
  id: string;
  phone: string;
  message: string;
  status: string;
  sentAt: string;
  serviceOrder?: { reference: string };
}

export default function NotificationsPage() {
  const [search, setSearch] = useState('');
  const [notifications, setNotifications] = useState<SmsNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchNotifs = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const data = await notificationsApi.smsHistory(
        search ? { phone: search } : undefined
      ) as SmsNotification[];
      setNotifications(data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const t = setTimeout(fetchNotifs, 300);
    return () => clearTimeout(t);
  }, [fetchNotifs]);

  const sentCount = notifications.filter(n => n.status === 'SENT' || n.status === 'DELIVERED').length;
  const deliveredCount = notifications.filter(n => n.status === 'DELIVERED').length;
  const rate = notifications.length
    ? ((deliveredCount / notifications.length) * 100).toFixed(1)
    : '—';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Centre de Notifications</h1>
          <p className="text-muted-foreground">Suivi des communications clients par SMS</p>
        </div>
        <Button className="bg-brand hover:bg-brand-hover gap-2">
          <Send size={18} />
          Nouvelle Diffusion
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-none shadow-sm">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/30 text-blue-600 flex items-center justify-center">
              <Smartphone size={24} />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">SMS dans l&apos;historique</p>
              <p className="text-2xl font-bold text-foreground">
                {loading ? <Skeleton className="h-7 w-12 inline-block" /> : notifications.length}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-green-50 dark:bg-green-950/30 text-green-600 flex items-center justify-center">
              <CheckCircle2 size={24} />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Envoyés / Délivrés</p>
              <p className="text-2xl font-bold text-foreground">
                {loading ? <Skeleton className="h-7 w-12 inline-block" /> : `${sentCount} / ${deliveredCount}`}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-purple-50 dark:bg-purple-950/30 text-purple-600 flex items-center justify-center">
              <Bell size={24} />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Taux de Délivrance</p>
              <p className="text-2xl font-bold text-foreground">
                {loading ? <Skeleton className="h-7 w-12 inline-block" /> : `${rate}%`}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card className="border-none shadow-sm">
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="relative w-full md:w-96">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
              <Input
                placeholder="Rechercher un numéro..."
                className="pl-10"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <Button variant="outline" size="sm" onClick={fetchNotifs} className="gap-2 shrink-0">
              <RefreshCw size={14} /> Actualiser
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {error ? (
            <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground">
              <AlertCircle className="text-red-500" size={32} />
              <p className="text-sm">Impossible de charger les notifications.</p>
              <Button variant="outline" size="sm" onClick={fetchNotifs} className="gap-2">
                <RefreshCw size={14} /> Réessayer
              </Button>
            </div>
          ) : (
            <div className="rounded-xl border border-border overflow-hidden">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead className="font-bold">Type</TableHead>
                    <TableHead className="font-bold">Destinataire</TableHead>
                    <TableHead className="font-bold">Message</TableHead>
                    <TableHead className="font-bold">OT lié</TableHead>
                    <TableHead className="font-bold">Statut</TableHead>
                    <TableHead className="text-right font-bold">Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>
                        {Array.from({ length: 6 }).map((__, j) => (
                          <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : notifications.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                        Aucune notification trouvée.
                      </TableCell>
                    </TableRow>
                  ) : (
                    notifications.map(notif => (
                      <TableRow key={notif.id} className="hover:bg-muted/30 transition-colors">
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Smartphone size={16} className="text-orange-500" />
                            <span className="text-xs font-bold">SMS</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm font-medium text-foreground font-mono">
                          {notif.phone}
                        </TableCell>
                        <TableCell className="max-w-[300px]">
                          <p className="text-[11px] text-muted-foreground truncate">{notif.message}</p>
                        </TableCell>
                        <TableCell>
                          {notif.serviceOrder ? (
                            <span className="text-xs font-mono text-brand">{notif.serviceOrder.reference}</span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge className={cn(
                            "text-[10px] px-1.5 py-0 border-none",
                            notif.status === 'DELIVERED' ? "bg-green-50 text-green-700 dark:bg-green-950/30" :
                              notif.status === 'SENT' ? "bg-blue-50 text-blue-700 dark:bg-blue-950/30" :
                                "bg-red-50 text-red-700 dark:bg-red-950/30"
                          )}>
                            {notif.status === 'DELIVERED' ? 'Délivré' :
                              notif.status === 'SENT' ? 'Envoyé' : 'Échec'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right text-xs text-muted-foreground">
                          {new Date(notif.sentAt).toLocaleString('fr-FR')}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
