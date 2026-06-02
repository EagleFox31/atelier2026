'use client';

import React, { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/auth-context';
import { resolveGuideRole } from '@/lib/guide-roles';
import { GUIDE_PAGES } from '@/lib/guide-content';
import {
  Search, ChevronDown, ChevronRight, BookOpen,
  MessageCircle, CircleHelp, Lightbulb,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';

// ── FAQ globales ──────────────────────────────────────────────────────────────

const FAQ = [
  {
    q: 'Comment créer un ordre de travail ?',
    a: 'Depuis la page Ordres de Travail, cliquez « Nouvel OT » ou utilisez la Réception express depuis le tableau de bord. Renseignez le client, le véhicule et la plainte client.',
    roles: ['ADMIN', 'CHEF_ATELIER', 'RECEPTIONNISTE'],
  },
  {
    q: 'Comment encaisser un client ?',
    a: 'L\'OT doit être en statut Facturé. Allez dans Facturation → ouvrez la facture → cliquez « Enregistrer un paiement ». Choisissez le mode (Orange Money, MTN, espèces…) et saisissez la référence pour les paiements mobiles.',
    roles: ['ADMIN', 'CAISSIER'],
  },
  {
    q: 'Comment réinitialiser le mot de passe d\'un employé ?',
    a: 'Dans la page Équipe, survolez la carte de l\'employé puis cliquez l\'icône clé. Un nouveau mot de passe est généré automatiquement et affiché. Communiquez-le à l\'employé.',
    roles: ['ADMIN', 'CHEF_ATELIER'],
  },
  {
    q: 'Pourquoi mon OT est bloqué à « Devis en attente » ?',
    a: 'L\'OT attend l\'approbation du devis par le client. Allez dans l\'OT → onglet Devis → cliquez « Approuver ». Si le client a signé physiquement, choisissez « Signature physique ».',
    roles: ['ADMIN', 'CHEF_ATELIER'],
  },
  {
    q: 'Comment ajouter une pièce au stock ?',
    a: 'Page Stock & Pièces → « Ajouter une pièce » pour créer une référence. Pour un réapprovisionnement, ouvrez la fiche pièce → « Enregistrer une entrée » avec la quantité et le prix d\'achat.',
    roles: ['ADMIN', 'CHEF_ATELIER'],
  },
  {
    q: 'L\'application fonctionne-t-elle sans connexion internet ?',
    a: 'Oui, Atelier Maître est une PWA (Progressive Web App). Les pages déjà visitées sont disponibles hors-ligne. Les modifications sont synchronisées dès que la connexion revient.',
    roles: ['ADMIN', 'CHEF_ATELIER', 'TECHNICIEN', 'RECEPTIONNISTE', 'CAISSIER'],
  },
  {
    q: 'Comment imprimer une facture ou un devis en PDF ?',
    a: 'Ouvrez la facture ou le devis → cliquez le bouton « Imprimer » (icône imprimante). Le PDF s\'ouvre dans un nouvel onglet. Utilisez Ctrl+P ou le bouton d\'impression du navigateur.',
    roles: ['ADMIN', 'CHEF_ATELIER', 'CAISSIER'],
  },
  {
    q: 'Comment voir les OT qui me sont assignés ?',
    a: 'La page Ordres de Travail est automatiquement filtrée sur vos OT assignés. Pour voir tous les OT de l\'atelier, demandez au Chef d\'Atelier ou à l\'Admin.',
    roles: ['TECHNICIEN'],
  },
  {
    q: 'Comment prendre un rendez-vous client ?',
    a: 'Page Planning → cliquez sur une case horaire ou « Nouveau rendez-vous ». Renseignez le client, le véhicule et le motif. Un OT peut être créé automatiquement depuis le RDV.',
    roles: ['ADMIN', 'CHEF_ATELIER', 'RECEPTIONNISTE'],
  },
  {
    q: 'Qu\'est-ce que le contrôle qualité (CQ) ?',
    a: 'Avant de livrer le véhicule, le Chef d\'Atelier valide que les travaux sont bien terminés. L\'OT passe en statut CQ → le chef valide ou rejette. S\'il rejette, l\'OT retourne EN COURS pour correction.',
    roles: ['ADMIN', 'CHEF_ATELIER', 'TECHNICIEN'],
  },
];

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Administrateur',
  SUPER_ADMIN: 'Super Admin',
  CHEF_ATELIER: "Chef d'Atelier",
  TECHNICIEN: 'Technicien',
  RECEPTIONNISTE: 'Réceptionnaire',
  CAISSIER: 'Caissier',
};

// ── Composant FAQ item ────────────────────────────────────────────────────────

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-slate-100 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left hover:bg-slate-50 transition-colors"
      >
        <span className="font-medium text-slate-800 text-sm leading-snug">{q}</span>
        {open ? <ChevronDown size={16} className="shrink-0 text-brand" /> : <ChevronRight size={16} className="shrink-0 text-slate-400" />}
      </button>
      {open && (
        <div className="px-5 pb-4 text-sm text-slate-600 leading-relaxed border-t border-slate-50 bg-slate-50/50">
          <p className="pt-3">{a}</p>
        </div>
      )}
    </div>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────

export default function HelpPage() {
  const { user } = useAuth();
  const role = resolveGuideRole(user?.roles ?? []);
  const [search, setSearch] = useState('');
  const [showAll, setShowAll] = useState(false);

  const roleFaq = useMemo(() =>
    FAQ.filter(f => !role || f.roles.includes(role)),
    [role]
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return roleFaq;
    return roleFaq.filter(f =>
      f.q.toLowerCase().includes(q) || f.a.toLowerCase().includes(q)
    );
  }, [search, roleFaq]);

  // Guides contextuels liés à ce rôle
  const roleGuides = useMemo(() => {
    const seen = new Set<string>();
    return GUIDE_PAGES.filter(p => {
      if (!p.guides[role]) return false;
      if (seen.has(p.indexHref)) return false;
      seen.add(p.indexHref);
      return true;
    });
  }, [role]);

  return (
    <div className="space-y-8 max-w-3xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <BookOpen size={22} className="text-brand" /> Centre d&apos;aide
        </h1>
        <p className="text-slate-500 mt-1">
          Guides, FAQ et support — adapté à votre rôle
          {role && (
            <Badge className="ml-2 bg-brand/10 text-brand border-brand/20 font-medium">
              {ROLE_LABELS[role] ?? role}
            </Badge>
          )}
        </p>
      </div>

      {/* Recherche */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
        <Input
          placeholder="Rechercher dans l'aide…"
          className="pl-9 h-11"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Guides par section */}
      {!search && roleGuides.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 mb-3 flex items-center gap-2">
            <Lightbulb size={14} className="text-brand" /> Guides pour votre profil
          </h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {roleGuides.slice(0, showAll ? undefined : 6).map(p => {
              const guide = p.guides[role]!;
              return (
                <Link
                  key={p.id}
                  href={p.indexHref}
                  className="flex items-start gap-3 rounded-xl border border-slate-100 bg-white p-4 hover:border-brand/30 hover:bg-brand/5 transition-all group"
                >
                  <CircleHelp size={16} className="text-brand mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800 group-hover:text-brand transition-colors truncate">
                      {guide.title}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{guide.intro}</p>
                  </div>
                </Link>
              );
            })}
          </div>
          {roleGuides.length > 6 && (
            <button
              onClick={() => setShowAll(v => !v)}
              className="mt-3 text-xs text-brand hover:underline"
            >
              {showAll ? 'Voir moins' : `Voir les ${roleGuides.length - 6} autres guides`}
            </button>
          )}
        </div>
      )}

      {/* FAQ */}
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 mb-3 flex items-center gap-2">
          <CircleHelp size={14} className="text-brand" /> Questions fréquentes
        </h2>
        {filtered.length === 0 ? (
          <div className="text-center py-10 text-slate-400">
            <p className="font-medium">Aucun résultat pour « {search} »</p>
            <p className="text-sm mt-1">Essayez d&apos;autres mots-clés ou contactez le support.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(f => <FaqItem key={f.q} q={f.q} a={f.a} />)}
          </div>
        )}
      </div>

      {/* Contact support */}
      <div className="rounded-2xl bg-gradient-to-br from-brand/5 to-[var(--afrique-forest-soft)] border border-brand/10 p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="w-10 h-10 rounded-xl bg-[#25D366] flex items-center justify-center shrink-0">
          <MessageCircle size={20} className="text-white" />
        </div>
        <div className="flex-1">
          <p className="font-semibold text-slate-800">Vous ne trouvez pas votre réponse ?</p>
          <p className="text-sm text-slate-500 mt-0.5">Notre équipe répond sur WhatsApp en moins de 2h (jours ouvrables).</p>
        </div>
        <a
          href="https://wa.me/237690777859?text=Bonjour%2C%20j%27ai%20besoin%20d%27aide%20avec%20Atelier%20Ma%C3%AEtre"
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 inline-flex items-center gap-2 rounded-xl bg-[#25D366] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#20ba5a] transition-colors"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4 fill-white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
          Contacter le support
        </a>
      </div>
    </div>
  );
}
