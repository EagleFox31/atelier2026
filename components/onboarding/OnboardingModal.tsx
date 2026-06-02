'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/auth-context';
import {
  Users, Car, Wrench, Package, FileText,
  Calendar, ClipboardList, CheckCircle2,
  BarChart2, ShieldCheck, ArrowRight, X,
  Search, Banknote, Settings
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Types ──────────────────────────────────────────────────────────────────

interface Step {
  icon: React.ElementType;
  color: string;
  bg: string;
  title: string;
  description: string;
  hint?: string;
}

// ─── Contenu par rôle ────────────────────────────────────────────────────────

const STEPS_BY_ROLE: Record<string, Step[]> = {
  RECEPTIONNISTE: [
    {
      icon: Users,
      color: 'text-blue-500',
      bg: 'bg-blue-500/10',
      title: 'Vous êtes le premier visage de l\'atelier',
      description:
        'Chaque client qui entre, c\'est vous qui l\'accueillez. Votre travail : noter pourquoi il vient, enregistrer sa voiture, et lancer la réparation. Ce guide vous montre comment faire ça en 3 étapes.',
    },
    {
      icon: Search,
      color: 'text-violet-500',
      bg: 'bg-violet-500/10',
      title: 'Un client entre — commencez par le chercher',
      description:
        'Allez dans "Clients" et tapez son nom ou son numéro de téléphone. S\'il est déjà venu, sa fiche s\'affiche. Sinon, créez-la : prénom, nom, téléphone. C\'est tout ce qu\'il faut pour commencer.',
      hint: '→ Clients',
    },
    {
      icon: Car,
      color: 'text-amber-500',
      bg: 'bg-amber-500/10',
      title: 'Ajoutez sa voiture',
      description:
        'Sur la fiche du client, cliquez "Ajouter un véhicule". Notez la plaque d\'immatriculation, la marque et le modèle. Si c\'est la deuxième visite, la voiture est déjà là — rien à faire.',
      hint: '→ Fiche client › Véhicules',
    },
    {
      icon: Wrench,
      color: 'text-brand',
      bg: 'bg-brand/10',
      title: 'Ouvrez la fiche de réparation',
      description:
        'Cliquez "Nouvel ordre de travail". Choisissez le client et sa voiture, puis écrivez ce que le client vous a dit avec ses propres mots. C\'est ce que le mécanicien va lire en premier.',
      hint: '→ Ordres de travail › Nouveau',
    },
    {
      icon: Calendar,
      color: 'text-green-500',
      bg: 'bg-green-500/10',
      title: 'Pour les rendez-vous pris à l\'avance',
      description:
        'Dans "Planning", vous pouvez réserver une heure pour un client qui appellera. Le jour J, quand il arrive, tout est déjà noté — vous n\'avez plus qu\'à confirmer.',
      hint: '→ Planning',
    },
    {
      icon: FileText,
      color: 'text-brand',
      bg: 'bg-brand/10',
      title: 'Devis et factures — consultation',
      description:
        'Vous appelez le client pour valider le devis, vous lui annoncez que sa voiture est prête, vous imprimez la facture et le conduisez à la caisse. Vous consultez les montants dans "Facturation" ou sur l\'OT, sans les modifier.',
      hint: '→ Facturation / Fiche OT',
    },
  ],

  TECHNICIEN: [
    {
      icon: Wrench,
      color: 'text-brand',
      bg: 'bg-brand/10',
      title: 'Votre travail, c\'est ici',
      description:
        'Tout ce que vous faites — voir la panne, noter ce que vous trouvez, utiliser des pièces — se passe sur la fiche de la voiture. Rien à mémoriser : l\'application vous guide.',
    },
    {
      icon: ClipboardList,
      color: 'text-amber-500',
      bg: 'bg-amber-500/10',
      title: 'Voir les voitures qui vous sont confiées',
      description:
        'Allez dans "Ordres de travail". Les voitures qu\'on vous a attribuées apparaissent en haut de la liste. Cliquez sur une voiture pour voir ce que le client a dit et commencer.',
      hint: '→ Ordres de travail',
    },
    {
      icon: Search,
      color: 'text-violet-500',
      bg: 'bg-violet-500/10',
      title: 'Notez ce que vous trouvez',
      description:
        'Sur la fiche, onglet "Observations". Décrivez la panne en clair, comme vous l\'expliqueriez au chef. Ces notes servent à faire le devis pour le client — plus c\'est précis, mieux c\'est.',
      hint: '→ Fiche voiture › Observations',
    },
    {
      icon: Package,
      color: 'text-green-500',
      bg: 'bg-green-500/10',
      title: 'Utiliser une pièce du stock',
      description:
        'Onglet "Pièces" sur la fiche. Cherchez la pièce par son nom, indiquez la quantité utilisée. Le stock se met à jour tout seul. Pièce introuvable ? Signalez-le dans vos observations.',
      hint: '→ Fiche voiture › Pièces',
    },
  ],

  CHEF_ATELIER: [
    {
      icon: BarChart2,
      color: 'text-brand',
      bg: 'bg-brand/10',
      title: 'Vous pilotez tout l\'atelier',
      description:
        'Le tableau de bord vous montre en un coup d\'œil combien de voitures sont en cours, ce qui est urgent, et les rendez-vous du jour. Chaque matin, commencez par là.',
      hint: '→ Tableau de bord',
    },
    {
      icon: Users,
      color: 'text-violet-500',
      bg: 'bg-violet-500/10',
      title: 'Donner une voiture à un mécanicien',
      description:
        'Quand une voiture arrive et attend, ouvrez sa fiche et cliquez "Assigner". Choisissez le mécanicien disponible. Il voit aussitôt la voiture de son côté et peut commencer.',
      hint: '→ Fiche voiture › Assigner',
    },
    {
      icon: FileText,
      color: 'text-amber-500',
      bg: 'bg-amber-500/10',
      title: 'Faire le devis pour le client',
      description:
        'Une fois le diagnostic fait, ouvrez la fiche › onglet "Devis" › "Nouveau devis". Les observations du mécanicien se transforment en lignes de devis. Les taxes sont calculées automatiquement.',
      hint: '→ Fiche voiture › Devis',
    },
    {
      icon: CheckCircle2,
      color: 'text-teal-500',
      bg: 'bg-teal-500/10',
      title: 'Vérifier le travail avant de rendre la voiture',
      description:
        'Quand le mécanicien a fini, ouvrez la fiche et remplissez la vérification finale. Tout est bon ? La voiture est prête à partir. Il y a un problème ? Elle retourne à l\'atelier avec vos remarques.',
      hint: '→ Fiche voiture › Vérification',
    },
    {
      icon: Package,
      color: 'text-red-500',
      bg: 'bg-red-500/10',
      title: 'Garder un œil sur le stock',
      description:
        'Dans "Stock & Pièces", les articles en rouge sont presque épuisés. Commandez avant la rupture. Si une pièce manque pour une réparation en cours, vous pouvez faire une demande d\'achat depuis la fiche de la voiture.',
      hint: '→ Stock & Pièces',
    },
  ],

  CAISSIER: [
    {
      icon: Banknote,
      color: 'text-green-500',
      bg: 'bg-green-500/10',
      title: 'Le chef a facturé — vous encaissez',
      description:
        'Quand le véhicule est prêt, le chef d\'atelier émet la facture depuis l\'OT. Votre rôle : enregistrer le paiement du client et clôturer l\'ordre de travail.',
    },
    {
      icon: FileText,
      color: 'text-brand',
      bg: 'bg-brand/10',
      title: 'Retrouver la facture à encaisser',
      description:
        'Dans "Facturation", onglet Factures : les factures en attente de paiement (Émise ou Partiel) sont listées. Ouvrez la facture liée à l\'OT concerné.',
      hint: '→ Facturation › Factures',
    },
    {
      icon: Banknote,
      color: 'text-amber-500',
      bg: 'bg-amber-500/10',
      title: 'Enregistrer le paiement',
      description:
        'Sur la facture, cliquez "Enregistrer un paiement". Choisissez comment le client paie : espèces, Orange Money, MTN Mobile Money, virement ou chèque. Pour Orange et MTN, notez le code de transaction.',
      hint: '→ Facture › Paiement',
    },
    {
      icon: Package,
      color: 'text-violet-500',
      bg: 'bg-violet-500/10',
      title: 'Un client achète une pièce au comptoir',
      description:
        'Pas de réparation, juste une pièce à vendre ? Allez dans "Stock & Pièces", choisissez "Vente comptoir". Sélectionnez les articles, encaissez. Le stock se met à jour automatiquement.',
      hint: '→ Stock & Pièces › Vente comptoir',
    },
  ],

  SUPER_ADMIN: [
    {
      icon: ShieldCheck,
      color: 'text-brand',
      bg: 'bg-brand/10',
      title: 'Vous êtes au-dessus de tout',
      description:
        'Vous gérez la plateforme pour tous les ateliers. Votre travail : créer les comptes administrateurs de chaque atelier, surveiller l\'activité globale, et intervenir si quelque chose ne va pas.',
    },
    {
      icon: Users,
      color: 'text-violet-500',
      bg: 'bg-violet-500/10',
      title: 'Demandes de démo',
      description:
        'Les garages intéressés remplissent le formulaire sur le site. Vous les retrouvez dans "Demandes démo" : contact, statut, notes — et une alerte dans la cloche.',
      hint: '→ Demandes démo',
    },
    {
      icon: Users,
      color: 'text-indigo-500',
      bg: 'bg-indigo-500/10',
      title: 'Ouvrir un atelier',
      description:
        'Pour chaque nouveau client, créez un compte Administrateur dans "Équipe". C\'est lui qui prend la main pour gérer son propre atelier — son équipe, ses voitures, sa facturation.',
      hint: '→ Équipe',
    },
    {
      icon: ClipboardList,
      color: 'text-amber-500',
      bg: 'bg-amber-500/10',
      title: 'Voir tout ce qui se passe',
      description:
        'Le "Journal d\'audit" enregistre chaque action faite dans l\'application, par n\'importe qui. Si un administrateur ou un employé fait quelque chose d\'anormal, vous le voyez ici.',
      hint: '→ Journal d\'audit',
    },
    {
      icon: BarChart2,
      color: 'text-green-500',
      bg: 'bg-green-500/10',
      title: 'Les chiffres de l\'atelier',
      description:
        'Les "Rapports" vous donnent le chiffre d\'affaires global et les performances de l\'équipe. Vous avez la même vue que l\'administrateur de l\'atelier — en plus complet.',
      hint: '→ Rapports',
    },
    {
      icon: Settings,
      color: 'text-slate-400',
      bg: 'bg-slate-500/10',
      title: 'Bloquer ou retirer un accès',
      description:
        'Si un administrateur quitte ou abuse de ses droits, allez dans "Équipe", ouvrez son compte et cliquez "Suspendre". Son accès est coupé immédiatement, même s\'il est connecté en ce moment.',
      hint: '→ Équipe › Fiche membre › Suspendre',
    },
  ],

  ADMIN: [
    {
      icon: ShieldCheck,
      color: 'text-brand',
      bg: 'bg-brand/10',
      title: 'Vous avez la vue sur tout l\'atelier',
      description:
        'Vous voyez chaque voiture, chaque paiement, chaque action de votre équipe. Commencez par créer les comptes de vos employés pour qu\'ils puissent travailler.',
    },
    {
      icon: Users,
      color: 'text-violet-500',
      bg: 'bg-violet-500/10',
      title: 'Créer les comptes de votre équipe',
      description:
        'Dans "Équipe", cliquez "Nouveau membre". Entrez le nom, le numéro et choisissez le poste : réceptionnaire, technicien, chef d\'atelier ou caissier. Chaque poste donne accès uniquement à ce dont la personne a besoin.',
      hint: '→ Équipe',
    },
    {
      icon: ClipboardList,
      color: 'text-amber-500',
      bg: 'bg-amber-500/10',
      title: 'Savoir exactement ce qui s\'est passé',
      description:
        'Si un employé modifie quelque chose — un prix, une facture, un paiement — vous le voyez dans le "Journal d\'audit". Qui, quoi, à quelle heure. Rien ne se perd.',
      hint: '→ Journal d\'audit',
    },
    {
      icon: BarChart2,
      color: 'text-green-500',
      bg: 'bg-green-500/10',
      title: 'Voir si votre atelier tourne bien',
      description:
        'Les "Rapports" vous montrent combien l\'atelier a encaissé et quel mécanicien travaille le mieux. Consultez-les chaque semaine pour savoir où vous en êtes.',
      hint: '→ Rapports',
    },
  ],
};

// ─── Utilitaire rôle dominant ────────────────────────────────────────────────

function resolveRole(roles: string[]): string {
  const priority = ['SUPER_ADMIN', 'ADMIN', 'CHEF_ATELIER', 'CAISSIER', 'RECEPTIONNISTE', 'TECHNICIEN'];
  return priority.find(r => roles.includes(r)) ?? 'RECEPTIONNISTE';
}

// ─── Composant ───────────────────────────────────────────────────────────────

interface OnboardingModalProps {
  onDone: () => void;
}

export function OnboardingModal({ onDone }: OnboardingModalProps) {
  const { user } = useAuth();
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);

  const role = resolveRole(user?.roles ?? []);
  const steps = STEPS_BY_ROLE[role] ?? STEPS_BY_ROLE.RECEPTIONNISTE;
  const current = steps[step];
  const isLast = step === steps.length - 1;

  function next() {
    if (isLast) { onDone(); return; }
    setDirection(1);
    setStep(s => s + 1);
  }

  function prev() {
    setDirection(-1);
    setStep(s => s - 1);
  }

  const Icon = current.icon;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onDone}
      />

      {/* Modal */}
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        className="relative z-10 w-full max-w-lg mx-4"
      >
        <div className="bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">

          {/* Header */}
          <div className="flex items-center justify-between px-6 pt-6 pb-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-brand rounded-lg flex items-center justify-center shadow-md shadow-brand/30">
                <Wrench size={14} className="text-white" />
              </div>
              <span className="text-sm font-bold text-foreground">Atelier<span className="text-brand"> Maître</span></span>
            </div>
            <button
              onClick={onDone}
              className="text-muted-foreground hover:text-foreground transition-colors rounded-full p-1 hover:bg-muted"
            >
              <X size={18} />
            </button>
          </div>

          {/* Step content */}
          <div className="px-6 pb-2 min-h-[260px] flex flex-col justify-center">
            <AnimatePresence mode="wait" custom={direction}>
              <motion.div
                key={step}
                custom={direction}
                variants={{
                  enter: (d: number) => ({ opacity: 0, x: d > 0 ? 40 : -40 }),
                  center: { opacity: 1, x: 0 },
                  exit: (d: number) => ({ opacity: 0, x: d > 0 ? -40 : 40 }),
                }}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.22, ease: 'easeInOut' }}
                className="flex flex-col gap-5"
              >
                {/* Icon */}
                <div className={cn('w-14 h-14 rounded-2xl flex items-center justify-center ring-1 ring-border/50', current.bg)}>
                  <Icon size={28} className={current.color} />
                </div>

                {/* Text */}
                <div className="space-y-2">
                  <h2 className="text-xl font-bold text-foreground leading-snug">
                    {step === 0
                      ? `Bonjour, ${user?.firstName} 👋`
                      : current.title}
                  </h2>
                  {step === 0 && (
                    <p className="text-sm font-medium text-brand">{current.title}</p>
                  )}
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {current.description}
                  </p>
                  {current.hint && (
                    <span className="inline-block mt-1 text-[11px] font-mono bg-muted text-muted-foreground px-2 py-1 rounded-md border border-border">
                      {current.hint}
                    </span>
                  )}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Footer */}
          <div className="px-6 pb-6 pt-4 flex items-center justify-between border-t border-border mt-2">
            {/* Dots */}
            <div className="flex gap-1.5">
              {steps.map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    'h-1.5 rounded-full transition-all duration-300',
                    i === step ? 'w-6 bg-brand' : 'w-1.5 bg-border'
                  )}
                />
              ))}
            </div>

            {/* Buttons */}
            <div className="flex items-center gap-2">
              {step > 0 && (
                <Button variant="ghost" size="sm" onClick={prev} className="text-muted-foreground">
                  Retour
                </Button>
              )}
              {step === 0 && (
                <Button variant="ghost" size="sm" onClick={onDone} className="text-muted-foreground">
                  Passer
                </Button>
              )}
              <Button
                size="sm"
                onClick={next}
                className="bg-brand hover:bg-brand-hover text-white gap-1.5 shadow-md shadow-brand/20"
              >
                {isLast ? 'Commencer' : 'Suivant'}
                {!isLast && <ArrowRight size={14} />}
              </Button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
