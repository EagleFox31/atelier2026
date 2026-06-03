'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion, useScroll, useTransform, useReducedMotion, MotionValue, AnimatePresence, useMotionValueEvent } from 'motion/react';
import {
  ArrowRight,
  ChevronDown,
  FileText,
  Package,
  CalendarDays,
  MessageSquare,
  BarChart3,
  Smartphone,
  Monitor,
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

const PAIN_STORIES = [
  {
    image: '/landing/cahier_ot.jpg',
    color: C.brand,
    step: '01',
    headline: 'L\'OT sur papier — introuvable demain matin.',
    detail: 'Statut inconnu, historique perdu, client qui rappelle. La journée commence déjà dans la confusion.',
  },
  {
    image: '/landing/excel.jpg',
    color: C.gold,
    step: '02',
    headline: 'Devis Word, facture Excel. Aucun lien.',
    detail: 'Vous ressaisissez les mêmes informations trois fois. Un chiffre change, tout est à refaire à la main.',
  },
  {
    image: '/landing/cherche_pieces_bazar.jpg',
    color: C.green,
    step: '03',
    headline: 'Rupture de stock découverte sur le bord.',
    detail: 'Vous commandez de tête, vous sur-stockez d\'un côté, vous manquez de l\'autre. Le client attend.',
  },
  {
    image: '/landing/whatsapp_messages.jpg',
    color: C.red,
    step: '04',
    headline: 'Clients relancés un par un sur WhatsApp.',
    detail: 'Sans système, chaque rappel prend du temps. Certains tombent à travers les mailles.',
  },
];

const STATS = [
  { Icon: Clock,     color: C.goldLight, value: '30 s',      label: 'Pour créer un OT' },
  { Icon: FileText,  color: C.goldLight, value: '1 clic',    label: 'Devis PDF en XAF' },
  { Icon: Wifi,      color: C.goldLight, value: '100 %',     label: 'Fonctionne hors-ligne' },
  { Icon: TrendingUp,color: C.goldLight, value: 'Temps réel',label: 'Dashboard live' },
];

const FAQ = [
  {
    q: 'Pour qui est fait Atelier Maître ?',
    a: 'Pour les propriétaires de garage au Cameroun — qu\'ils aient un seul atelier ou plusieurs. Que vous ayez 2 employés ou 20, l\'application s\'adapte à votre équipe.',
  },
  {
    q: 'Je gère plusieurs garages, ça marche ?',
    a: 'Oui. Vous créez un compte, vous ajoutez vos garages (Douala, Yaoundé, Bafoussam…). Chaque employé travaille dans son atelier, vous voyez tout depuis un seul tableau de bord.',
  },
  {
    q: 'Comment l\'avoir sur mon téléphone ?',
    a: 'Sur Android : ouvrez le site, appuyez sur "Ajouter à l\'écran d\'accueil" — c\'est comme une appli normale. Sur iPhone : dans Safari, appuyez sur Partager puis "Sur l\'écran d\'accueil". Gratuit, sans passer par un store.',
  },
  {
    q: 'Faut-il un serveur sur place ?',
    a: 'Non. Un téléphone avec internet suffit — rien à installer, rien à acheter. Vos données sont sécurisées en ligne et accessibles depuis n\'importe où.',
  },
  {
    q: 'Et mes clients et véhicules déjà enregistrés ?',
    a: 'On s\'en occupe. On vous aide à importer votre liste de clients et de véhicules au démarrage — vous ne repartez pas de zéro.',
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
        borderRadius: 14,
        border: `1px solid ${open ? `${C.brand}30` : 'rgba(200,81,26,0.1)'}`,
        overflow: 'hidden',
        background: open ? '#FFF8F4' : C.white,
        transition: 'background 0.25s, border-color 0.25s',
      }}
    >
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          width: '100%', padding: '1.1rem 1.25rem',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          gap: '1rem', background: 'none', border: 'none', cursor: 'pointer',
          textAlign: 'left', fontWeight: 600, fontSize: '0.925rem',
          color: open ? C.earth : C.earth, fontFamily: 'inherit',
        }}
      >
        <span style={{ color: open ? C.brand : C.earth, transition: 'color 0.25s' }}>{q}</span>
        <motion.div
          animate={{ rotate: open ? 45 : 0 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          style={{ flexShrink: 0 }}
        >
          <Plus size={18} color={open ? C.brand : C.muted} />
        </motion.div>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="answer"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{
              padding: '0 1.25rem 1.1rem',
              fontSize: '0.875rem', color: C.muted,
              lineHeight: 1.75,
              borderTop: `1px solid rgba(200,81,26,0.08)`,
            }}>
              {a}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ─── SPLIT-FLAP ────────────────────────────────────────────────────────── */
const SF_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ+-/%';

function SplitFlap({ value, active, color = '#F2C95A' }: { value: string; active: boolean; color?: string }) {
  const [chars, setChars] = useState<string[]>(() => value.split('').map(() => ' '));
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];

    if (!active) {
      setChars(value.split('').map(() => ' '));
      return;
    }

    value.split('').forEach((target, idx) => {
      let count = 0;
      const maxFlips = 8 + idx * 4;

      const flip = () => {
        if (count < maxFlips) {
          setChars(prev => {
            const next = [...prev];
            next[idx] = SF_CHARS[Math.floor(Math.random() * SF_CHARS.length)];
            return next;
          });
          count++;
          const t = setTimeout(flip, 35 + count * 6);
          timersRef.current.push(t);
        } else {
          setChars(prev => {
            const next = [...prev];
            next[idx] = target;
            return next;
          });
        }
      };

      const t = setTimeout(flip, idx * 55);
      timersRef.current.push(t);
    });

    return () => timersRef.current.forEach(clearTimeout);
  }, [active, value]);

  return (
    <span style={{ display: 'inline-flex', gap: '2px', verticalAlign: 'middle' }}>
      {chars.map((c, i) => (
        <span key={i} style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: c === ' ' ? '0.3em' : '0.85em', height: '1.2em',
          background: c === ' ' ? 'transparent' : 'rgba(0,0,0,0.35)',
          borderRadius: 4, fontFamily: '"Courier New", monospace',
          fontSize: 'inherit', fontWeight: 900, color,
          position: 'relative', overflow: 'hidden',
        }}>
          {c !== ' ' && <span style={{ position: 'absolute', left: 0, right: 0, top: '50%', height: '1px', background: 'rgba(0,0,0,0.4)' }} />}
          <span style={{ position: 'relative', zIndex: 1 }}>{c}</span>
        </span>
      ))}
    </span>
  );
}

/* ─── COMPOSANT PRINCIPAL ───────────────────────────────────────────────── */

export function LandingPage() {
  const DEFAULT_ROLE_PHOTO = '/landing/gérant_garage.jpg';
  const [hoveredRolePhoto, setHoveredRolePhoto] = useState<string>(DEFAULT_ROLE_PHOTO);
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);
  const [activePainStep, setActivePainStep] = useState(0);
  const [activeStepsStep, setActiveStepsStep] = useState(0);
  const stepsStoryRef = useRef<HTMLDivElement>(null);

  const [activeStatsStep, setActiveStatsStep] = useState(0);
  const statsStoryRef = useRef<HTMLDivElement>(null);

  const [activeFeature, setActiveFeature] = useState(0);
  const [deviceView, setDeviceView] = useState<'macbook' | 'phone'>('macbook');
  const featuresStoryRef = useRef<HTMLDivElement>(null);

  // Sur mobile → toujours vue téléphone
  useEffect(() => {
    if (window.innerWidth < 768) setDeviceView('phone');
    const onResize = () => { if (window.innerWidth < 768) setDeviceView('phone'); };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Détection scroll horizontal (trackpad / touch) → bascule MacBook ↔ Phone
  const handleFeaturesWheel = useCallback((e: WheelEvent) => {
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY) * 0.6 && Math.abs(e.deltaX) > 20) {
      setDeviceView(e.deltaX > 0 ? 'phone' : 'macbook');
    }
  }, []);

  useEffect(() => {
    const el = featuresStoryRef.current;
    if (!el) return;
    el.addEventListener('wheel', handleFeaturesWheel, { passive: true });
    return () => el.removeEventListener('wheel', handleFeaturesWheel);
  }, [handleFeaturesWheel]);
  const painStoryRef = useRef<HTMLDivElement>(null);
  // painRef réutilisé comme ref div pour le sticky inner

  const heroRef  = useRef<HTMLElement>(null);
  const painRef  = useRef<HTMLDivElement>(null);
  const rolesRef = useRef<HTMLElement>(null);
  const ctaRef   = useRef<HTMLElement>(null);
  const reduceMotion = useReducedMotion();

  /* ── Background pleine page ── */
  const { scrollY } = useScroll();
  const bgParallaxY = useTransform(scrollY, [0, 20000], reduceMotion ? [0, 0] : [0, -400]);

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

  /* ── Scroll pain parallax orbs ── */
  const { scrollYProgress: painScroll } = useScroll({
    target: painRef,
    offset: ['start end', 'end start'],
  });
  const painOrb1Y = useTransform(painScroll, [0, 1], reduceMotion ? [0, 0] : [ 80, -80]);
  const painOrb2Y = useTransform(painScroll, [0, 1], reduceMotion ? [0, 0] : [-40,  60]);

  /* ── Scroll storytelling pain ── */
  const { scrollYProgress: painStoryScroll } = useScroll({
    target: painStoryRef,
    offset: ['start start', 'end end'],
  });
  useMotionValueEvent(painStoryScroll, 'change', (v) => {
    setActivePainStep(Math.min(PAIN_STORIES.length - 1, Math.floor(v * PAIN_STORIES.length)));
  });

  /* ── Scroll steps timeline ── */
  const { scrollYProgress: stepsScroll } = useScroll({
    target: stepsStoryRef,
    offset: ['start start', 'end end'],
  });
  // Ligne : démarre à 15% de scroll, finit à 85% — plus de "pause" aux extrémités
  const stepsLineWidth = useTransform(stepsScroll, [0.05, 0.90], ['0%', '100%']);
  useMotionValueEvent(stepsScroll, 'change', (v) => {
    // Chaque step prend ~30% de scroll — transitions plus lentes et dramatiques
    if (v < 0.30) setActiveStepsStep(0);
    else if (v < 0.62) setActiveStepsStep(1);
    else setActiveStepsStep(2);
  });

  /* ── Scroll stats storytelling ── */
  const { scrollYProgress: statsScroll } = useScroll({
    target: statsStoryRef,
    offset: ['start start', 'end end'],
  });
  useMotionValueEvent(statsScroll, 'change', (v) => {
    setActiveStatsStep(Math.min(3, Math.floor(v * 4)));
  });

  /* ── Scroll features ── */
  const { scrollYProgress: featuresScroll } = useScroll({
    target: featuresStoryRef,
    offset: ['start start', 'end end'],
  });
  useMotionValueEvent(featuresScroll, 'change', (v) => {
    setActiveFeature(Math.min(5, Math.floor(v * 6)));
  });

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
      style={{ fontFamily: '"DM Sans", system-ui, sans-serif', color: C.earth, overflowX: 'clip', position: 'relative' }}
    >
      {/* ── FOND PLEINE PAGE PARALLAX ── */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 0, overflow: 'hidden' }}>
        <motion.div style={{
          position: 'absolute',
          inset: '-30%',
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
          background: 'linear-gradient(145deg, rgba(10,6,2,0.28) 0%, rgba(20,10,4,0.15) 50%, rgba(200,81,26,0.08) 100%)',
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

            <div className="mt-3 md:mt-3" style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap' }}>
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
                <strong style={{ color: 'rgba(255,255,255,0.8)' }}>10+ garages</strong><br />
                déjà sur Atelier Maître
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

      {/* ── PAIN — scroll storytelling ── */}
      <div ref={painStoryRef} id="probleme" style={{ height: `${(PAIN_STORIES.length + 1) * 100}vh`, position: 'relative', background: C.brand }}>
        <div
          ref={painRef}
          style={{ position: 'sticky', top: 0, height: '100vh', overflow: 'hidden' }}
        >
          {/* ── MOBILE : image plein fond + text card overlay ── */}
          {isMobile && (
            <div style={{ position: 'absolute', inset: 0, zIndex: 10 }}>
              <AnimatePresence mode="wait">
                <motion.div key={activePainStep} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} style={{ position: 'absolute', inset: 0 }}>
                  <Image src={PAIN_STORIES[activePainStep].image} alt="" fill sizes="100vw" style={{ objectFit: 'cover', objectPosition: 'center' }} />
                  <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(200,81,26,0.3) 0%, rgba(10,5,2,0.8) 70%)' }} />
                </motion.div>
              </AnimatePresence>
              {/* Text card overlay bas */}
              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '1.5rem', zIndex: 2 }}>
                <Eyebrow light>Le quotidien de 80 % des garages</Eyebrow>
                <AnimatePresence mode="wait">
                  <motion.div key={activePainStep} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.3 }}
                    style={{ background: 'rgba(255,255,255,0.10)', backdropFilter: 'blur(12px)', borderRadius: 18, padding: '1.25rem 1.5rem', border: '1px solid rgba(255,255,255,0.18)', marginTop: '0.75rem' }}
                  >
                    <span style={{ fontFamily: '"Playfair Display", serif', fontSize: '0.9rem', fontWeight: 900, color: PAIN_STORIES[activePainStep].color }}>{PAIN_STORIES[activePainStep].step}</span>
                    <p style={{ fontFamily: '"Playfair Display", serif', fontSize: '1.2rem', fontWeight: 900, color: '#FFFFFF', lineHeight: 1.25, margin: '0.4rem 0 0.625rem' }}>{PAIN_STORIES[activePainStep].headline}</p>
                    <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.68)', lineHeight: 1.6 }}>{PAIN_STORIES[activePainStep].detail}</p>
                  </motion.div>
                </AnimatePresence>
                {/* Dots */}
                <div style={{ display: 'flex', gap: '0.4rem', marginTop: '1rem', justifyContent: 'center' }}>
                  {PAIN_STORIES.map((s, i) => (
                    <motion.div key={i} animate={{ width: i === activePainStep ? 24 : 6, background: i === activePainStep ? s.color : 'rgba(255,255,255,0.3)' }} transition={{ duration: 0.3 }} style={{ height: 4, borderRadius: 99 }} />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── DESKTOP : layout grille texte + image flottante ── */}
          <div style={{
            height: '100%',
            display: isMobile ? 'none' : 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '3rem',
            padding: '0 6%',
            maxWidth: 1200,
            margin: '0 auto',
            alignItems: 'center',
          }}>

            {/* ── GAUCHE : cartes texte empilées ── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ marginBottom: '0.75rem' }}>
                <Eyebrow light>Le quotidien de 80 % des garages</Eyebrow>
                <p style={{
                  fontFamily: '"Playfair Display", serif',
                  fontSize: 'clamp(1.6rem, 2.5vw, 2.2rem)',
                  fontWeight: 900, lineHeight: 1.15, letterSpacing: '-0.02em',
                  color: '#FFFFFF', marginTop: '0.4rem',
                }}>
                  Vous vous reconnaissez ?
                </p>
              </div>

              {PAIN_STORIES.map((story, i) => (
                <motion.div
                  key={story.step}
                  animate={{
                    opacity: i === activePainStep ? 1 : 0.32,
                    scale: i === activePainStep ? 1 : 0.97,
                    borderColor: i === activePainStep ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.07)',
                    background: i === activePainStep ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.03)',
                  }}
                  transition={{ duration: 0.35 }}
                  style={{
                    borderRadius: 16,
                    padding: '1.1rem 1.4rem',
                    border: '1px solid',
                    cursor: 'default',
                    transformOrigin: 'left center',
                    overflow: 'hidden',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.875rem', marginBottom: i === activePainStep ? '0.6rem' : 0 }}>
                    <span style={{
                      fontFamily: '"Playfair Display", serif',
                      fontSize: '1.1rem', fontWeight: 900,
                      color: story.color, letterSpacing: '0.04em',
                      paddingTop: '0.05rem', flexShrink: 0,
                      opacity: 0.9,
                    }}>
                      {story.step}
                    </span>
                    <p style={{
                      fontSize: 'clamp(0.88rem, 1.1vw, 1.02rem)',
                      fontWeight: 700, color: '#FFFFFF', lineHeight: 1.35,
                    }}>
                      {story.headline}
                    </p>
                  </div>

                  {/* Détail — slide down sur la carte active */}
                  <motion.div
                    animate={{ height: i === activePainStep ? 'auto' : 0, opacity: i === activePainStep ? 1 : 0 }}
                    transition={{ duration: 0.3, ease: 'easeOut' }}
                    style={{ overflow: 'hidden' }}
                  >
                    <p style={{ fontSize: '0.83rem', color: 'rgba(255,255,255,0.60)', lineHeight: 1.65 }}>
                      {story.detail}
                    </p>
                  </motion.div>
                </motion.div>
              ))}
            </div>

            {/* ── DROITE : carte image qui voyage ── */}
            <div style={{ position: 'relative', height: '90vh' }}>
              {/* Carte qui se déplace en spring vers le step actif */}
              <motion.div
                animate={{ y: `${activePainStep * 12}vh` }}
                transition={{ type: 'spring', stiffness: 180, damping: 26 }}
                style={{
                  position: 'absolute',
                  left: 0, right: 0,
                  height: '56vh',
                  borderRadius: 24,
                  overflow: 'hidden',
                  boxShadow: '0 32px 80px rgba(0,0,0,0.45)',
                }}
              >
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activePainStep}
                    initial={{ opacity: 0, scale: 1.04 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    style={{ position: 'absolute', inset: 0 }}
                  >
                    <Image
                      src={PAIN_STORIES[activePainStep].image}
                      alt={PAIN_STORIES[activePainStep].headline}
                      fill
                      priority
                      sizes="45vw"
                      style={{ objectFit: 'cover', objectPosition: 'center' }}
                    />
                    {/* Léger dégradé bas pour la lisibilité */}
                    <div style={{
                      position: 'absolute', inset: 0,
                      background: 'linear-gradient(to top, rgba(8,4,1,0.50) 0%, transparent 50%)',
                    }} />
                    {/* Label step en bas de la carte */}
                    <div style={{
                      position: 'absolute', bottom: '1.25rem', left: '1.25rem',
                      display: 'flex', alignItems: 'center', gap: '0.5rem',
                    }}>
                      <span style={{
                        background: PAIN_STORIES[activePainStep].color,
                        color: '#fff', fontWeight: 700, fontSize: '0.7rem',
                        padding: '0.2rem 0.6rem', borderRadius: 99,
                        letterSpacing: '0.06em',
                      }}>
                        {PAIN_STORIES[activePainStep].step}
                      </span>
                    </div>
                  </motion.div>
                </AnimatePresence>
              </motion.div>
            </div>

          </div>

          {/* Scroll hint */}
          <motion.div
            animate={{ opacity: activePainStep === 0 ? 1 : 0 }}
            transition={{ duration: 0.3 }}
            style={{
              position: 'absolute', bottom: '1.5rem', left: '50%', transform: 'translateX(-50%)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem',
              color: 'rgba(255,255,255,0.30)', pointerEvents: 'none',
            }}
          >
            <span style={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Scroll</span>
            <ChevronDown size={16} />
          </motion.div>
        </div>
      </div>

      {/* ── STEPS — timeline horizontale au scroll ── */}
      {(() => {
        const STEPS = [
          { step: '01', Icon: UserPlus, color: C.brand,  title: 'Créez votre garage',   desc: 'Nom, ville, contact — 3 minutes. Votre espace est prêt, personnalisé à votre enseigne.' },
          { step: '02', Icon: Users,    color: C.earth,  title: 'Invitez votre équipe', desc: 'Techniciens, réceptionnaire, caissier — chacun reçoit son accès avec les bons droits.' },
          { step: '03', Icon: Zap,      color: C.brand,  title: 'Gérez vos premiers OT', desc: 'Créez un OT, envoyez un devis PDF en XAF, encaissez. Tout est lié. Automatiquement.' },
        ];
        return (
          <div ref={stepsStoryRef} id="demarrage" style={{ height: '550vh', position: 'relative', background: 'rgba(245,240,233,0.55)' }}>
            <div style={{ position: 'sticky', top: 0, height: '100vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 6%' }}>
              <div style={{ maxWidth: 1200, margin: '0 auto', width: '100%' }}>

                {/* Header */}
                <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
                  <Eyebrow>Démarrage</Eyebrow>
                  <SectionHeading>Opérationnel en 3 étapes</SectionHeading>
                  <p style={{ maxWidth: 460, margin: '0.75rem auto 0', fontSize: '1.05rem', lineHeight: 1.7, color: C.earth, opacity: 0.72 }}>
                    Aucune installation. Votre atelier en ligne en moins de 10 minutes.
                  </p>
                </div>

                {/* Timeline */}
                <div style={{ position: 'relative' }}>

                  {/* Ligne de fond (grise) — desktop only */}
                  {!isMobile && <div style={{
                    position: 'absolute', top: 20, left: '16.6%', right: '16.6%', height: 2,
                    background: 'rgba(200,81,26,0.12)', borderRadius: 99,
                  }} />}

                  {/* Ligne qui se dessine — desktop only */}
                  {!isMobile && <motion.div style={{
                    position: 'absolute', top: 20, left: '16.6%', height: 2,
                    background: `linear-gradient(to right, ${C.brand}, ${C.gold})`,
                    borderRadius: 99, width: stepsLineWidth,
                    maxWidth: 'calc(100% - 33.2%)',
                  }} />}

                  {/* Steps */}
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: isMobile ? '1.25rem' : '2rem' }}>
                    {STEPS.map(({ step, Icon, color, title, desc }, i) => {
                      const active = i <= activeStepsStep;
                      return (
                        <div key={step} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>

                          {/* Node + icône */}
                          <motion.div
                            animate={{
                              background: active ? C.brand : C.white,
                              boxShadow: active ? `0 0 0 6px ${C.brand}40, 0 12px 32px ${C.brand}45` : `0 0 0 2px rgba(200,81,26,0.15)`,
                              scale: active ? 1.25 : 1,
                            }}
                            transition={{ type: 'spring', stiffness: 200, damping: 18 }}
                            style={{
                              width: 48, height: 48, borderRadius: '50%',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              marginBottom: '1.5rem', zIndex: 1, position: 'relative',
                            }}
                          >
                            <Icon size={18} color={active ? '#fff' : C.muted} />
                          </motion.div>

                          {/* Numéro */}
                          <motion.span
                            animate={{ color: active ? C.brand : C.muted }}
                            style={{ fontFamily: '"Playfair Display", serif', fontSize: '0.75rem', fontWeight: 900, letterSpacing: '0.08em', marginBottom: '0.5rem', display: 'block' }}
                          >
                            {step}
                          </motion.span>

                          {/* Contenu */}
                          <motion.div
                            animate={{ opacity: active ? 1 : 0.28, y: active ? 0 : 18, scale: active ? 1 : 0.96 }}
                            transition={{ duration: 0.5, ease: 'easeOut' }}
                            style={{
                              background: active ? C.white : 'rgba(255,255,255,0.5)',
                              borderRadius: 16, padding: '1.5rem',
                              border: `1px solid ${active ? 'rgba(200,81,26,0.14)' : 'rgba(200,81,26,0.06)'}`,
                              boxShadow: active ? '0 8px 32px rgba(200,81,26,0.10)' : 'none',
                              width: '100%',
                            }}
                          >
                            <h3 style={{ fontWeight: 700, fontSize: '0.95rem', color: C.earth, marginBottom: '0.5rem' }}>{title}</h3>
                            <p style={{ fontSize: '0.83rem', color: C.muted, lineHeight: 1.65 }}>{desc}</p>
                          </motion.div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Scroll hint */}
              <motion.div
                animate={{ opacity: activeStepsStep === 0 ? 1 : 0 }}
                style={{
                  position: 'absolute', bottom: '1.5rem', left: '50%', transform: 'translateX(-50%)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem',
                  color: C.muted, pointerEvents: 'none',
                }}
              >
                <span style={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Scroll</span>
                <ChevronDown size={16} />
              </motion.div>
            </div>
          </div>
        );
      })()}

      {/* ── FEATURES — mockup scroll storytelling ── */}
      {(() => {
        const DEMOS = [
          { Icon: BarChart3,    color: C.brand,  bg: '#FEE2C5', title: 'Tableau de bord live',  desc: 'CA, OT en cours, stock bas — tout en un coup d\'œil. Décisions en temps réel.', desktop: '/features/dashboard-desktop.png',  mobile: '/features/dashboard-mobile.jpg' },
          { Icon: ClipboardList,color: C.earth,  bg: '#E5E0D8', title: 'Ordres de travail',      desc: 'De la réception au contrôle qualité. Statuts, historique, signature client.', desktop: '/features/workshop-desktop.png',   mobile: '/features/workshop-mobile.jpg', desktop2: '/features/workshop-detail-desktop.png', mobile2: '/features/workshop-detail-mobile.jpg' },
          { Icon: FileText,     color: C.gold,   bg: '#FEF3C7', title: 'Devis & factures',       desc: 'TVA 19,25 %, timbre fiscal, PDF en XAF — sans ressaisie, sans erreur.', desktop: '/features/billing-desktop.png',   mobile: '/features/billing-mobile.jpg' },
          { Icon: Package,      color: C.green,  bg: '#D1FAE5', title: 'Stock pièces',           desc: 'Alertes seuil, mouvements liés aux OT, vente comptoir en temps réel.', desktop: '/features/stock-desktop.png',     mobile: '/features/stock-mobile.jpg' },
          { Icon: CalendarDays, color: C.brandDeep, bg: '#FEE2C5', title: 'Planning atelier',   desc: 'Rendez-vous, charge atelier, vue réception optimisée pour le mobile.', desktop: '/features/planning-desktop.png',  mobile: '/features/planning-mobile.jpg' },
          { Icon: TrendingUp,   color: C.red,    bg: '#FEE2E2', title: 'Rapports & performances',desc: 'CA, performance techniciens, factures en attente — indicateurs clés.', desktop: '/features/reports-desktop.png',   mobile: '/features/reports-mobile.jpg' },
        ];

        const isMacbook = !isMobile && deviceView === 'macbook';

        return (
          <div ref={featuresStoryRef} id="fonctionnalites" style={{ height: '750vh', position: 'relative', background: C.surface }}>
            <div style={{ position: 'sticky', top: 0, height: '100vh', overflow: 'hidden', background: C.surface }}>
              <div style={{
                height: '100%', display: 'grid',
                gridTemplateColumns: isMobile ? '1fr' : '30% 1fr',
                gridTemplateRows: isMobile ? 'auto 1fr' : undefined,
                gap: '0', maxWidth: 1500, margin: '0 auto',
                padding: isMobile ? '2rem 5%' : '0 3%', alignItems: 'center',
                overflowY: isMobile ? 'auto' : undefined,
              }}>

                {/* ── GAUCHE : liste features ── */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', paddingRight: isMobile ? 0 : '2.5rem' }}>
                  <div style={{ marginBottom: '1rem' }}>
                    <Eyebrow>Plateforme</Eyebrow>
                    <p style={{ fontFamily: '"Playfair Display", serif', fontSize: 'clamp(1.5rem, 2.2vw, 2rem)', fontWeight: 900, color: C.earth, lineHeight: 1.2, marginTop: '0.4rem' }}>
                      Tout l&apos;atelier.<br />Une seule plateforme.
                    </p>
                  </div>

                  {DEMOS.map(({ Icon, color, bg, title, desc }, i) => {
                    const active = i === activeFeature;
                    return (
                      <motion.div
                        key={title}
                        animate={{
                          opacity: active ? 1 : 0.30,
                          x: active ? 0 : -6,
                          background: active ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.40)',
                          borderColor: active ? `${color}33` : 'rgba(200,81,26,0.05)',
                          boxShadow: active ? `0 4px 24px ${color}18` : 'none',
                        }}
                        transition={{ duration: 0.35 }}
                        style={{ borderRadius: 12, padding: '0.7rem 0.9rem', border: '1px solid', cursor: 'default' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <motion.div
                            animate={{ background: active ? bg : 'rgba(200,81,26,0.06)' }}
                            style={{ width: 34, height: 34, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                          >
                            <Icon size={16} color={active ? color : C.muted} />
                          </motion.div>
                          <div>
                            <p style={{ fontWeight: 700, fontSize: '0.88rem', color: active ? C.earth : C.muted, lineHeight: 1.2 }}>{title}</p>
                            {active && (
                              <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} transition={{ duration: 0.25 }}
                                style={{ fontSize: '0.78rem', color: C.muted, lineHeight: 1.5, marginTop: '0.25rem' }}>
                                {desc}
                              </motion.p>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}

                </div>

                {/* ── DROITE : mockup device ── */}
                {(() => {
                  const demo = DEMOS[activeFeature];
                  const hasDouble = !!(isMacbook ? demo.desktop2 : demo.mobile2);

                  const MacBook = ({ src }: { src: string }) => (
                    <div style={{ width: '100%' }}>
                      <div style={{ background: '#1A1209', borderRadius: '14px 14px 0 0', padding: '10px 10px 0', boxShadow: '0 24px 60px rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.08)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 7px 7px' }}>
                          {['#ff5f57','#ffbd2e','#28ca41'].map(c => <span key={c} style={{ width: 9, height: 9, borderRadius: '50%', background: c, flexShrink: 0 }} />)}
                          <div style={{ flex: 1, height: 14, background: 'rgba(255,255,255,0.07)', borderRadius: 5, marginLeft: 6 }} />
                        </div>
                        <div style={{ borderRadius: '5px 5px 0 0', overflow: 'hidden', background: C.surface }}>
                          <AnimatePresence mode="wait">
                            <motion.div key={src} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
                              <Image src={src} alt="" width={1440} height={900} style={{ width: '100%', height: 'auto', display: 'block' }} />
                            </motion.div>
                          </AnimatePresence>
                        </div>
                      </div>
                      <div style={{ background: 'linear-gradient(to bottom, #2a2a2a, #1a1a1a)', height: 18, borderRadius: '0 0 4px 4px' }} />
                      <div style={{ background: '#111', height: 5, borderRadius: '0 0 10px 10px', margin: '0 5%' }} />
                    </div>
                  );

                  const Phone = ({ src }: { src: string }) => (
                    <div style={{ position: 'relative', width: '100%' }}>
                      <div style={{ background: '#1A1209', borderRadius: 36, padding: '9px 7px', boxShadow: '0 24px 60px rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.06)' }}>
                        <div style={{ width: 68, height: 20, background: '#000', borderRadius: 16, margin: '0 auto 5px' }} />
                        <div style={{ borderRadius: 24, overflow: 'hidden', background: C.surface }}>
                          <AnimatePresence mode="wait">
                            <motion.div key={src} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
                              <Image src={src} alt="" width={390} height={844} style={{ width: '100%', height: 'auto', display: 'block' }} />
                            </motion.div>
                          </AnimatePresence>
                        </div>
                        <div style={{ width: 70, height: 4, background: 'rgba(255,255,255,0.22)', borderRadius: 99, margin: '7px auto 1px' }} />
                      </div>
                    </div>
                  );

                  return (
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={`${isMacbook ? 'mac' : 'ph'}-${hasDouble ? 'dbl' : 'sgl'}`}
                        initial={{ opacity: 0, scale: 0.97, x: isMacbook ? 20 : -20 }}
                        animate={{ opacity: 1, scale: 1, x: 0 }}
                        exit={{ opacity: 0, scale: 0.97 }}
                        transition={{ duration: 0.3, ease: 'easeOut' }}
                        style={{
                          display: 'flex', gap: hasDouble ? '1.25rem' : 0,
                          alignItems: 'center', justifyContent: 'center',
                          width: '100%', height: '100%',
                          padding: '1.5vh 0',
                        }}
                      >
                        {isMacbook ? (
                          hasDouble ? (
                            <>
                              <div style={{ flex: 1, minWidth: 0 }}><MacBook src={demo.desktop} /></div>
                              <div style={{ flex: 1, minWidth: 0 }}><MacBook src={demo.desktop2!} /></div>
                            </>
                          ) : (
                            <div style={{ width: '100%' }}><MacBook src={demo.desktop} /></div>
                          )
                        ) : (
                          hasDouble ? (
                            <>
                              <div style={{ width: 'calc(50% - 0.5rem)', maxWidth: 200 }}><Phone src={demo.mobile} /></div>
                              <div style={{ width: 'calc(50% - 0.5rem)', maxWidth: 200 }}><Phone src={demo.mobile2!} /></div>
                            </>
                          ) : (
                            <div style={{ width: 240 }}><Phone src={demo.mobile} /></div>
                          )
                        )}
                      </motion.div>
                    </AnimatePresence>
                  );
                })()}
              </div>

              {/* Toggle MacBook / Phone — absolu en bas à droite */}
              <div style={{
                position: 'absolute', bottom: '1.5rem', right: '5%',
                display: deviceView === 'phone' ? 'none' : 'flex',
                alignItems: 'center', gap: '0.5rem',
              }}>
                {['macbook', 'phone'].map((v) => (
                  <button
                    key={v}
                    onClick={() => setDeviceView(v as 'macbook' | 'phone')}
                    style={{
                      padding: '0.35rem 0.8rem', borderRadius: 99, fontSize: '0.7rem', fontWeight: 700,
                      cursor: 'pointer', border: 'none',
                      background: deviceView === v ? C.brand : 'rgba(200,81,26,0.08)',
                      color: deviceView === v ? '#fff' : C.muted,
                      transition: 'all 0.2s',
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      {v === 'macbook' ? <Monitor size={12} /> : <Smartphone size={12} />}
                      {v === 'macbook' ? 'Desktop' : 'Mobile'}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── STATS — storytelling split-flap ── */}
      {(() => {
        const BEATS = [
          {
            pre: 'Un client entre dans votre atelier.',
            flap: null,
            post: '',
          },
          {
            pre: '',
            flap: '30 S',
            post: 'plus tard — l\'OT est ouvert.',
          },
          {
            pre: '',
            flap: '1 CLIC',
            post: '— le devis PDF part au client.',
          },
          {
            pre: 'Ce soir — le CA est à jour.',
            flap: '100%',
            post: 'en ligne. En temps réel.',
          },
        ];

        return (
          <div
            ref={statsStoryRef}
            style={{ height: '500vh', position: 'relative', background: 'rgba(8,4,1,0.85)' }}
          >
            <div style={{
              position: 'sticky', top: 0, height: '100vh',
              display: isMobile ? 'flex' : 'grid',
              flexDirection: isMobile ? 'column' : undefined,
              gridTemplateColumns: isMobile ? undefined : '1fr 380px',
              overflow: 'hidden',
            }}>

              {/* ── CENTRE : texte storytelling ── */}
              <div style={{
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                padding: isMobile ? '2rem 2rem 0' : '0 2rem',
                position: 'relative', zIndex: 2,
                flex: isMobile ? '1' : undefined,
                height: isMobile ? undefined : '100%',
              }}>
              {/* Glow décoratif */}
              <div style={{
                position: 'absolute', top: '30%', left: '50%', transform: 'translateX(-50%)',
                width: 600, height: 300, borderRadius: '50%',
                background: `radial-gradient(ellipse, ${C.brand}25 0%, transparent 70%)`,
                pointerEvents: 'none',
              }} />

              <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', maxWidth: 800 }}>
                {/* Beats précédents — en retrait */}
                <div style={{ marginBottom: '2.5rem', minHeight: '3rem' }}>
                  {BEATS.slice(0, activeStatsStep).map((b, i) => (
                    <motion.p
                      key={i}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 0.28 }}
                      style={{ fontSize: 'clamp(0.9rem, 1.3vw, 1.1rem)', color: 'rgba(255,255,255,0.28)', lineHeight: 1.6, marginBottom: '0.25rem' }}
                    >
                      {b.pre}{b.flap ? `${b.flap} ` : ''}{b.post}
                    </motion.p>
                  ))}
                </div>

                {/* Beat actif — grand et vivant */}
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeStatsStep}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12 }}
                    transition={{ duration: 0.4, ease: 'easeOut' }}
                    style={{ lineHeight: 1.3 }}
                  >
                    {BEATS[activeStatsStep].pre && (
                      <p style={{
                        fontFamily: '"Playfair Display", serif',
                        fontSize: 'clamp(1.6rem, 3vw, 2.5rem)',
                        fontWeight: 900, color: 'rgba(255,255,255,0.55)',
                        marginBottom: '0.5rem',
                      }}>
                        {BEATS[activeStatsStep].pre}
                      </p>
                    )}
                    {BEATS[activeStatsStep].flap && (
                      <p style={{
                        fontFamily: '"Playfair Display", serif',
                        fontSize: 'clamp(3rem, 7vw, 6rem)',
                        fontWeight: 900, lineHeight: 1,
                        marginBottom: '0.5rem',
                      }}>
                        <SplitFlap value={BEATS[activeStatsStep].flap!} active={true} color={C.goldLight} />
                      </p>
                    )}
                    {BEATS[activeStatsStep].post && (
                      <p style={{
                        fontFamily: '"Playfair Display", serif',
                        fontSize: 'clamp(1.6rem, 3vw, 2.5rem)',
                        fontWeight: 900, color: '#FFFFFF',
                      }}>
                        {BEATS[activeStatsStep].post}
                      </p>
                    )}
                  </motion.div>
                </AnimatePresence>

                {/* Indicateur de progression */}
                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', marginTop: '3rem' }}>
                  {BEATS.map((_, i) => (
                    <motion.div
                      key={i}
                      animate={{
                        width: i === activeStatsStep ? 28 : 7,
                        background: i === activeStatsStep ? C.goldLight : 'rgba(255,255,255,0.2)',
                      }}
                      transition={{ duration: 0.3 }}
                      style={{ height: 3, borderRadius: 99 }}
                    />
                  ))}
                </div>{/* fin progress */}
              </div>{/* fin content z-1 */}
              </div>{/* fin centre */}

              {/* ── DEUX COLONNES DROITE — une monte, l'autre descend ── */}
              {/* Marquee horizontal — dans le flux, en bas du flex */}
              {isMobile && (() => {
                const ALL_IMGS = [
                  'arrive_en_atelier','ot_30s','process_digitalise','service_transparent',
                  'devis_envoye_instantanement_au_client','retour_vehicule_client','visibilite_dashboard','adopter_atelier_maitre',
                ];
                const doubled = [...ALL_IMGS, ...ALL_IMGS];
                return (
                  <div style={{ overflow: 'hidden', paddingBottom: '1.5rem', flexShrink: 0 }}>
                    <motion.div
                      animate={{ x: ['0%', '-50%'] }}
                      transition={{ duration: 35, repeat: Infinity, ease: 'linear' }}
                      style={{ display: 'flex', gap: '0.625rem', width: 'max-content' }}
                    >
                      {doubled.map((name, i) => (
                        <div key={i} style={{ flexShrink: 0, width: 90, height: 120, borderRadius: 10, overflow: 'hidden', position: 'relative' }}>
                          <Image src={`/landing/text-revealing/${name}.jpg`} alt="" fill sizes="90px" style={{ objectFit: 'cover' }} />
                        </div>
                      ))}
                    </motion.div>
                  </div>
                );
              })()}
              {!isMobile && <div style={{ display: 'flex', gap: '0.625rem', overflow: 'hidden', padding: '0.75rem 0.75rem 0.75rem 0' }}>
                {[
                  {
                    imgs: ['arrive_en_atelier','ot_30s','process_digitalise','service_transparent'],
                    dir: 1, duration: 18,
                  },
                  {
                    imgs: ['devis_envoye_instantanement_au_client','retour_vehicule_client','visibilite_dashboard','adopter_atelier_maitre'],
                    dir: -1, duration: 22,
                  },
                ].map(({ imgs, dir, duration }, colIdx) => {
                  const doubled = [...imgs, ...imgs];
                  return (
                    <div key={colIdx} style={{ flex: 1, overflow: 'hidden' }}>
                      <motion.div
                        animate={dir > 0
                          ? { y: ['0%', '-50%'] }
                          : { y: ['-50%', '0%'] }
                        }
                        transition={{ duration, repeat: Infinity, ease: 'linear' }}
                        style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}
                      >
                        {doubled.map((name, i) => (
                          <div key={i} style={{ borderRadius: 10, overflow: 'hidden', flexShrink: 0, position: 'relative', aspectRatio: '3/4', width: '100%' }}>
                            <Image src={`/landing/text-revealing/${name}.jpg`} alt="" fill sizes="180px" style={{ objectFit: 'cover' }} />
                          </div>
                        ))}
                      </motion.div>
                    </div>
                  );
                })}
              </div>}

            </div>
          </div>
        );
      })()}

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
                onHoverEnd={() => setHoveredRolePhoto(DEFAULT_ROLE_PHOTO)}
                onTap={() => setHoveredRolePhoto(p => p === photo ? DEFAULT_ROLE_PHOTO : photo)}
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
                  background: 'linear-gradient(to top, rgba(10,5,2,0.62) 0%, rgba(10,5,2,0.08) 55%, transparent 100%)',
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

          {(() => {
            const GARAGES = [
              { name: 'Garage Douala — Akwa',       ca: '5 820 000' },
              { name: 'Garage Yaoundé — Bastos',     ca: '4 310 000' },
              { name: 'Garage Bafoussam — Centre',   ca: '2 320 000' },
            ];
            const TOTAL = 12450000;

            function CountUp({ target, inView }: { target: number; inView: boolean }) {
              const [val, setVal] = useState(0);
              useEffect(() => {
                if (!inView) return;
                let start = 0;
                const step = target / 60;
                const id = setInterval(() => {
                  start += step;
                  if (start >= target) { setVal(target); clearInterval(id); }
                  else setVal(Math.floor(start));
                }, 20);
                return () => clearInterval(id);
              }, [inView, target]);
              return <>{String(val).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}</>;
            }

            return (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                style={{ background: C.white, borderRadius: 20, padding: '1.5rem', border: '1px solid rgba(200,81,26,0.1)' }}
              >
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                  <p style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.muted }}>
                    Compte Groupe · Kams Motors
                  </p>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.65rem', fontWeight: 700, color: C.green }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.green, display: 'inline-block' }} />
                    En ligne
                  </span>
                </div>

                {/* Garages — entrent un par un */}
                {GARAGES.map((g, i) => (
                  <motion.div
                    key={g.name}
                    initial={{ opacity: 0, x: 16 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: 0.15 + i * 0.18 }}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '0.875rem 1rem', borderRadius: 10,
                      border: '1px solid rgba(200,81,26,0.08)', marginBottom: '0.625rem',
                      background: C.surface,
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', fontWeight: 600, color: C.earth }}>
                      <Building2 size={16} color={C.muted} />
                      {g.name}
                    </span>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: C.brand }}>{g.ca} XAF</span>
                  </motion.div>
                ))}

                {/* CA total — compteur animé */}
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.7 }}
                  style={{ marginTop: '1.25rem', padding: '1rem', background: C.sand, borderRadius: 10 }}
                >
                  <p style={{ fontSize: '0.78rem', fontWeight: 700, color: C.muted, marginBottom: '0.25rem' }}>CA Groupe · Juin 2026</p>
                  <motion.p
                    style={{ fontFamily: '"Playfair Display", serif', fontSize: '1.75rem', fontWeight: 900, color: C.brand }}
                  >
                    <motion.span
                      initial={{ opacity: 0 }}
                      whileInView={{ opacity: 1 }}
                      viewport={{ once: true }}
                      transition={{ delay: 0.8 }}
                    >
                      {(() => {
                        const [inView, setInView] = useState(false);
                        return (
                          <motion.span
                            onViewportEnter={() => setInView(true)}
                            viewport={{ once: true }}
                          >
                            <CountUp target={TOTAL} inView={inView} /> XAF
                          </motion.span>
                        );
                      })()}
                    </motion.span>
                  </motion.p>
                </motion.div>
              </motion.div>
            );
          })()}
        </div>
      </section>

      {/* ── MOBILE & CONTEXTE — bento grid ── */}
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

          {/* ── BENTO ── */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr',
              gridTemplateRows: 'auto auto auto',
              gap: '0.625rem',
            }}
          >
            {/* Tuile phone — grande, 2×2 */}
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.45, delay: 0.1 }}
              style={{
                gridColumn: '1 / 3', gridRow: '1 / 3',
                background: '#1A1209', borderRadius: 20,
                padding: '1.25rem', display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: '0.75rem',
                minHeight: 260, overflow: 'hidden', position: 'relative',
              }}
            >
              <div style={{
                position: 'absolute', inset: 0,
                background: `radial-gradient(ellipse at 60% 30%, ${C.brand}30 0%, transparent 65%)`,
              }} />
              {/* Mini phone */}
              <div style={{ width: 120, background: '#0e0806', borderRadius: 22, padding: '6px 5px', boxShadow: '0 16px 40px rgba(0,0,0,0.5)', position: 'relative', zIndex: 1 }}>
                <div style={{ width: 44, height: 14, background: '#000', borderRadius: 10, margin: '0 auto 4px' }} />
                <div style={{ borderRadius: 16, overflow: 'hidden' }}>
                  <Image src="/features/workshop-mobile.jpg" alt="Mobile" width={390} height={844} style={{ width: '100%', height: 'auto', display: 'block' }} />
                </div>
                <div style={{ width: 40, height: 3, background: 'rgba(255,255,255,0.2)', borderRadius: 99, margin: '5px auto 1px' }} />
              </div>
              <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'rgba(255,255,255,0.6)', textAlign: 'center', position: 'relative', zIndex: 1 }}>
                Optimisé mobile
              </p>
            </motion.div>

            {/* SMS Orange / MTN */}
            <motion.div
              initial={{ opacity: 0, x: 12 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: 0.15 }}
              style={{ gridColumn: '3', gridRow: '1', background: '#D1FAE5', borderRadius: 16, padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}
            >
              <MessageSquare size={22} color={C.green} />
              <p style={{ fontSize: '0.78rem', fontWeight: 700, color: '#065F46', lineHeight: 1.3 }}>SMS Orange<br />& MTN</p>
            </motion.div>

            {/* XAF */}
            <motion.div
              initial={{ opacity: 0, x: 12 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: 0.22 }}
              style={{ gridColumn: '3', gridRow: '2', background: '#FEF3C7', borderRadius: 16, padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}
            >
              <p style={{ fontFamily: '"Playfair Display", serif', fontSize: '1.4rem', fontWeight: 900, color: C.gold }}>XAF</p>
              <p style={{ fontSize: '0.72rem', fontWeight: 600, color: '#92400E' }}>Francs CFA</p>
            </motion.div>

            {/* TVA 19,25% */}
            <motion.div
              initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.28 }}
              style={{ gridColumn: '1', gridRow: '3', background: '#FEE2C5', borderRadius: 16, padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}
            >
              <p style={{ fontFamily: '"Playfair Display", serif', fontSize: '1.2rem', fontWeight: 900, color: C.brand }}>19,25%</p>
              <p style={{ fontSize: '0.68rem', fontWeight: 600, color: C.brandDeep }}>TVA + timbre</p>
            </motion.div>

            {/* 100% Français */}
            <motion.div
              initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.34 }}
              style={{ gridColumn: '2 / 4', gridRow: '3', background: C.earth, borderRadius: 16, padding: '1rem', display: 'flex', alignItems: 'center', gap: '0.875rem' }}
            >
              <Globe size={20} color={C.goldLight} />
              <div>
                <p style={{ fontSize: '0.82rem', fontWeight: 700, color: '#FFFFFF' }}>Interface 100 % en français</p>
                <p style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.5)' }}>Support inclus</p>
              </div>
            </motion.div>
          </motion.div>
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
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              whileHover={{ y: -8, boxShadow: `0 24px 56px ${C.brand}30` }}
              transition={{ duration: 0.35 }}
              style={{
                background: 'linear-gradient(135deg, #FFF8F4 0%, #FFF3EC 100%)',
                border: `2px solid ${C.brand}`,
                borderRadius: 20, padding: '2rem',
                display: 'flex', flexDirection: 'column', textAlign: 'left',
                position: 'relative', overflow: 'hidden', cursor: 'default',
              }}
            >
              {/* Shimmer décoratif */}
              <div style={{
                position: 'absolute', top: -40, right: -40,
                width: 160, height: 160, borderRadius: '50%',
                background: `radial-gradient(circle, ${C.brand}18 0%, transparent 70%)`,
                pointerEvents: 'none',
              }} />

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <span style={{ background: C.brand, color: '#FFF', fontSize: '0.68rem', fontWeight: 700, padding: '0.25rem 0.75rem', borderRadius: 6, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                  Recommandé
                </span>
                <span style={{ fontSize: '0.68rem', fontWeight: 700, color: C.brand, background: `${C.brand}12`, padding: '0.2rem 0.6rem', borderRadius: 99 }}>
                  Réponse sous 48h
                </span>
              </div>

              <p style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.brand, marginBottom: '0.5rem' }}>Atelier Maître Pro</p>
              <p style={{ fontFamily: '"Playfair Display", serif', fontSize: '2.25rem', fontWeight: 900, color: C.earth, lineHeight: 1 }}>Sur devis</p>
              <p style={{ fontSize: '0.82rem', color: C.muted, marginTop: '0.25rem', marginBottom: '1.5rem' }}>Adapté à vos garages et techniciens</p>

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
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.08 }}
              whileHover={{ y: -8, boxShadow: '0 24px 56px rgba(29,106,74,0.18)' }}
              style={{
                background: C.white,
                border: '1.5px solid rgba(29,106,74,0.2)',
                borderRadius: 20, padding: '2rem',
                display: 'flex', flexDirection: 'column', textAlign: 'left',
                cursor: 'default', position: 'relative', overflow: 'hidden',
              }}
            >
              <div style={{
                position: 'absolute', top: -40, right: -40,
                width: 140, height: 140, borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(29,106,74,0.08) 0%, transparent 70%)',
                pointerEvents: 'none',
              }} />

              <span style={{ display: 'inline-block', background: C.green, color: '#FFF', fontSize: '0.68rem', fontWeight: 700, padding: '0.25rem 0.75rem', borderRadius: 6, marginBottom: '1rem', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                Pilote gratuit
              </span>
              <p style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.green, marginBottom: '0.5rem' }}>Essai pilote</p>
              <p style={{ fontFamily: '"Playfair Display", serif', fontSize: '2.25rem', fontWeight: 900, color: C.earth, lineHeight: 1 }}>Gratuit</p>
              <p style={{ fontSize: '0.82rem', color: C.muted, marginTop: '0.25rem', marginBottom: '1.5rem' }}>Pendant toute la période de test</p>

              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.75rem', flex: 1 }}>
                {['Accès complet à la plateforme', '1 garage, équipe complète', 'Accompagnement au démarrage', 'Données conservées après le pilote', 'Aucune carte bancaire requise'].map((item) => (
                  <CheckItem key={item} color={C.green}>{item}</CheckItem>
                ))}
              </ul>
              <Link href="/inscription" style={{ ...btnPrimary, background: 'transparent', color: C.green, border: `1.5px solid ${C.green}`, marginTop: '1.75rem', justifyContent: 'center' }}>
                <UserPlus size={16} /> Démarrer le pilote
              </Link>
            </motion.div>
          </div>

          {/* Proof bar */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            style={{ marginTop: '2rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1.5rem', flexWrap: 'wrap' }}
          >
            {[
              { Icon: ShieldCheck, text: 'Aucune carte bancaire' },
              { Icon: Wifi,        text: 'Fonctionne sur 3G et hors-ligne' },
              { Icon: Mail,        text: 'Support en français' },
            ].map(({ Icon, text }) => (
              <span key={text} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.78rem', color: C.muted, fontWeight: 500 }}>
                <Icon size={14} color={C.brand} />
                {text}
              </span>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" className={sectionClass} style={{ background: C.white }}>
        <div className="landing-inner landing-grid-2" style={{ alignItems: 'start', gap: '4rem' }}>

          {/* Gauche — titre + CTA */}
          <div style={{ position: isMobile ? 'static' : 'sticky', top: isMobile ? undefined : '6rem' }}>
            <Eyebrow>Questions fréquentes</Eyebrow>
            <SectionHeading>Ce que les garages demandent</SectionHeading>
            <Lead style={{ maxWidth: 360, marginTop: '0.875rem' }}>
              Les réponses aux questions les plus courantes avant une démo.
            </Lead>
            <div style={{ marginTop: '2.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <Link href="/demo" style={{ ...btnPrimary, alignSelf: 'flex-start' }}>
                Réserver une démo <ArrowRight size={15} />
              </Link>
              <p style={{ fontSize: '0.78rem', color: C.muted }}>
                Réponse sous 48h · Support en français
              </p>
            </div>
          </div>

          {/* Droite — accordéon */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
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
          pointerEvents: 'none', y: ctaGlowY,
        }} />

        <div style={{ position: 'relative', zIndex: 2 }}>
          <Eyebrow light>Votre atelier vous attend</Eyebrow>
          <SectionHeading light style={{ marginTop: '0.5rem' }}>
            Structurez votre atelier dès aujourd&apos;hui.
          </SectionHeading>
          <Lead light style={{ maxWidth: 480, margin: '0.875rem auto 0', textAlign: 'center' }}>
            Démo guidée 30 min · En français · Sans engagement
          </Lead>

          {/* CTAs */}
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap', marginTop: '2.5rem' }}>
            <Link href="/demo" style={{ ...btnPrimary, background: C.gold, color: '#1A1209', fontWeight: 700 }}>
              Réserver une démo <ArrowRight size={16} />
            </Link>
            <a
              href="https://wa.me/237690777859?text=Bonjour%2C%20je%20veux%20en%20savoir%20plus%20sur%20Atelier%20Ma%C3%AEtre"
              target="_blank" rel="noopener noreferrer"
              style={{
                ...btnGhost,
                background: 'rgba(37,211,102,0.12)',
                border: '1px solid rgba(37,211,102,0.35)',
                color: '#FFFFFF',
                display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
              }}
            >
              {/* WhatsApp SVG */}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style={{ color: '#25D366' }}>
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              Discuter sur WhatsApp
            </a>
          </div>

          {/* Garanties */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            style={{ marginTop: '2.5rem', display: 'flex', gap: '1.5rem', justifyContent: 'center', flexWrap: 'wrap' }}
          >
            {[
              'Aucune carte bancaire',
              'Fonctionne sur 3G',
              'Annulation à tout moment',
            ].map((g) => (
              <span key={g} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.78rem', color: 'rgba(255,255,255,0.45)', fontWeight: 500 }}>
                <CheckCircle2 size={13} color={C.gold} />
                {g}
              </span>
            ))}
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