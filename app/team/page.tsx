'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Users, Wrench, CheckCircle2, UserPlus, Activity, TrendingUp,
  Search, RefreshCw, AlertCircle, Eye, EyeOff, KeyRound, Copy, Check,
  PowerOff, Power,
} from "lucide-react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger
} from "@/components/ui/dialog";
import { TeamMemberForm } from "@/components/forms/TeamMemberForm";
import { teamApi } from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";
import { countTeamMembersOnlineNow } from "@/lib/team-presence";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

interface TeamMember {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  specialty?: string;
  employeeCode: string;
  status: string;
  tempPassword?: string | null;
  passwordResetRequestedAt?: string | null;
  lastLoginAt?: string | null;
  roles: { role: { label: string; code: string } }[];
  assignedOTs?: { id: string; reference: string; status: string }[];
}

function StatusToggle({ member, onToggle }: { member: TeamMember; onToggle: () => void }) {
  const [loading, setLoading] = useState(false);
  const isActive = member.status === 'ACTIVE';

  async function handleToggle() {
    setLoading(true);
    try {
      await teamApi.toggleStatus(member.id);
      toast.success(isActive
        ? `${member.firstName} ${member.lastName} suspendu`
        : `${member.firstName} ${member.lastName} réactivé`
      );
      onToggle();
    } catch {
      toast.error("Erreur lors du changement de statut");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleToggle}
      disabled={loading}
      title={isActive ? 'Suspendre le compte' : 'Réactiver le compte'}
      className={cn(
        "mt-1.5 w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border",
        isActive
          ? "text-red-500 border-red-100 bg-red-50 hover:bg-red-100"
          : "text-green-600 border-green-100 bg-green-50 hover:bg-green-100"
      )}
    >
      {isActive ? <PowerOff size={12} /> : <Power size={12} />}
      {loading ? 'En cours...' : isActive ? 'Suspendre le compte' : 'Réactiver le compte'}
    </button>
  );
}

function PasswordCell({ member, onReset }: { member: TeamMember; onReset: () => void }) {
  const [show, setShow] = useState(false);
  const [copied, setCopied] = useState(false);
  const [resetting, setResetting] = useState(false);

  async function handleReset() {
    setResetting(true);
    try {
      const result = await teamApi.resetPassword(member.id) as any;
      toast.success(`Nouveau mot de passe : ${result.tempPassword}`, { duration: 10000 });
      onReset();
    } catch {
      toast.error("Erreur lors du reset");
    } finally {
      setResetting(false);
    }
  }

  function copy() {
    if (!member.tempPassword) return;
    navigator.clipboard.writeText(member.tempPassword);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex items-center gap-1.5 mt-2 p-2 bg-slate-50 rounded-lg border border-slate-100">
      <span className="font-mono text-[11px] text-slate-600 flex-1 truncate">
        {show ? (member.tempPassword ?? '—') : '••••••••'}
      </span>
      <button onClick={() => setShow(v => !v)} className="text-slate-400 hover:text-slate-600 flex-shrink-0">
        {show ? <EyeOff size={12} /> : <Eye size={12} />}
      </button>
      {member.tempPassword && (
        <button onClick={copy} className="text-slate-400 hover:text-brand flex-shrink-0">
          {copied ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
        </button>
      )}
      <button onClick={handleReset} disabled={resetting}
        className="text-slate-400 hover:text-amber-500 flex-shrink-0" title="Générer nouveau mot de passe">
        <KeyRound size={12} />
      </button>
    </div>
  );
}

export default function TeamPage() {
  const { user } = useAuth();
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

  const onlineNowCount = countTeamMembersOnlineNow(members, user?.id);
  const busyCount = members.filter(
    (m) =>
      m.status === 'ACTIVE' &&
      m.assignedOTs?.some((o) => ['IN_PROGRESS', 'DIAGNOSING', 'REPAIRING'].includes(o.status)),
  ).length;
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
                {loading ? '—' : `${onlineNowCount} / ${totalCount}`}
              </p>
              {!loading && busyCount > 0 && (
                <p className="text-[11px] text-blue-600/80">
                  {busyCount} en intervention sur un OT
                </p>
              )}
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
              const activeOTs = member.assignedOTs?.filter(o =>
                ['IN_PROGRESS', 'DIAGNOSING', 'REPAIRING'].includes(o.status)
              ) ?? [];
              const isBusy = activeOTs.length > 0;

              const needsReset = !!member.passwordResetRequestedAt;

              return (
                <motion.div
                  key={member.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Card className={cn(
                    "border-none shadow-sm hover:ring-1 transition-all",
                    needsReset ? "ring-2 ring-red-300 hover:ring-red-400" : "hover:ring-brand/20"
                  )}>
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold border-2",
                            needsReset ? "bg-red-50 text-red-600 border-red-200" : "bg-brand/10 text-brand border-brand/20"
                          )}>
                            {initials}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-bold text-foreground">{member.firstName} {member.lastName}</h3>
                              {needsReset && (
                                <span className="text-[10px] bg-red-100 text-red-600 font-semibold px-1.5 py-0.5 rounded-full animate-pulse">
                                  Reset demandé
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">{role}{member.specialty ? ` · ${member.specialty}` : ''}</p>
                            <p className="text-[10px] font-mono text-muted-foreground">{member.employeeCode}</p>
                          </div>
                        </div>
                        <Badge className={cn(
                          "text-[10px] font-bold px-2 py-0.5 rounded-full border-none",
                          member.status === 'ACTIVE'
                            ? isBusy ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"
                            : "bg-muted text-muted-foreground"
                        )}>
                          {member.status !== 'ACTIVE' ? 'Suspendu' : isBusy ? 'En cours' : 'Disponible'}
                        </Badge>
                      </div>

                      {/* Mot de passe + actions */}
                      <PasswordCell member={member} onReset={fetchTeam} />
                      <StatusToggle member={member} onToggle={fetchTeam} />

                      {activeOTs.length > 0 && (
                        <div className="mt-2 p-2.5 bg-muted rounded-lg flex items-center gap-2">
                          <Wrench size={13} className="text-brand" />
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
