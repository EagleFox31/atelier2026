'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Users, Wrench, CheckCircle2, UserPlus, Activity, History, TrendingUp,
  Search, RefreshCw, AlertCircle, Clock
} from "lucide-react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger
} from "@/components/ui/dialog";
import { TeamMemberForm } from "@/components/forms/TeamMemberForm";
import { teamApi } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";

interface TeamMember {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  employeeCode: string;
  status: string;
  roles: { role: { label: string; code: string } }[];
  serviceOrdersAsChef?: { id: string; reference: string; status: string }[];
}

export default function TeamPage() {
  const [isTeamModalOpen, setIsTeamModalOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchTeam = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const data = await teamApi.list({ search: search || undefined }) as TeamMember[];
      setMembers(data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const t = setTimeout(fetchTeam, 300);
    return () => clearTimeout(t);
  }, [fetchTeam]);

  const busyCount = members.filter(m => m.status === 'ACTIVE' && (m.serviceOrdersAsChef?.some(o => ['IN_PROGRESS', 'DIAGNOSING', 'REPAIRING'].includes(o.status)))).length;
  const totalCount = members.length;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Gestion de l&apos;Équipe</h1>
          <p className="text-muted-foreground">Suivez l&apos;activité et la performance de vos techniciens</p>
        </div>
        <div className="flex gap-3">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
            <Input
              placeholder="Rechercher..."
              className="pl-9 h-9"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <Dialog open={isTeamModalOpen} onOpenChange={open => { setIsTeamModalOpen(open); if (!open) fetchTeam(); }}>
            <DialogTrigger render={
              <Button className="bg-brand hover:bg-brand-hover gap-2">
                <UserPlus size={18} />
                Ajouter un membre
              </Button>
            } />
            <DialogContent className="sm:max-w-[600px]">
              <DialogHeader>
                <DialogTitle>Ajouter un nouveau membre à l&apos;équipe</DialogTitle>
              </DialogHeader>
              <TeamMemberForm onSuccess={() => setIsTeamModalOpen(false)} />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-none shadow-sm bg-blue-50/50 dark:bg-blue-950/20">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/40 text-blue-600 flex items-center justify-center">
              <Activity size={24} />
            </div>
            <div>
              <p className="text-sm font-medium text-blue-600">Actifs maintenant</p>
              <p className="text-2xl font-bold text-foreground">
                {loading ? '—' : `${busyCount} / ${totalCount}`}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-green-50/50 dark:bg-green-950/20">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-green-100 dark:bg-green-900/40 text-green-600 flex items-center justify-center">
              <CheckCircle2 size={24} />
            </div>
            <div>
              <p className="text-sm font-medium text-green-600">Membres actifs</p>
              <p className="text-2xl font-bold text-foreground">
                {loading ? '—' : members.filter(m => m.status === 'ACTIVE').length}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-purple-50/50 dark:bg-purple-950/20">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-purple-100 dark:bg-purple-900/40 text-purple-600 flex items-center justify-center">
              <TrendingUp size={24} />
            </div>
            <div>
              <p className="text-sm font-medium text-purple-600">Total équipe</p>
              <p className="text-2xl font-bold text-foreground">{loading ? '—' : totalCount}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Members Grid */}
      <div>
        <h2 className="text-lg font-bold text-foreground flex items-center gap-2 mb-4">
          <Users size={20} className="text-brand" />
          Membres de l&apos;équipe
        </h2>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} className="border-none shadow-sm">
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-center gap-3">
                    <Skeleton className="w-12 h-12 rounded-full" />
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
            <AlertCircle className="text-red-500" size={32} />
            <p className="text-sm">Impossible de charger l&apos;équipe.</p>
            <Button variant="outline" size="sm" onClick={fetchTeam} className="gap-2">
              <RefreshCw size={14} /> Réessayer
            </Button>
          </div>
        ) : members.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
            <Users size={32} />
            <p className="text-sm">Aucun membre trouvé.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {members.map((member, index) => {
              const initials = `${member.firstName?.[0] ?? ''}${member.lastName?.[0] ?? ''}`;
              const rawRole = member.roles?.[0]?.role?.label ?? '—';
              const role = rawRole === 'Réceptionniste' ? 'Réceptionnaire' : rawRole;
              const activeOTs = member.serviceOrdersAsChef?.filter(o =>
                ['IN_PROGRESS', 'DIAGNOSING', 'REPAIRING'].includes(o.status)
              ) ?? [];
              const isBusy = activeOTs.length > 0;

              return (
                <motion.div
                  key={member.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Card className="border-none shadow-sm hover:ring-1 hover:ring-brand/20 transition-all cursor-pointer group">
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-full bg-brand/10 flex items-center justify-center text-sm font-bold text-brand border-2 border-brand/20">
                            {initials}
                          </div>
                          <div>
                            <h3 className="font-bold text-foreground">{member.firstName} {member.lastName}</h3>
                            <p className="text-xs text-muted-foreground">{role}</p>
                            <p className="text-[10px] font-mono text-muted-foreground">{member.employeeCode}</p>
                          </div>
                        </div>
                        <Badge className={cn(
                          "text-[10px] font-bold px-2 py-0.5 rounded-full border-none",
                          member.status === 'ACTIVE'
                            ? isBusy ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40" : "bg-green-100 text-green-700 dark:bg-green-900/40"
                            : "bg-muted text-muted-foreground"
                        )}>
                          {member.status !== 'ACTIVE' ? 'Suspendu' : isBusy ? 'En cours' : 'Disponible'}
                        </Badge>
                      </div>

                      {activeOTs.length > 0 && (
                        <div className="mt-4 p-3 bg-muted rounded-lg flex items-center gap-2">
                          <Wrench size={14} className="text-brand" />
                          <span className="text-xs font-medium text-foreground truncate">
                            {activeOTs[0].reference}
                          </span>
                          {activeOTs.length > 1 && (
                            <Badge variant="secondary" className="ml-auto text-[9px]">+{activeOTs.length - 1}</Badge>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
