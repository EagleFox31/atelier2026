'use client';

import { useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion, useScroll, useTransform, useReducedMotion, MotionValue, AnimatePresence } from 'motion/react';
import {
  ArrowRight,
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
  ClipboardList,
  AlertCircle,
  Plus,
  Star,
  ShieldCheck,
  Globe,
} from 'lucide-react';

import { LANDING_COLORS as C } from '@/components/marketing/landing-colors';
import { LandingKenteBar } from '@/components/marketing/LandingKenteBar';
import { LandingNav } from '@/components/marketing/LandingNav';
import { BrandCalligraphy } from '@/components/marketing/brand-calligraphy';

const ROLES = [
  { photo: '/landing/gérant_garage.jpg',  role: 'Gérant',         desc: 'Vue CA consolidée, pilotage multi-sites et alertes en temps réel.' },
  { photo: '/landing/chef_atelier.jpg',        role: 'Chef d\'atelier', desc: 'Crée les OT, suit l\'avancement et valide le contrôle qualité.' },
  { photo: '/landing/mecanicien.jpg',           role: 'Technicien',     desc: 'Consulte ses missions et renseigne ses observations depuis son téléphone.' },
  { photo: '/landing/reception.jpg',            role: 'Réceptionnaire', desc: 'Accueille le client, ouvre l\'OT et programme le RDV en 30 secondes.' },
  { photo: '/landing/caissier.jpg',             role: 'Caissier',       desc: 'Génère la facture, enregistre l\'encaissement et clôture la journée.' },
  { photo: '/landing/carrossier.jpg',           role: 'Carrossier',     desc: 'Accès à ses fiches véhicule et historique d\'interventions carrosserie.' },
];

const FEATURES = [
  {
    Icon: ClipboardList,
    color: C.brand,
    bg: '#FEE2C5',
    title: 'Ordres de travail',
    desc: 'Statuts, historique, contrôle qualité et clôture automatique après paiement.',
  },
  {
    Icon: FileText,
    color: C.gold,
    bg: '#FEF3C7',
    title: 'Devis & factures',
    desc: 'TVA 19,25 %, timbre fiscal, PDF en XAF — sans ressaisie, sans erreur.',
  },
  {
    Icon: Package,
    color: C.green,
    bg: '#D1FAE5',
    title: 'Stock pièces',
    desc: 'Alertes seuil, mouvements liés aux OT, vente comptoir en temps réel.',
  },
  {
    Icon: CalendarDays,
    color: C.brandDeep,
    bg: '#FEE2C5',
    title: 'Planning atelier',
    desc: 'Rendez-vous, charge atelier, vue réception optimisée pour le mobile.',
  },
  {
    Icon: MessageSquare,
    color: '#0F6E56',
    bg: '#D1FAE5',
    title: 'SMS Orange / MTN',
    desc: 'Rappels et notifications clients automatiques — intégrés nativement.',
  },
  {
    Icon: BarChart3,
    color: C.red,
    bg: '#FEE2E2',
    title: 'Tableau de bord live',
    desc: 'CA, performance techniciens, factures en attente — tout en un coup d\'œil.',
  },
];

const PAIN_POINTS = [
  { Icon: ClipboardList, color: C.brand, text: 'OT sur papier — statut inconnu, historique introuvable' },
  { Icon: FileText,      color: C.gold,  text: 'Devis Word + facture Excel, aucun lien entre les deux' },
  { Icon: Package,       color: C.green, text: 'Stock mis à jour à la main, ruptures découvertes trop tard' },
  { Icon: MessageSquare, color: C.red,   text: 'Clients relancés un par un sur WhatsApp, sans suivi' },
];

const STATS = [
  { Icon: Clock,     color: C.goldLight, value: '30 s',      label: 'Pour créer un OT' },
  { Icon: FileText,  color: C.goldLight, value: '1 clic',    label: 'Devis PDF en XAF' },
  { Icon: Wifi,      color: C.goldLight, value: '100 %',     label: 'Fonctionne hors-ligne' },
  { Icon: TrendingUp,color: C.goldLight, value: 'Temps réel',label: 'Dashboard live' },
];

const FAQ = [
  {
    q: 'Pour qui est Atelier Maître ?',
    a: 'Garages indépendants et petits groupes (2–5 sites) au Cameroun : mécanique, réception, caisse, chef d\'atelier. Pensé pour le terrain, pas pour une grande chaîne.',
  },
  {
    q: 'Puis-je gérer plusieurs garages ?',
    a: 'Oui. Un compte patron regroupe plusieurs ateliers (ex. Douala + Yaoundé). Chaque employé reste rattaché à un seul garage avec ses propres accès.',
  },
  {
    q: 'Comment installer l\'app sur mon téléphone ?',
    a: 'Sur Android ou ordinateur : installation en un clic. Sur iPhone : Partager → Sur l\'écran d\'accueil dans Safari. Aucun Play Store requis.',
  },
  {
    q: 'Faut-il un serveur sur place ?',
    a: 'Non en mode cloud : navigateur + téléphone suffit. Déploiement possible sur un VPS si vous préférez garder vos données en local.',
  },
  {
    q: 'Que deviennent mes données existantes ?',
    a: 'Reprise clients et véhicules possible au déploiement. On prépare l\'import avec vous — aucune perte d\'historique.',
  },
];

/* ─── SOUS-COMPOSANTS ───────────────────────────────────────────────────── */

function Eyebrow({ children, light = false }: { children: React.ReactNode; light?: boolean }) {
  return (
    <span
      style={{
        display: 'inline-block',
        fontSize: '0.72rem',
        fontWeight: 700,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        color: light ? 'rgba(242,201,90,0.85)' : C.brand,
        marginBottom: '0.75rem',
      }}
    >
      {children}
    </span>
  );
}

function SectionHeading({
  children,
  light = false,
  style = {},
}: {
  children: React.ReactNode;
  light?: boolean;
  style?: React.CSSProperties;
}) {
  return (
    <h2
      style={{
        fontFamily: '"Playfair Display", Georgia, serif',
        fontSize: 'clamp(1.85rem, 3.5vw, 2.75rem)',
        fontWeight: 900,
        lineHeight: 1.12,
        letterSpacing: '-0.03em',
        color: light ? '#FFFFFF' : C.earth,
        ...style,
      }}
    >
      {children}
    </h2>
  );
}

function Lead({
  children,
  light = false,
  style = {},
}: {
  children: React.ReactNode;
  light?: boolean;
  style?: React.CSSProperties;
}) {
  return (
    <p
      style={{
        fontSize: '1.05rem',
        lineHeight: 1.8,
        color: light ? 'rgba(255,255,255,0.6)' : C.muted,
        marginTop: '0.875rem',
        ...style,
      }}
    >
      {children}
    </p>
  );
}

function CheckItem({ children, color = C.brand }: { children: React.ReactNode; color?: string }) {
  return (
    <li style={{ display: 'flex', alignItems: 'flex-start', gap: '0.625rem', fontSize: '0.875rem', color: C.earth }}>
      <CheckCircle2 size={16} color={color} style={{ flexShrink: 0, marginTop: '0.15rem' }} />
      {children}
    </li>
  );
}

function FaqItem({ q, a, index }: { q: string; a: string; index: number }) {
  const [open, setOpen] = useState(false);
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.35, delay: index * 0.06 }}
      style={{
        background: C.white,
        borderRadius: 12,
        border: `1px solid rgba(200,81,26,0.1)`,
        overflow: 'hidden',
      }}
    >
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          width: '100%',
          padding: '1rem 1.125rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '1rem',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
          fontWeight: 600,
          fontSize: '0.925rem',
          color: C.earth,
          fontFamily: 'inherit',
        }}
      >
        {q}
        <Plus
          size={18}
          color={C.brand}
          style={{ flexShrink: 0, transition: 'transform 0.3s', transform: open ? 'rotate(45deg)' : 'none' }}
        />
      </button>
      {open && (
        <div
          style={{
            padding: '0 1.5rem 1.125rem',
            fontSize: '0.875rem',
            color: C.muted,
            lineHeight: 1.75,
            borderTop: `1px solid rgba(200,81,26,0.06)`,
          }}
        >
          {a}
        </div>
      )}
    </motion.div>
  );
}

/* ─── COMPOSANT PRINCIPAL ───────────────────────────────────────────────── */

export function LandingPage() {
  const [hoveredRolePhoto, setHoveredRolePhoto] = useState<string | null>(null);

  const heroRef  = useRef<HTMLElement>(null);
  const painRef  = useRef<HTMLElement>(null);
  const rolesRef = useRef<HTMLElement>(null);
  const ctaRef   = useRef<HTMLElement>(null);
  const reduceMotion = useReducedMotion();

  /* ── Background pleine page ── */
  const { scrollY } = useScroll();
  const bgParallaxY = useTransform(scrollY, [0, 5000], reduceMotion ? [0, 0] : [0, -320]);

  /* ── Scroll hero ── */
  const { scrollYProgress: heroScroll } = useScroll({
    target: heroRef,
    offset: ['start start', 'end start'],
  });
  const copyY      = useTransform(heroScroll, [0, 1], reduceMotion ? [0, 0] : [0, -72]);
  const copyOpacity = useTransform(heroScroll, [0, 0.85], [1, 0.35]);
  const mockY      = useTransform(heroScroll, [0, 1], reduceMotion ? [0, 0] : [0, -40]);
  const glow1Y     = useTransform(heroScroll, [0, 1], reduceMotion ? [0, 0] : [0,  160]);
  const glow2Y     = useTransform(heroScroll, [0, 1], reduceMotion ? [0, 0] : [0,   80]);
  const patternY   = useTransform(heroScroll, [0, 1], reduceMotion ? [0, 0] : [0,   50]);

  /* ── Scroll pain ── */
  const { scrollYProgress: painScroll } = useScroll({
    target: painRef,
    offset: ['start end', 'end start'],
  });
  const painOrb1Y = useTransform(painScroll, [0, 1], reduceMotion ? [0, 0] : [ 80, -80]);
  const painOrb2Y = useTransform(painScroll, [0, 1], reduceMotion ? [0, 0] : [-40,  60]);

  /* ── Scroll rôles ── */
  const { scrollYProgress: rolesScroll } = useScroll({
    target: rolesRef,
    offset: ['start end', 'end start'],
  });
  const rolesBgY = useTransform(rolesScroll, [0, 1], reduceMotion ? [0, 0] : [40, -40]);

  /* ── Scroll CTA ── */
  const { scrollYProgress: ctaScroll } = useScroll({
    target: ctaRef,
    offset: ['start end', 'end start'],
  });
  const ctaGlowY = useTransform(ctaScroll, [0, 1], reduceMotion ? [0, 0] : [100, -60]);

  /* Styles réutilisables */
  const btnPrimary: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.875rem 2rem',
    borderRadius: 12,
    background: C.brand,
    color: '#FFFFFF',
    fontWeight: 600,
    fontSize: '0.95rem',
    textDecoration: 'none',
    border: 'none',
    cursor: 'pointer',
    transition: 'background 0.2s, transform 0.2s',
  };

  const btnGhost: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.875rem 1.75rem',
    borderRadius: 12,
    background: 'rgba(255,255,255,0.08)',
    color: '#FFFFFF',
    fontWeight: 500,
    fontSize: '0.95rem',
    textDecoration: 'none',
    border: '1px solid rgba(255,255,255,0.18)',
    cursor: 'pointer',
    transition: 'background 0.2s',
  };

  const sectionClass = 'landing-section-y landing-px';

  return (
    <div
      className="landing-page"
      style={{ fontFamily: '"DM Sans", system-ui, sans-serif', color: C.earth, overflowX: 'hidden', position: 'relative' }}
    >
      {/* ── FOND PLEINE PAGE PARALLAX ── */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 0, overflow: 'hidden' }}>
        <motion.div style={{
          position: 'absolute',
          inset: '-12%',
          backgroundImage: 'url(/landing/hero.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          y: bgParallaxY,
        }} />
        {/* Voile très léger pour harmoniser avec les sections */}
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(20,12,5,0.10)' }} />
      </div>

      {/* ── CONTENU (au-dessus du fond fixe) ── */}
      <div style={{ position: 'relative', zIndex: 1 }}>

      <LandingNav btnPrimary={btnPrimary} />

      {/* ── HERO ── */}
      <section
        ref={heroRef}
        className="landing-px pt-[5.25rem] pb-8 sm:pt-24 sm:pb-10"
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          position: 'relative',
          overflow: 'hidden',
          background: 'transparent',
        }}
      >
        {/* Overlay héro — juste assez pour lire le texte */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(145deg, rgba(10,6,2,0.45) 0%, rgba(20,10,4,0.30) 50%, rgba(200,81,26,0.15) 100%)',
        }} />
        {/* Pattern géométrique — parallax lent */}
        <motion.div style={{
          position: 'absolute', inset: 0, opacity: 0.04,
          backgroundImage: 'repeating-linear-gradient(45deg,#fff 0,#fff 1px,transparent 0,transparent 50%)',
          backgroundSize: '28px 28px',
          y: patternY,
        }} />
        {/* Glow brand — parallax rapide */}
        <motion.div style={{
          position: 'absolute', top: '20%', right: '-10%',
          width: 600, height: 600, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(200,81,26,0.3) 0%, transparent 70%)',
          pointerEvents: 'none',
          y: glow1Y,
        }} />
        <motion.div style={{
          position: 'absolute', bottom: '-10%', left: '5%',
          width: 400, height: 400, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(212,164,50,0.15) 0%, transparent 70%)',
          pointerEvents: 'none',
          y: glow2Y,
        }} />

        <div className="landing-inner landing-grid-hero relative z-[2]">
          {/* Copie */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} style={{ y: copyY, opacity: copyOpacity }}>
            {/* Badge */}
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
              background: 'rgba(212,164,50,0.15)', border: '1px solid rgba(212,164,50,0.35)',
              color: C.goldLight, padding: '0.35rem 0.9rem', borderRadius: 99,
              fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
              marginBottom: '1rem',
            }}>
              <Globe size={12} color={C.goldLight} />
              Logiciel garage · Cameroun
            </div>

            <h1 style={{
              fontFamily: '"Playfair Display", serif',
              fontSize: 'clamp(2.4rem, 4.5vw, 3.75rem)',
              fontWeight: 900, lineHeight: 1.1, letterSpacing: '-0.03em',
              color: '#FFFFFF', marginBottom: '1rem',
            }}>
              Votre atelier,{' '}
              <span style={{ color: C.goldLight }}>enfin maîtrisé.</span>
              <br />Du premier OT à l&apos;encaissement.
            </h1>

            <p style={{ fontSize: '1.05rem', lineHeight: 1.7, color: 'rgba(255,255,255,0.7)', maxWidth: 480, marginBottom: '1.5rem' }}>
              OT, devis, stock, planning et factures en XAF — tout dans un seul flux.
              Sans carnet, sans ressaisie, sans perdre le fil.
            </p>

            <div className="flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Link href="/demo" className="w-full sm:w-auto" style={{ ...btnPrimary, justifyContent: 'center' }}>
                Réserver une démo <ArrowRight size={16} />
              </Link>
              <Link href="/inscription" className="w-full sm:w-auto" style={{ ...btnGhost, justifyContent: 'center' }}>
                <UserPlus size={16} /> Créer mon atelier
              </Link>
            </div>

            <div className="mt-0 md:mt-3" style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap' }}>
              {[
                [ShieldCheck, C.green,   'Essai pilote gratuit'],
                [Globe,       C.gold,    'Support en français'],
                [FileText,    C.brand,   'TVA 19,25 % · XAF'],
                [MessageSquare, C.red,   'SMS Orange / MTN'],
              ].map(([Icon, color, label]) => (
                <span key={label as string} style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.78rem', color: 'rgba(255,255,255,0.55)', fontWeight: 500 }}>
                  <CheckCircle2 size={13} color={color as string} />
                  {label as string}
                </span>
              ))}
            </div>

            {/* Social proof avatars */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '1.5rem', paddingTop: '1.25rem', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ display: 'flex' }}>
                {['/landing/gérant_garage.jpg', '/landing/chef_atelier.jpg', '/landing/mecanicien.jpg'].map((src, i) => (
                  <div key={src} style={{
                    width: 34, height: 34, borderRadius: '50%', overflow: 'hidden',
                    border: '2px solid rgba(200,81,26,0.6)',
                    marginLeft: i > 0 ? -10 : 0,
                    position: 'relative', flexShrink: 0,
                  }}>
                    <Image src={src} alt="" fill sizes="34px" style={{ objectFit: 'cover' }} />
                  </div>
                ))}
              </div>
              <p style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.5)', lineHeight: 1.4 }}>
                <strong style={{ color: 'rgba(255,255,255,0.8)' }}>Garages camerounais</strong><br />
                déjà structurés avec Atelier Maître
              </p>
            </div>
          </motion.div>

          {/* Dashboard mock */}
          <motion.div
            initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.12 }}
            style={{ y: mockY }}
          >
            <div style={{
              borderRadius: 20, overflow: 'hidden',
              boxShadow: '0 32px 80px rgba(0,0,0,0.5)',
              border: '1px solid rgba(200,81,26,0.18)',
            }}>
              {/* Barre de titre */}
              <div style={{ background: '#1A1209', padding: '0.75rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {['#ff5f57', '#ffbd2e', '#28ca41'].map((bg) => (
                  <span key={bg} style={{ width: 10, height: 10, borderRadius: '50%', background: bg }} />
                ))}
                <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.35)', marginLeft: '0.5rem' }}>
                  atelier-maitre.cm · Tableau de bord
                </span>
              </div>
              {/* KPIs */}
              <div className="landing-kpi-row" style={{ padding: '1rem', background: C.surface }}>
                {[
                  { label: 'OT en cours', value: '12',   color: C.earth  },
                  { label: 'CA du jour',   value: '485k', color: C.brand  },
                  { label: 'Stock bas',    value: '3',    color: C.gold   },
                ].map(({ label, value, color }) => (
                  <div key={label} style={{ background: '#1A1209', borderRadius: 10, padding: '0.9rem 1rem' }}>
                    <p style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.45)', fontWeight: 500, marginBottom: '0.25rem' }}>{label}</p>
                    <p style={{ fontSize: '1.4rem', fontWeight: 700, color }}>{value}</p>
                  </div>
                ))}
              </div>
              {/* OT rows */}
              <div style={{ padding: '0 1rem 1rem', background: C.surface }}>
                {[
                  { ref: 'OT-2026-0142', veh: 'Toyota Hilux · CE 1234 AB',      status: 'EN COURS',   bg: '#FEE2C5', fg: C.brandDeep },
                  { ref: 'OT-2026-0138', veh: 'Peugeot 301 · LT 8890 CD',       status: 'PRÊT',       bg: C.greenLight, fg: C.green },
                  { ref: 'OT-2026-0135', veh: 'Nissan Hardbody · SW 4455 EF',   status: 'CONTRÔLE Q', bg: '#FEF3C7', fg: '#92400E' },
                ].map((row) => (
                  <div key={row.ref} className="landing-ot-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.65rem 0.875rem', borderRadius: 8, background: C.sand, marginBottom: '0.5rem', gap: '0.75rem' }}>
                    <div className="min-w-0 flex-1">
                      <p style={{ fontSize: '0.75rem', fontWeight: 700, color: C.earth }}>{row.ref}</p>
                      <p style={{ fontSize: '0.68rem', color: C.muted, marginTop: 1 }}>{row.veh}</p>
                    </div>
                    <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '0.25rem 0.625rem', borderRadius: 99, background: row.bg, color: row.fg, whiteSpace: 'nowrap' }}>
                      {row.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>

        <a href="#probleme" style={{ position: 'relative', zIndex: 2, margin: '1.25rem auto 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem', color: 'rgba(255,255,255,0.3)', textDecoration: 'none' }}>
          <span style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Suite</span>
          <ChevronDown size={20} />
        </a>
      </section>

      {/* ── PAIN ── */}
      <section ref={painRef} id="probleme" className={`${sectionClass} relative overflow-hidden`} style={{ background: '#1A1209' }}>
        {/* Orbs parallax */}
        <motion.div style={{
          position: 'absolute', top: '-15%', right: '-5%',
          width: 500, height: 500, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(200,81,26,0.12) 0%, transparent 65%)',
          pointerEvents: 'none',
          y: painOrb1Y,
        }} />
        <motion.div style={{
          position: 'absolute', bottom: '-20%', left: '-8%',
          width: 400, height: 400, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(212,164,50,0.08) 0%, transparent 65%)',
          pointerEvents: 'none',
          y: painOrb2Y,
        }} />
        <div className="landing-inner text-center relative z-[1]">
          <Eyebrow light>Le quotidien de 80 % des garages</Eyebrow>
          <SectionHeading light>Vous vous reconnaissez ?</SectionHeading>
          <Lead light style={{ maxWidth: 520, margin: '0.875rem auto 0' }}>
            Chaque jour, des heures perdues. Des clients qui rappellent. Du chiffre qui s&apos;évapore. Ce n&apos;est pas une fatalité.
          </Lead>

          <div className="landing-grid-4 mt-10">
            {PAIN_POINTS.map(({ Icon, color, text }, i) => (
              <motion.div
                key={text}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.35, delay: i * 0.08 }}
                whileHover="hovered"
                animate="rest"
                variants={{
                  rest: {
                    y: 0,
                    background: 'rgba(255,255,255,0.04)',
                    borderColor: 'rgba(255,255,255,0.08)',
                    boxShadow: `0 0 0px ${color}00`,
                  },
                  hovered: {
                    y: -8,
                    background: `${color}18`,
                    borderColor: `${color}55`,
                    boxShadow: `0 16px 40px ${color}25`,
                    transition: { type: 'spring', stiffness: 320, damping: 22 },
                  },
                }}
                style={{ borderRadius: 16, padding: '1.5rem', border: '1px solid', cursor: 'default' }}
              >
                {/* Icône — secousse "alerte" au hover */}
                <motion.div
                  variants={{
                    rest: { rotate: 0, scale: 1 },
                    hovered: {
                      rotate: [0, -12, 12, -8, 8, -4, 4, 0],
                      scale: 1.15,
                      transition: { duration: 0.55, ease: 'easeInOut' },
                    },
                  }}
                  style={{
                    width: 44, height: 44, borderRadius: 11,
                    background: `${color}22`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    marginBottom: '1rem',
                  }}
                >
                  <Icon size={21} color={color} />
                </motion.div>

                {/* Texte — s'éclaircit au hover */}
                <motion.p
                  variants={{
                    rest: { color: 'rgba(255,255,255,0.62)' },
                    hovered: { color: 'rgba(255,255,255,0.95)' },
                  }}
                  style={{ fontSize: '0.875rem', lineHeight: 1.65, fontWeight: 500 }}
                >
                  {text}
                </motion.p>
              </motion.div>
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            style={{
              marginTop: '2.5rem', padding: '1.5rem 2rem', borderRadius: 16,
              background: 'rgba(200,81,26,0.08)', border: '1px solid rgba(200,81,26,0.2)',
              color: 'rgba(255,255,255,0.7)', fontSize: '1rem', lineHeight: 1.75,
            }}
          >
            <strong style={{ color: '#FFFFFF' }}>Atelier Maître</strong> relie tout dans{' '}
            <strong style={{ color: '#FFFFFF' }}>un dossier par véhicule</strong> — visible par toute l&apos;équipe, en temps réel, depuis n&apos;importe quel téléphone.
          </motion.div>
        </div>
      </section>

      {/* ── STEPS ── */}
      <section id="demarrage" className={sectionClass} style={{ background: C.sand }}>
        <div className="landing-inner">
          <div style={{ textAlign: 'center' }}>
            <Eyebrow>Démarrage</Eyebrow>
            <SectionHeading>Opérationnel en 3 étapes</SectionHeading>
            <Lead style={{ maxWidth: 520, margin: '0.875rem auto 0' }}>
              Aucune installation, aucun serveur. Votre atelier en ligne en moins de 10 minutes.
            </Lead>
          </div>
          <div className="landing-grid-3 mt-12">
            {[
              { step: '01', Icon: UserPlus,  color: C.brand,  bg: '#FEE2C5', title: 'Créez votre garage',     desc: 'Nom, ville, contact — 3 minutes. Votre espace est prêt, personnalisé à votre enseigne.' },
              { step: '02', Icon: Users,     color: C.earth,  bg: '#E5E0D8', title: 'Invitez votre équipe',   desc: 'Techniciens, réceptionniste, caissier — chacun reçoit son accès avec les bons droits.' },
              { step: '03', Icon: Zap,       color: C.brand,  bg: '#FEE2C5', title: 'Gérez vos premiers OT', desc: 'Créez un OT, envoyez un devis PDF en XAF, encaissez. Tout est lié. Automatiquement.' },
            ].map(({ step, Icon, color, bg, title, desc }, i) => (
              <motion.div
                key={step}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.35, delay: i * 0.08 }}
                style={{ background: C.white, borderRadius: 20, padding: '2rem', border: '1px solid rgba(200,81,26,0.08)', position: 'relative', overflow: 'hidden' }}
              >
                <span style={{ position: 'absolute', top: '-0.5rem', right: '1rem', fontFamily: '"Playfair Display", serif', fontSize: '5rem', fontWeight: 900, color: 'rgba(200,81,26,0.06)', lineHeight: 1, userSelect: 'none' }}>
                  {step}
                </span>
                <div style={{ width: 48, height: 48, borderRadius: 12, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.25rem' }}>
                  <Icon size={22} color={color} />
                </div>
                <h3 style={{ fontWeight: 700, fontSize: '1rem', color: C.earth, marginBottom: '0.5rem' }}>{title}</h3>
                <p style={{ fontSize: '0.875rem', color: C.muted, lineHeight: 1.7 }}>{desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section id="fonctionnalites" className={sectionClass} style={{ background: C.white }}>
        <div className="landing-inner">
          <Eyebrow>Plateforme</Eyebrow>
          <SectionHeading>Tout l&apos;atelier. Une seule plateforme.</SectionHeading>
          <Lead style={{ maxWidth: 520 }}>Inspiré des meilleurs logiciels garage — adapté au terrain camerounais, sans complexité inutile.</Lead>
          <div className="landing-grid-3 mt-12">
            {FEATURES.map(({ Icon, color, bg, title, desc }, i) => (
              <motion.div
                key={title}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.35, delay: (i % 3) * 0.08 }}
                whileHover={{ y: -4, boxShadow: `0 16px 40px ${color}22` }}
                style={{
                  background: C.white, border: `1px solid rgba(200,81,26,0.1)`,
                  borderRadius: 20, padding: '1.75rem',
                  transition: 'border-color 0.25s',
                }}
              >
                <div style={{ width: 44, height: 44, borderRadius: 10, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.25rem' }}>
                  <Icon size={22} color={color} />
                </div>
                <h3 style={{ fontWeight: 700, fontSize: '0.95rem', color: C.earth, marginBottom: '0.5rem' }}>{title}</h3>
                <p style={{ fontSize: '0.845rem', color: C.muted, lineHeight: 1.65 }}>{desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── STATS ── */}
      <div className="landing-stats-band" style={{ background: `linear-gradient(135deg, ${C.brand} 0%, ${C.brandDeep} 100%)` }}>
        <div className="landing-inner landing-grid-4">
          {STATS.map(({ Icon, color, value, label }, i) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.3, delay: i * 0.07 }}
              style={{ textAlign: 'center', padding: '1rem' }}
            >
              <Icon size={24} color={color} style={{ marginBottom: '0.75rem' }} />
              <p style={{ fontFamily: '"Playfair Display", serif', fontSize: '2.25rem', fontWeight: 900, color: '#FFFFFF', lineHeight: 1 }}>{value}</p>
              <p style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)', marginTop: '0.5rem', fontWeight: 500 }}>{label}</p>
            </motion.div>
          ))}
        </div>
      </div>

      {/* ── ÉQUIPE / RÔLES ── */}
      <section ref={rolesRef} className={`${sectionClass} relative overflow-hidden`} style={{ background: C.white }}>
        {/* Cercle décoratif parallax */}
        <motion.div style={{
          position: 'absolute', top: '50%', right: '-12%',
          width: 480, height: 480, borderRadius: '50%',
          background: `radial-gradient(circle, ${C.sand} 0%, transparent 70%)`,
          pointerEvents: 'none', zIndex: 0,
          y: rolesBgY,
        }} />

        {/* Photo du rôle survolé en fond de section */}
        <AnimatePresence>
          {hoveredRolePhoto && (
            <motion.div
              key={hoveredRolePhoto}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              style={{
                position: 'absolute', inset: 0,
                pointerEvents: 'none', zIndex: 0,
              }}
            >
              <Image
                src={hoveredRolePhoto}
                alt=""
                fill
                priority
                sizes="100vw"
                style={{ objectFit: 'cover', objectPosition: 'center 20%' }}
              />
              {/* Voile léger sans blur */}
              <div style={{
                position: 'absolute', inset: 0,
                background: 'rgba(245,240,233,0.60)',
              }} />
            </motion.div>
          )}
        </AnimatePresence>

        <div className="landing-inner text-center relative z-[1]">
          <Eyebrow>Pour toute votre équipe</Eyebrow>
          <SectionHeading>Un outil, six rôles, zéro confusion.</SectionHeading>
          <Lead style={{ maxWidth: 540, margin: '0.875rem auto 0' }}>
            Chacun voit exactement ce dont il a besoin. Ni trop, ni trop peu.
          </Lead>

          <div className="landing-grid-roles mt-12">
            {ROLES.map(({ photo, role, desc }, i) => (
              <motion.div
                key={role}
                className="group"
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.07 }}
                onHoverStart={() => setHoveredRolePhoto(photo)}
                onHoverEnd={() => setHoveredRolePhoto(null)}
                onTap={() => setHoveredRolePhoto(p => p === photo ? null : photo)}
                whileHover={{
                  y: -10,
                  boxShadow: '0 32px 64px rgba(200,81,26,0.35)',
                  transition: { type: 'spring', stiffness: 300, damping: 24 },
                }}
                style={{
                  borderRadius: 20,
                  overflow: 'hidden',
                  position: 'relative',
                  aspectRatio: '3 / 4',
                  cursor: 'default',
                  border: '1px solid rgba(200,81,26,0.12)',
                }}
              >
                {/* ── Photo plein card ── */}
                <div
                  className="absolute inset-0 transition-transform duration-500 ease-out group-hover:scale-[1.07]"
                  style={{ position: 'absolute', inset: 0 }}
                >
                  <Image
                    src={photo}
                    alt={role}
                    fill
                    sizes="(max-width:768px) 45vw, 200px"
                    style={{ objectFit: 'cover', objectPosition: 'top center' }}
                  />
                </div>

                {/* Gradient permanent bas → haut pour lisibilité */}
                <div style={{
                  position: 'absolute', inset: 0,
                  background: 'linear-gradient(to top, rgba(10,5,2,0.82) 0%, rgba(10,5,2,0.18) 55%, transparent 100%)',
                }} />

                {/* ── Sous-card texte (glassmorphism) ── */}
                <motion.div
                  className="absolute bottom-0 left-0 right-0"
                  initial={{ y: 0 }}
                  style={{
                    padding: '1rem 1.1rem 1.1rem',
                    background: 'rgba(15,8,3,0.65)',
                    borderTop: '1px solid rgba(200,81,26,0.20)',
                  }}
                  animate={{ y: 0 }}
                  whileHover={{ y: 0 }}
                >
                  {/* Badge rôle */}
                  <div style={{
                    display: 'inline-flex', alignItems: 'center',
                    background: `${C.brand}22`,
                    border: `1px solid ${C.brand}44`,
                    borderRadius: 99,
                    padding: '0.2rem 0.65rem',
                    marginBottom: '0.45rem',
                  }}>
                    <span style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.goldLight }}>
                      {role}
                    </span>
                  </div>

                  {/* Description — visible sur mobile, slide au hover sur desktop */}
                  <div
                    className="overflow-hidden transition-all duration-400 ease-out max-h-24 opacity-100 sm:max-h-0 sm:opacity-0 sm:group-hover:max-h-24 sm:group-hover:opacity-100"
                  >
                    <p style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.72)', lineHeight: 1.55, marginTop: '0.2rem' }}>
                      {desc}
                    </p>
                  </div>
                </motion.div>

                {/* Barre accent top — scale in au hover */}
                <div
                  className="absolute top-0 left-0 right-0 h-[3px] scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left"
                  style={{ background: `linear-gradient(90deg, ${C.brand}, ${C.gold})` }}
                />
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── MULTI-GARAGES ── */}
      <section id="multi-garages" className={sectionClass} style={{ background: C.sand }}>
        <div className="landing-inner landing-grid-2">
          <div>
            <Eyebrow>Réseaux & groupes</Eyebrow>
            <SectionHeading>Un patron, plusieurs garages.</SectionHeading>
            <Lead style={{ maxWidth: 460 }}>
              Vous ouvrez un compte, vous ajoutez vos sites — Douala, Yaoundé, Bafoussam.
              Chaque employé travaille dans son atelier. Vous voyez tout, en temps réel.
            </Lead>
            <ul style={{ listStyle: 'none', marginTop: '2rem', display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
              <CheckItem color={C.brand}>Vue consolidée CA pour le propriétaire</CheckItem>
              <CheckItem color={C.green}>Paramètres et facturation par site</CheckItem>
              <CheckItem color={C.brand}>Clients et stock isolés par garage</CheckItem>
              <CheckItem color={C.red}>Aucune usine à gaz RH</CheckItem>
            </ul>
          </div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            style={{ background: C.white, borderRadius: 20, padding: '1.5rem', border: '1px solid rgba(200,81,26,0.1)' }}
          >
            <p style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.muted, marginBottom: '1rem' }}>
              Compte Groupe · Kams Motors
            </p>
            {['Garage Douala — Akwa', 'Garage Yaoundé — Bastos', 'Garage Bafoussam — Centre'].map((g) => (
              <div
                key={g}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '0.875rem 1rem', borderRadius: 10,
                  border: '1px solid rgba(200,81,26,0.08)', marginBottom: '0.625rem',
                  background: C.surface,
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', fontWeight: 600, color: C.earth }}>
                  <Building2 size={16} color={C.muted} />
                  {g}
                </span>
                <ChevronRight size={16} color={C.muted} />
              </div>
            ))}
            <div style={{ marginTop: '1.25rem', padding: '1rem', background: C.sand, borderRadius: 10 }}>
              <p style={{ fontSize: '0.78rem', fontWeight: 700, color: C.muted, marginBottom: '0.25rem' }}>CA Groupe · Juin 2026</p>
              <p style={{ fontFamily: '"Playfair Display", serif', fontSize: '1.75rem', fontWeight: 900, color: C.brand }}>12 450 000 XAF</p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── MOBILE & CONTEXTE ── */}
      <section className={sectionClass} style={{ background: C.white }}>
        <div className="landing-inner landing-grid-2">
          <div>
            <Eyebrow>Terrain</Eyebrow>
            <SectionHeading>Mobile dès la réception.</SectionHeading>
            <Lead style={{ maxWidth: 460 }}>
              Cartes OT, navigation réceptionniste, formulaires une colonne — pensé pour le
              téléphone dans l&apos;atelier, pas seulement pour le bureau du patron.
            </Lead>
          </div>
          <div style={{ background: C.sand, borderRadius: 20, padding: '1.75rem', border: '1px solid rgba(200,81,26,0.08)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
              <div style={{ width: 44, height: 44, borderRadius: 10, background: C.greenLight, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Smartphone size={20} color={C.green} />
              </div>
              <div>
                <p style={{ fontWeight: 700, fontSize: '0.95rem', color: C.earth }}>100 % contexte Cameroun</p>
                <p style={{ fontSize: '0.78rem', color: C.muted }}>Adapté au marché local</p>
              </div>
            </div>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {[
                [FileText,      C.brand, 'Montants en francs CFA (XAF)'],
                [Star,          C.gold,  'TVA 19,25 % et timbre fiscal'],
                [MessageSquare, C.green, 'SMS Orange / MTN intégrés'],
                [AlertCircle,   C.red,   'Interface 100 % en français'],
              ].map(([Icon, color, label]) => (
                <li key={label as string} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.875rem', color: C.earth, fontWeight: 500 }}>
                  <div style={{ width: 30, height: 30, borderRadius: 8, background: `${color as string}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {/* @ts-ignore */}
                    <Icon size={15} color={color as string} />
                  </div>
                  {label as string}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ── PRICING ── */}
      <section id="tarifs" className={sectionClass} style={{ background: C.sand }}>
        <div className="landing-inner text-center">
          <Eyebrow>Tarifs</Eyebrow>
          <SectionHeading>Simple. Transparent. Engagé.</SectionHeading>
          <Lead style={{ maxWidth: 500, margin: '0.875rem auto 0' }}>
            Un seul plan avec tout inclus dès le premier jour. Testez gratuitement, engagez-vous ensuite.
          </Lead>

          <div className="landing-grid-pricing">
            {/* Pro */}
            <motion.div
              initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
              style={{ background: '#FFF8F4', border: `2px solid ${C.brand}`, borderRadius: 20, padding: '2rem', display: 'flex', flexDirection: 'column', textAlign: 'left', position: 'relative' }}
            >
              <span style={{ display: 'inline-block', background: C.brand, color: '#FFF', fontSize: '0.68rem', fontWeight: 700, padding: '0.25rem 0.75rem', borderRadius: 6, marginBottom: '1rem', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                Recommandé
              </span>
              <p style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.brand, marginBottom: '0.5rem' }}>Atelier Maître Pro</p>
              <p style={{ fontFamily: '"Playfair Display", serif', fontSize: '2.25rem', fontWeight: 900, color: C.earth }}>Sur devis</p>
              <p style={{ fontSize: '0.82rem', color: C.muted, marginBottom: '1.5rem' }}>Adapté à vos garages et techniciens</p>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.75rem', flex: 1 }}>
                {['OT, devis, factures PDF illimités', 'Stock + alertes seuil', 'Planning & rendez-vous', 'SMS Orange / MTN intégrés', 'Tableau de bord temps réel', 'Multi-garages inclus', 'Support dédié en français'].map((item) => (
                  <CheckItem key={item} color={C.brand}>{item}</CheckItem>
                ))}
              </ul>
              <Link href="/demo" style={{ ...btnPrimary, marginTop: '1.75rem', justifyContent: 'center' }}>
                Demander un tarif <ArrowRight size={16} />
              </Link>
            </motion.div>

            {/* Pilote */}
            <motion.div
              initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
              transition={{ delay: 0.06 }}
              style={{ background: C.white, border: '1.5px solid rgba(29,106,74,0.2)', borderRadius: 20, padding: '2rem', display: 'flex', flexDirection: 'column', textAlign: 'left' }}
            >
              <span style={{ display: 'inline-block', background: C.green, color: '#FFF', fontSize: '0.68rem', fontWeight: 700, padding: '0.25rem 0.75rem', borderRadius: 6, marginBottom: '1rem', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                Pilote gratuit
              </span>
              <p style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.green, marginBottom: '0.5rem' }}>Essai pilote</p>
              <p style={{ fontFamily: '"Playfair Display", serif', fontSize: '2.25rem', fontWeight: 900, color: C.earth }}>Gratuit</p>
              <p style={{ fontSize: '0.82rem', color: C.muted, marginBottom: '1.5rem' }}>Pendant toute la période de test</p>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.75rem', flex: 1 }}>
                {['Accès complet à la plateforme', '1 garage, équipe complète', 'Accompagnement au démarrage', 'Données conservées après le pilote', 'Aucune carte bancaire requise'].map((item) => (
                  <CheckItem key={item} color={C.green}>{item}</CheckItem>
                ))}
              </ul>
              <Link
                href="/inscription"
                style={{
                  ...btnPrimary, background: 'transparent', color: C.green,
                  border: `1.5px solid ${C.green}`, marginTop: '1.75rem', justifyContent: 'center',
                }}
              >
                <UserPlus size={16} /> Démarrer le pilote
              </Link>
            </motion.div>
          </div>

          <p style={{ marginTop: '1.5rem', fontSize: '0.82rem', color: C.muted, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
            <Mail size={13} color={C.brand} />
            Des questions ?{' '}
            <Link href="/demo" style={{ color: C.brand, fontWeight: 600, textDecoration: 'none' }}>
              Contactez-nous
            </Link>
          </p>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" className={sectionClass} style={{ background: C.white }}>
        <div className="landing-inner text-center">
          <Eyebrow>Questions fréquentes</Eyebrow>
          <SectionHeading>Ce que les garages demandent</SectionHeading>
          <Lead style={{ maxWidth: 480, margin: '0.875rem auto 0', textAlign: 'center' }}>
            Les réponses aux questions les plus courantes avant une démo.
          </Lead>
          <div style={{ maxWidth: 720, margin: '2.5rem auto 0', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {FAQ.map((item, i) => (
              <FaqItem key={item.q} q={item.q} a={item.a} index={i} />
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA FINAL ── */}
      <section ref={ctaRef} className={`${sectionClass} relative overflow-hidden text-center`} style={{
        background: 'linear-gradient(135deg, rgba(26,18,9,0.75) 0%, rgba(45,27,9,0.72) 50%, rgba(61,35,16,0.68) 100%)',
      }}>
        <motion.div style={{
          position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
          width: 'min(600px, 100%)', height: 300, borderRadius: '50%',
          background: 'radial-gradient(ellipse, rgba(200,81,26,0.25) 0%, transparent 70%)',
          pointerEvents: 'none',
          y: ctaGlowY,
        }} />
        <div style={{ position: 'relative', zIndex: 2 }}>
          <Eyebrow light>Passer à l&apos;action</Eyebrow>
          <SectionHeading light style={{ marginTop: '0.5rem' }}>Prêt à structurer votre atelier ?</SectionHeading>
          <Lead light style={{ maxWidth: 500, margin: '0.875rem auto 0', textAlign: 'center' }}>
            Démo guidée 30 min · Accompagnement en français · Réponse sous 48 h
          </Lead>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap', marginTop: '2.5rem' }}>
            <Link href="/demo" style={{ ...btnPrimary, background: C.gold, color: '#1A1209', fontWeight: 700 }}>
              Réserver une démo <ArrowRight size={16} />
            </Link>
            <Link href="/login" style={btnGhost}>
              Connexion atelier
            </Link>
          </div>

          {/* Témoignage gérant */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="landing-cta-testimonial"
            style={{
              marginTop: '2.5rem',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 16, padding: '1.25rem 1.5rem',
            }}
          >
            <div style={{ width: 52, height: 52, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, border: `2px solid ${C.gold}55`, position: 'relative' }}>
              <Image src="/landing/gérant_garage.jpg" alt="Gérant atelier" fill sizes="52px" style={{ objectFit: 'cover' }} />
            </div>
            <div>
              <p style={{ fontSize: '0.875rem', color: 'rgba(255,255,255,0.8)', lineHeight: 1.6, fontStyle: 'italic', marginBottom: '0.5rem' }}>
                &ldquo;Avant, je ne savais pas combien je gagnais vraiment. Maintenant j&apos;ai le chiffre en temps réel.&rdquo;
              </p>
              <p style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>Gérant · Garage automobile, Douala</p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ background: 'rgba(18,10,4,0.80)', borderTop: 'none' }}>
        <LandingKenteBar />
        <div className="landing-inner landing-px py-10 sm:py-12">
          <div className="landing-footer-row">
            <span style={{ fontFamily: '"Playfair Display", serif', fontSize: '1.1rem', fontWeight: 700, color: '#FFFFFF' }}>
              Atelier <span style={{ color: C.goldLight }}>Maître</span>
            </span>
            <div className="landing-footer-links">
              {['Mentions légales', 'Confidentialité', 'Contact'].map((l) => (
                <Link key={l} href="#" style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.35)', textDecoration: 'none' }}>{l}</Link>
              ))}
            </div>
            <p style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.25)' }}>© 2026 Atelier Maître · Logiciel garage Cameroun</p>
          </div>
          <p
            style={{
              marginTop: '1.5rem',
              paddingTop: '1.25rem',
              borderTop: '1px solid rgba(255,255,255,0.06)',
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: 'center',
              gap: '0.375rem',
            }}
          >
            <BrandCalligraphy className="text-[1.35em] !text-[#F2C95A]">by</BrandCalligraphy>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.06em', color: 'rgba(255,255,255,0.4)' }}>
              Trigenys Group
            </span>
          </p>
        </div>
      </footer>

      </div>{/* fin contenu */}
    </div>
  );
}

export default LandingPage;