'use client';

import { useRef } from 'react';
import Link from 'next/link';
import { motion, useScroll, useTransform, useReducedMotion } from 'motion/react';
import {
  ArrowRight,
  Car,
  ChevronDown,
  FileText,
  Package,
  CalendarDays,
  MessageSquare,
  BarChart3,
  Smartphone,
  Building2,
  CheckCircle2,
  ChevronRight,
  UserPlus,
  Users,
  Zap,
  Wifi,
  Mail,
  Clock,
  TrendingUp,
} from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { LandingHeroBackground } from '@/components/marketing/LandingHeroBackground';
import { LandingParallaxSection } from '@/components/marketing/LandingParallaxSection';
import {
  LandingHeader,
  SectionEyebrow,
  SectionTitle,
  SectionLead,
  SectionDivider,
  TrustPills,
  PainCard,
  FeatureCard,
  FaqItem,
  LandingFooter,
} from '@/components/marketing/landing-ui';
import { BrandCalligraphy } from '@/components/marketing/brand-calligraphy';
import { InstallAppButton } from '@/components/pwa/InstallAppButton';

const FEATURES = [
  {
    icon: Car,
    title: 'Ordres de travail',
    desc: 'Statuts, historique, contrôle qualité et clôture automatique après paiement.',
  },
  {
    icon: FileText,
    title: 'Devis & factures',
    desc: 'TVA 19,25 %, timbre, PDF — tout en francs CFA, sans ressaisie.',
  },
  {
    icon: Package,
    title: 'Stock pièces',
    desc: 'Alertes seuil, mouvements liés aux OT, vente comptoir.',
  },
  {
    icon: CalendarDays,
    title: 'Planning',
    desc: 'Rendez-vous, charge atelier, vue réception sur mobile.',
  },
  {
    icon: MessageSquare,
    title: 'SMS clients',
    desc: 'Orange / MTN Cameroun — rappels et notifications intégrés.',
  },
  {
    icon: BarChart3,
    title: 'Tableau de bord',
    desc: 'CA, performance techniciens, factures en attente.',
  },
];

const PAIN_POINTS = [
  'OT sur papier et statut inconnu',
  'Devis Word + facture Excel',
  'Stock mis à jour à la main',
  'Clients relancés par SMS un par un',
];

const FAQ = [
  {
    q: 'Pour qui est Atelier Maître ?',
    a: 'Garages indépendants et petits groupes (2–5 sites) au Cameroun : mécanique, réception, caisse, chef d\'atelier.',
  },
  {
    q: 'Puis-je gérer plusieurs garages ?',
    a: 'Oui. Un compte patron peut regrouper plusieurs ateliers (ex. Douala + Yaoundé). Chaque employé reste rattaché à un seul garage.',
  },
  {
    q: 'Comment installer l\u2019application sur mon téléphone ?',
    a: 'Utilisez le bouton « Installer l\u2019app » sur cette page : sur Android ou ordinateur, l\u2019installation est en un clic ; sur iPhone, suivez les étapes Safari (Partager → Sur l\u2019écran d\u2019accueil). Aucun Play Store requis.',
  },
  {
    q: 'Faut-il un serveur sur place ?',
    a: 'Non en mode cloud : navigateur + téléphone. Déploiement possible sur un VPS si vous préférez vos données en local.',
  },
  {
    q: 'Et mes données actuelles ?',
    a: 'Reprise clients / véhicules possible au déploiement — on prépare l\'import avec vous.',
  },
];

export function LandingPage() {
  const heroRef = useRef<HTMLElement>(null);
  const reduceMotion = useReducedMotion();

  const { scrollYProgress: heroScroll } = useScroll({
    target: heroRef,
    offset: ['start start', 'end start'],
  });

  const copyY = useTransform(heroScroll, [0, 1], reduceMotion ? [0, 0] : [0, -72]);
  const copyOpacity = useTransform(heroScroll, [0, 0.85], [1, 0.35]);

  const mockY = useTransform(heroScroll, [0, 1], reduceMotion ? [0, 0] : [0, -130]);
  const mockScale = useTransform(heroScroll, [0, 1], reduceMotion ? [1, 1] : [1, 0.94]);
  const mockRotate = useTransform(heroScroll, [0, 1], reduceMotion ? [0, 0] : [0, -1.5]);

  const floatLeftY = useTransform(heroScroll, [0, 1], reduceMotion ? [0, 0] : [0, -180]);
  const floatRightY = useTransform(heroScroll, [0, 1], reduceMotion ? [0, 0] : [0, -220]);
  const floatBadgeY = useTransform(heroScroll, [0, 1], reduceMotion ? [0, 0] : [0, -90]);

  return (
    <div className="landing-page min-h-screen text-slate-800">
      <LandingHeader />

      {/* Hero */}
      <section
        ref={heroRef}
        className="relative overflow-x-hidden px-4 pb-2 pt-12 sm:px-6 sm:pb-3 sm:pt-16"
      >
        <LandingHeroBackground scrollYProgress={heroScroll} />
        <div className="relative z-10 mx-auto max-w-6xl">
          <div className="grid items-center gap-8 lg:grid-cols-[1fr_1.05fr] lg:gap-8 xl:gap-10">
            {/* Copy */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              style={{ y: copyY, opacity: copyOpacity }}
            >
              <Badge className="mb-6 rounded-full border-[var(--afrique-gold)]/25 bg-white/85 px-4 py-1.5 text-[var(--afrique-earth)] shadow-sm backdrop-blur-sm">
                Conçu pour les ateliers au Cameroun
              </Badge>
              <SectionTitle as="h1">
                De la réception à l&apos;encaissement,{' '}
                <span className="landing-gradient-text">un seul flux.</span>
              </SectionTitle>
              <SectionLead className="mt-6 text-slate-600 sm:text-xl">
                OT, devis, stock, planning et factures en XAF — sans carnet, sans
                ressaisie, sans perdre le fil sur WhatsApp.
              </SectionLead>
              <div className="mt-8 flex flex-wrap gap-3 sm:gap-4">
                <Link
                  href="/demo"
                  className={cn(
                    buttonVariants({ size: 'lg' }),
                    'group h-12 gap-2 rounded-xl bg-gradient-to-r from-brand via-[#1a6a9c] to-[var(--afrique-forest)] px-8 text-base text-white shadow-lg shadow-brand/20 ring-1 ring-[var(--afrique-gold)]/30 transition-all duration-200 hover:shadow-xl hover:ring-[var(--afrique-gold)]/45',
                  )}
                >
                  Réserver une démo
                  <ArrowRight
                    size={18}
                    className="shrink-0 transition-transform duration-200 group-hover:translate-x-0.5"
                  />
                </Link>
                <Link
                  href="/inscription"
                  className={cn(
                    buttonVariants({ variant: 'outline', size: 'lg' }),
                    'h-12 rounded-xl border-brand/40 bg-white/80 text-brand backdrop-blur-sm hover:bg-white hover:border-brand/60 font-semibold',
                  )}
                >
                  <UserPlus size={17} className="mr-1.5" />
                  Créer mon atelier
                </Link>
              </div>
              <TrustPills
                items={[
                  'Essai pilote',
                  'Données hébergées',
                  'Support FR',
                  'XAF · TVA 19,25 %',
                ]}
              />
            </motion.div>

            {/* Visuel produit — droite desktop, sous le texte mobile */}
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.12 }}
              className="relative mx-auto w-full max-w-lg lg:max-w-none lg:mx-0"
              style={{ y: mockY, scale: mockScale, rotate: mockRotate }}
            >
              {/* Mock dashboard */}
              <div className="relative overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-2xl shadow-slate-400/20 ring-1 ring-slate-900/[0.04]">
                <div
                  className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-brand/[0.06] to-transparent"
                  aria-hidden
                />
                <div className="relative flex items-center gap-2 border-b border-slate-100/90 bg-slate-50/90 px-4 py-3 backdrop-blur-sm">
                  <span className="h-3 w-3 rounded-full bg-red-400" />
                  <span className="h-3 w-3 rounded-full bg-amber-400" />
                  <span className="h-3 w-3 rounded-full bg-green-400" />
                  <span className="ml-4 truncate text-xs text-slate-400">
                    Atelier Maître — Tableau de bord
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 p-4 sm:gap-3 sm:p-5">
                  {[
                    { label: 'OT en cours', value: '12', color: 'bg-[var(--afrique-brand-soft)] text-brand' },
                    { label: 'CA du jour', value: '485k', color: 'bg-[var(--afrique-gold-soft)] text-[var(--afrique-gold)]' },
                    { label: 'Stock bas', value: '3', color: 'bg-[var(--afrique-terra-soft)] text-[var(--afrique-terracotta)]' },
                  ].map((k) => (
                    <div key={k.label} className={`rounded-xl p-3 sm:p-4 ${k.color}`}>
                      <p className="text-[10px] font-medium opacity-80 sm:text-xs">{k.label}</p>
                      <p className="mt-1 text-lg font-bold sm:text-2xl">{k.value}</p>
                    </div>
                  ))}
                </div>
                <div className="space-y-2 border-t border-slate-100 px-4 py-4 sm:px-5">
                  {[
                    { ref: 'OT-2026-0142', veh: 'Toyota Hilux · CE 1234 AB', status: 'EN COURS', tone: 'bg-[var(--afrique-brand-soft)] text-brand' },
                    { ref: 'OT-2026-0138', veh: 'Peugeot 301 · LT 8890 CD', status: 'PRÊT', tone: 'bg-[var(--afrique-forest-soft)] text-[var(--afrique-forest)]' },
                    { ref: 'OT-2026-0135', veh: 'Nissan Hardbody · SW 4455 EF', status: 'CQ', tone: 'bg-[var(--afrique-gold-soft)] text-[#8a6914]' },
                  ].map((row) => (
                    <div
                      key={row.ref}
                      className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2.5"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-slate-800">{row.ref}</p>
                        <p className="truncate text-[11px] text-slate-500">{row.veh}</p>
                      </div>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${row.tone}`}>
                        {row.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Carte flottante — OT mobile */}
              <motion.div
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.35 }}
                style={{ y: floatLeftY }}
                className="absolute -bottom-5 -left-2 z-10 hidden w-[min(220px,55%)] rounded-xl border border-slate-200/80 bg-white/95 p-3 shadow-lg shadow-slate-300/30 backdrop-blur-md sm:block lg:-left-6"
              >
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand/10">
                    <Smartphone className="text-brand" size={16} />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-800">Réception mobile</p>
                    <p className="text-[10px] text-slate-500">Nouvel OT en 30 s</p>
                  </div>
                </div>
              </motion.div>

              {/* Carte flottante — SMS */}
              <motion.div
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.45 }}
                style={{ y: floatRightY }}
                className="absolute -right-1 top-8 z-10 hidden w-[min(240px,58%)] rounded-xl border border-emerald-200/80 bg-emerald-50/95 p-3 shadow-lg shadow-emerald-200/30 backdrop-blur-md md:block lg:-right-5"
              >
                <div className="flex items-start gap-2">
                  <MessageSquare className="mt-0.5 shrink-0 text-green-600" size={16} />
                  <div>
                    <p className="text-xs font-semibold text-green-900">SMS Orange · envoyé</p>
                    <p className="mt-0.5 text-[10px] leading-snug text-green-800">
                      « Votre véhicule est prêt. Montant : 185 000 XAF »
                    </p>
                  </div>
                </div>
              </motion.div>

              {/* Badge flottant — multi-garages */}
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.55 }}
                style={{ y: floatBadgeY }}
                className="absolute -top-3 right-6 z-10 hidden rounded-full border border-slate-200/90 bg-white/95 px-3 py-1.5 text-[11px] font-medium text-slate-600 shadow-md backdrop-blur-sm lg:flex lg:items-center lg:gap-1.5"
              >
                <Building2 size={13} className="text-brand" />
                Douala + Yaoundé
              </motion.div>
            </motion.div>
          </div>
        </div>

        <a
          href="#probleme"
          className="relative z-10 mx-auto mt-3 flex w-fit flex-col items-center gap-0.5 text-slate-400 transition-colors hover:text-brand sm:mt-4"
          aria-label="Voir la suite de la page"
        >
          <span className="text-[10px] font-medium uppercase tracking-widest">Suite</span>
          <ChevronDown size={22} className="animate-bounce" strokeWidth={2} />
        </a>
      </section>

      <SectionDivider className="py-1" />

      {/* Pain */}
      <section id="probleme" className="scroll-mt-20 landing-section-warm px-4 pt-8 pb-10 sm:px-6 sm:pt-9 sm:pb-12">
        <div className="mx-auto max-w-6xl text-center">
          <SectionEyebrow>Le constat</SectionEyebrow>
          <SectionTitle className="mx-auto">Vous reconnaissez ça ?</SectionTitle>
          <div className="mt-8 grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
            {PAIN_POINTS.map((p, i) => (
              <PainCard key={p} index={i}>
                {p}
              </PainCard>
            ))}
          </div>
          <p className="mx-auto mt-8 max-w-2xl text-pretty text-lg leading-relaxed text-slate-600">
            <BrandCalligraphy>Atelier Maître</BrandCalligraphy>
            {' '}
            relie tout dans{' '}
            <strong className="font-semibold text-slate-800">un dossier par véhicule</strong>
            {' '}
            — clair pour toute l&apos;équipe.
          </p>
        </div>
      </section>

      <SectionDivider />

      {/* Comment ça marche */}
      <section id="comment-ca-marche" className="scroll-mt-20 bg-white px-4 py-10 sm:px-6 sm:py-14">
        <div className="mx-auto max-w-6xl">
          <div className="text-center">
            <SectionEyebrow>Démarrage</SectionEyebrow>
            <SectionTitle>Opérationnel en 3 étapes</SectionTitle>
            <SectionLead className="mx-auto mt-3">
              Pas d&apos;installation, pas de serveur. Votre atelier est en ligne en moins de 10 minutes.
            </SectionLead>
          </div>
          <div className="mt-10 grid gap-6 sm:grid-cols-3 sm:gap-8">
            {[
              {
                step: '01',
                icon: UserPlus,
                title: 'Créez votre compte',
                desc: 'Renseignez les infos de votre garage — nom, ville, contact. Votre espace est prêt en 3 minutes.',
                color: 'text-brand bg-brand/10',
              },
              {
                step: '02',
                icon: Users,
                title: 'Ajoutez votre équipe',
                desc: 'Invitez techniciens, réceptionniste et caissier. Chacun reçoit son identifiant prenom.nom.',
                color: 'text-[var(--afrique-forest)] bg-[var(--afrique-forest-soft)]',
              },
              {
                step: '03',
                icon: Zap,
                title: 'Gérez vos OT',
                desc: 'Créez votre premier ordre de travail, envoyez un devis PDF, encaissez. Tout est lié automatiquement.',
                color: 'text-[var(--afrique-gold)] bg-[var(--afrique-gold-soft)]',
              },
            ].map((s, i) => (
              <motion.div
                key={s.step}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.12 }}
                className="relative flex flex-col gap-4 rounded-2xl border border-slate-100 bg-slate-50/60 p-6 shadow-sm"
              >
                <span className="absolute right-4 top-4 text-5xl font-black text-slate-100 select-none">
                  {s.step}
                </span>
                <div className={cn('w-11 h-11 rounded-xl flex items-center justify-center shrink-0', s.color)}>
                  <s.icon size={22} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">{s.title}</h3>
                  <p className="mt-1.5 text-sm text-slate-600 leading-relaxed">{s.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <SectionDivider />

      {/* Features */}
      <section id="fonctionnalites" className="scroll-mt-20 landing-section-sand px-4 py-10 sm:px-6 sm:py-12">
        <div className="mx-auto max-w-6xl">
          <SectionEyebrow>Plateforme</SectionEyebrow>
          <SectionTitle>Tout l&apos;atelier, une plateforme</SectionTitle>
          <SectionLead>
            Inspiré des meilleurs logiciels garage — adapté au terrain camerounais,
            sans complexité inutile.
          </SectionLead>
          <div className="mt-8 grid gap-5 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
            {FEATURES.map((f, i) => (
              <FeatureCard key={f.title} icon={f.icon} title={f.title} desc={f.desc} index={i} />
            ))}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="bg-gradient-to-r from-brand/5 via-[var(--afrique-gold-soft)] to-[var(--afrique-forest-soft)] px-4 py-10 sm:px-6 sm:py-12">
        <div className="mx-auto max-w-5xl">
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
            {[
              { icon: Clock,     value: '30 s',      label: 'Pour créer un OT' },
              { icon: FileText,  value: '1 clic',    label: 'Devis en PDF XAF' },
              { icon: Wifi,      value: '100 %',     label: 'Fonctionne hors-ligne' },
              { icon: TrendingUp,value: 'Temps réel',label: 'Tableau de bord live' },
            ].map(({ icon: Icon, value, label }) => (
              <div key={label} className="flex flex-col items-center gap-2 text-center">
                <div className="w-10 h-10 rounded-xl bg-white/70 flex items-center justify-center shadow-sm">
                  <Icon size={18} className="text-brand" />
                </div>
                <p className="text-2xl font-black text-slate-900 sm:text-3xl">{value}</p>
                <p className="text-xs font-medium text-slate-600">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Multi garages */}
      <LandingParallaxSection
        id="multi-garages"
        decor
        contentShift={20}
        className="scroll-mt-20 bg-gradient-to-br from-[#155A87] via-[#1a5c4a] to-[#1D6FA4] px-4 py-12 text-white sm:px-6 sm:py-14"
      >
        <div className="mx-auto max-w-6xl">
          <div className="grid items-center gap-8 lg:grid-cols-2 lg:gap-10">
            <div>
              <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-white/60">
                Réseaux &amp; groupes
              </p>
              <h2 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl">
                Un patron, plusieurs garages
              </h2>
              <p className="mt-5 text-pretty text-lg leading-relaxed text-white/88">
                Vous ouvrez un compte, vous ajoutez vos sites (Douala, Yaoundé, Bafoussam…).
                Chaque employé travaille dans <strong className="font-semibold text-white">son</strong> atelier — pas de usine à gaz RH.
              </p>
              <ul className="mt-9 space-y-3.5">
                {[
                  'Vue groupe pour le propriétaire',
                  'Paramètres et facturation par site',
                  'Clients et stock par garage',
                ].map((item) => (
                  <li key={item} className="flex items-center gap-3 text-[0.9375rem] text-white/92">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/20">
                      <CheckCircle2 size={16} className="text-white/95" />
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border border-white/20 bg-white/10 p-8 shadow-xl shadow-black/10 ring-1 ring-white/10 backdrop-blur-md">
              <p className="text-sm font-semibold uppercase tracking-wider text-white/70">
                Compte · Groupe Kams
              </p>
              <div className="mt-6 space-y-3">
                {['Garage Douala — Akwa', 'Garage Yaoundé — Bastos', 'Garage Bafoussam'].map(
                  (g) => (
                    <div
                      key={g}
                      className="flex items-center justify-between rounded-xl bg-white/12 px-4 py-3.5 ring-1 ring-white/10 transition-colors duration-200 hover:bg-white/18"
                    >
                      <span className="font-medium">{g}</span>
                      <ChevronRight size={18} className="opacity-60" />
                    </div>
                  ),
                )}
              </div>
            </div>
          </div>
        </div>
      </LandingParallaxSection>

      <LandingParallaxSection contentShift={16} className="scroll-mt-20 px-4 py-10 sm:px-6 sm:py-12">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-8 lg:flex-row lg:gap-12">
          <div className="flex-1">
            <SectionEyebrow>Terrain</SectionEyebrow>
            <SectionTitle>Mobile dès la réception</SectionTitle>
            <SectionLead className="mt-4">
              Cartes OT, bottom nav réceptionniste, formulaires une colonne — pensé pour le
              téléphone dans l&apos;atelier, pas seulement le bureau.
            </SectionLead>
          </div>
          <div className="flex-1 rounded-2xl border border-[var(--afrique-gold)]/20 bg-white p-8 shadow-lg shadow-[var(--afrique-terra-soft)] ring-1 ring-slate-900/[0.03]">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--afrique-forest-soft)] ring-1 ring-[var(--afrique-forest-ring)]">
              <Smartphone className="text-[var(--afrique-forest)]" size={22} />
            </div>
            <h3 className="mt-5 text-lg font-bold text-[var(--afrique-forest)]">100 % contexte Cameroun</h3>
            <ul className="mt-5 space-y-3">
              {[
                'Montants en francs CFA (XAF)',
                'TVA 19,25 % et timbre fiscal',
                'SMS Orange / MTN (simulation → prod)',
                'Interface en français',
              ].map((line) => (
                <li key={line} className="flex items-start gap-2.5 text-sm text-slate-600">
                  <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-[var(--afrique-gold)]" />
                  {line}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </LandingParallaxSection>

      {/* Tarifs */}
      <section id="tarifs" className="scroll-mt-20 bg-white px-4 py-10 sm:px-6 sm:py-14">
        <div className="mx-auto max-w-4xl text-center">
          <SectionEyebrow>Tarifs</SectionEyebrow>
          <SectionTitle>Simple et transparent</SectionTitle>
          <SectionLead className="mx-auto mt-3">
            Un seul plan — toutes les fonctionnalités incluses dès le premier jour.
          </SectionLead>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 sm:gap-8">
            {/* Plan unique */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="relative flex flex-col rounded-2xl border-2 border-brand bg-white p-8 shadow-lg shadow-brand/10 text-left"
            >
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                <span className="rounded-full bg-brand px-4 py-1 text-xs font-bold text-white shadow">
                  Recommandé
                </span>
              </div>
              <p className="text-sm font-semibold uppercase tracking-wider text-brand">Atelier Maître Pro</p>
              <div className="mt-4 flex items-end gap-2">
                <span className="text-4xl font-black text-slate-900">Sur devis</span>
              </div>
              <p className="mt-2 text-sm text-slate-500">Tarif adapté à votre nombre de garages et de techniciens.</p>
              <ul className="mt-6 space-y-3">
                {[
                  'OT, devis, factures PDF illimités',
                  'Stock + alertes seuil',
                  'Planning & rendez-vous',
                  'SMS Orange / MTN intégrés',
                  'Tableau de bord temps réel',
                  'Multi-garages inclus',
                  'Support en français',
                  'Données hébergées en sécurité',
                ].map(item => (
                  <li key={item} className="flex items-center gap-2.5 text-sm text-slate-700">
                    <CheckCircle2 size={16} className="shrink-0 text-brand" />
                    {item}
                  </li>
                ))}
              </ul>
              <Link
                href="/demo"
                className={cn(
                  buttonVariants({ size: 'lg' }),
                  'mt-8 w-full h-12 rounded-xl bg-brand text-white shadow-md hover:bg-brand/90',
                )}
              >
                Demander un tarif <ArrowRight size={16} className="ml-1.5" />
              </Link>
            </motion.div>

            {/* Plan pilote */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="flex flex-col rounded-2xl border border-slate-200 bg-slate-50 p-8 text-left"
            >
              <p className="text-sm font-semibold uppercase tracking-wider text-slate-500">Pilote gratuit</p>
              <div className="mt-4 flex items-end gap-2">
                <span className="text-4xl font-black text-slate-900">Gratuit</span>
                <span className="mb-1.5 text-slate-500">/ période test</span>
              </div>
              <p className="mt-2 text-sm text-slate-500">Testez toutes les fonctionnalités avant de vous engager.</p>
              <ul className="mt-6 space-y-3">
                {[
                  'Accès complet à la plateforme',
                  '1 garage, équipe complète',
                  'Accompagnement démarrage',
                  'Données conservées à la fin du pilote',
                  'Aucune carte bancaire requise',
                ].map(item => (
                  <li key={item} className="flex items-center gap-2.5 text-sm text-slate-700">
                    <CheckCircle2 size={16} className="shrink-0 text-[var(--afrique-forest)]" />
                    {item}
                  </li>
                ))}
              </ul>
              <Link
                href="/inscription"
                className={cn(
                  buttonVariants({ variant: 'outline', size: 'lg' }),
                  'mt-8 w-full h-12 rounded-xl border-slate-300 hover:bg-white',
                )}
              >
                <UserPlus size={16} className="mr-1.5" />
                Démarrer le pilote
              </Link>
            </motion.div>
          </div>
          <p className="mt-6 text-sm text-slate-400 flex items-center justify-center gap-1.5">
            <Mail size={13} /> Des questions ?&nbsp;
            <Link href="/demo" className="text-brand hover:underline font-medium">
              Contactez-nous
            </Link>
          </p>
        </div>
      </section>

      <SectionDivider />

      {/* FAQ */}
      <section id="faq" className="scroll-mt-20 bg-white px-4 py-10 sm:px-6 sm:py-12">
        <div className="mx-auto max-w-2xl">
          <div className="text-center">
            <SectionEyebrow>Aide</SectionEyebrow>
            <SectionTitle>Questions fréquentes</SectionTitle>
            <SectionLead className="mx-auto mt-3 text-center">
              Les réponses aux objections les plus courantes avant une démo.
            </SectionLead>
          </div>
          <div className="mt-8 space-y-2.5">
            {FAQ.map((item, i) => (
              <FaqItem key={item.q} q={item.q} a={item.a} index={i} />
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-4 pb-10 pt-6 sm:px-6 sm:pb-12">
        <div className="relative mx-auto max-w-4xl overflow-hidden rounded-3xl landing-cta-africa px-8 py-10 text-center text-white shadow-2xl shadow-[var(--afrique-forest)]/25 ring-1 ring-[var(--afrique-gold)]/25 sm:py-12">
          <div
            className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full blur-3xl"
            style={{ background: 'rgba(212, 160, 23, 0.15)' }}
            aria-hidden
          />
          <div
            className="pointer-events-none absolute -bottom-16 -left-16 h-48 w-48 rounded-full blur-3xl"
            style={{ background: 'rgba(31, 107, 69, 0.2)' }}
            aria-hidden
          />
          <div className="relative">
            <SectionEyebrow className="text-white/70">Démarrage</SectionEyebrow>
            <h2 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl">
              Prêt à structurer votre atelier ?
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-pretty text-lg leading-relaxed text-white/88">
              Démo guidée 30 min · Accompagnement en français · Réponse sous 48 h
            </p>
            <div className="mt-9 flex flex-wrap justify-center gap-3 sm:gap-4">
            <Link
              href="/demo"
              className={cn(
                buttonVariants({ size: 'lg' }),
                'h-12 rounded-xl bg-white text-brand shadow-lg transition-all duration-200 hover:bg-brand hover:text-white hover:shadow-xl',
              )}
            >
              Contactez-nous
            </Link>
              <Link
                href="/login"
                className={cn(
                  buttonVariants({ variant: 'outline', size: 'lg' }),
                  'h-12 rounded-xl border-white/50 bg-white/5 text-white backdrop-blur-sm transition-colors hover:bg-white/15',
                )}
              >
                Connexion atelier
              </Link>
              <InstallAppButton variant="landing-ghost" size="lg" />
            </div>
          </div>
        </div>
      </section>

      <LandingFooter />
    </div>
  );
}
