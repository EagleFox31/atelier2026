'use client';

import Link from 'next/link';
import { useState } from 'react';
import { motion, useScroll, useTransform } from 'motion/react';
import { BrandCalligraphy } from '@/components/marketing/brand-calligraphy';
import { Wrench, ChevronDown, type LucideIcon } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { FEATURE_ACCENTS, PAIN_CARD_STYLES } from '@/components/marketing/landing-accents';
import { LandingKenteBar } from '@/components/marketing/LandingKenteBar';
import { InstallAppHeaderLink } from '@/components/pwa/InstallAppButton';

/** Lien nav avec soulignement progressif */
export const navLinkClass =
  'relative text-[0.9375rem] text-slate-600 transition-colors duration-200 hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30 focus-visible:rounded-sm after:absolute after:-bottom-1 after:left-0 after:h-px after:w-0 after:bg-brand after:transition-[width] after:duration-300 hover:after:w-full';

export function SectionEyebrow({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cn(
        'mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--afrique-earth)]',
        className,
      )}
    >
      {children}
    </p>
  );
}

export function SectionTitle({
  children,
  className,
  id,
  as: Tag = 'h2',
}: {
  children: React.ReactNode;
  className?: string;
  id?: string;
  as?: 'h1' | 'h2' | 'h3';
}) {
  return (
    <Tag
      id={id}
      className={cn(
        'text-balance font-bold tracking-tight text-slate-800',
        Tag === 'h1' && 'text-4xl sm:text-5xl lg:text-[3.25rem] lg:leading-[1.08]',
        Tag === 'h2' && 'text-2xl sm:text-3xl',
        Tag === 'h3' && 'text-xl',
        className,
      )}
    >
      {children}
    </Tag>
  );
}

export function SectionLead({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={cn('mt-3 max-w-2xl text-pretty text-lg leading-relaxed text-slate-600', className)}>
      {children}
    </p>
  );
}

export function LandingHeader() {
  const { scrollY } = useScroll();
  const shadow = useTransform(scrollY, [0, 48], ['0 0 0 transparent', '0 8px 32px rgba(15,23,42,0.06)']);
  const borderOpacity = useTransform(scrollY, [0, 48], [0.5, 1]);

  return (
    <motion.header
      style={{ boxShadow: shadow }}
      className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl backdrop-saturate-150"
    >
      <LandingKenteBar />
      <div className="relative border-b border-slate-200/60">
        <motion.div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-[var(--afrique-gold)]/40 via-brand/25 to-[var(--afrique-forest)]/40"
          style={{ opacity: borderOpacity }}
          aria-hidden
        />
        <div className="mx-auto flex h-[4.25rem] max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link
          href="/"
          className="group flex items-center gap-3 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-brand/35"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand/15 to-[var(--afrique-gold-soft)] ring-1 ring-[var(--afrique-gold)]/20 transition-all duration-300 group-hover:ring-[var(--afrique-gold)]/35">
            <Wrench className="text-brand transition-transform duration-300 group-hover:rotate-[-8deg]" size={22} />
          </div>
          <span className="text-lg font-bold tracking-tight text-slate-800">Atelier Maître</span>
        </Link>
        <nav className="hidden items-center gap-9 md:flex" aria-label="Navigation principale">
          <a href="#fonctionnalites" className={navLinkClass}>
            Fonctionnalités
          </a>
          <a href="#comment-ca-marche" className={navLinkClass}>
            Démarrage
          </a>
          <a href="#tarifs" className={navLinkClass}>
            Tarifs
          </a>
          <a href="#faq" className={navLinkClass}>
            FAQ
          </a>
        </nav>
        <div className="flex items-center gap-2">
          <InstallAppHeaderLink />
          <Link
            href="/inscription"
            className={cn(
              buttonVariants({ variant: 'ghost' }),
              'hidden text-[var(--afrique-earth)] sm:inline-flex',
            )}
          >
            Créer un atelier
          </Link>
          <Link
            href="/login"
            className={cn(buttonVariants({ variant: 'ghost' }), 'hidden text-slate-600 sm:inline-flex')}
          >
            Connexion
          </Link>
            <Link
              href="/demo"
              className={cn(
                buttonVariants(),
                'rounded-xl bg-brand text-white shadow-md shadow-brand/15 ring-1 ring-[var(--afrique-gold)]/25 transition-all duration-200 hover:bg-brand-hover hover:shadow-lg',
              )}
            >
              Demander une démo
            </Link>
        </div>
        </div>
      </div>
    </motion.header>
  );
}

export function TrustPills({ items }: { items: string[] }) {
  return (
    <ul className="mt-6 flex flex-wrap gap-2">
      {items.map((label) => (
        <li
          key={label}
          className="rounded-full border border-[var(--afrique-gold)]/20 bg-white/80 px-3.5 py-1.5 text-xs font-medium text-slate-600 shadow-sm backdrop-blur-sm"
        >
          {label}
        </li>
      ))}
    </ul>
  );
}

export function PainCard({ children, index }: { children: React.ReactNode; index: number }) {
  const style = PAIN_CARD_STYLES[index % PAIN_CARD_STYLES.length];
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ delay: index * 0.06, duration: 0.4 }}
      className={cn(
        'group relative overflow-hidden rounded-2xl border px-5 py-5 text-sm font-medium leading-snug shadow-sm transition-shadow duration-300 hover:shadow-md',
        style,
      )}
    >
      <span
        className="absolute -right-3 -top-3 h-16 w-16 rounded-full bg-[var(--afrique-gold)]/15 blur-2xl transition-opacity group-hover:opacity-90"
        aria-hidden
      />
      <span className="relative">{children}</span>
    </motion.div>
  );
}

export function FeatureCard({
  icon: Icon,
  title,
  desc,
  index,
}: {
  icon: LucideIcon;
  title: string;
  desc: string;
  index: number;
}) {
  const accent = FEATURE_ACCENTS[index % FEATURE_ACCENTS.length];
  return (
    <motion.article
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-50px' }}
      transition={{ delay: index * 0.05, duration: 0.45 }}
      className={cn(
        'group relative rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm ring-1 ring-slate-900/[0.03] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg',
        accent.hoverBorder,
      )}
    >
      <div
        className={cn(
          'absolute inset-x-6 top-0 h-px opacity-0 transition-opacity duration-300 group-hover:opacity-100',
          accent.hoverBar,
        )}
        aria-hidden
      />
      <div
        className={cn(
          'flex h-12 w-12 items-center justify-center rounded-2xl ring-1 transition-all duration-300',
          accent.iconBox,
        )}
      >
        <Icon className={cn('transition-transform duration-300 group-hover:scale-110', accent.icon)} size={22} strokeWidth={1.75} />
      </div>
      <h3 className="mt-5 text-lg font-semibold text-slate-800">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">{desc}</p>
    </motion.article>
  );
}

export function FaqItem({ q, a, index }: { q: string; a: string; index: number }) {
  const [open, setOpen] = useState(index === 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.05 }}
      className={cn(
        'overflow-hidden rounded-2xl border bg-white transition-colors duration-200',
        open ? 'border-[var(--afrique-gold)]/30 shadow-sm shadow-[var(--afrique-gold)]/10' : 'border-slate-200/90 hover:border-[var(--afrique-terracotta)]/25',
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand/35"
        aria-expanded={open}
      >
        <span className="text-base font-semibold text-slate-800 sm:text-lg">{q}</span>
        <ChevronDown
          size={20}
          className={cn('shrink-0 text-slate-400 transition-transform duration-300', open && 'rotate-180 text-brand')}
        />
      </button>
      <div
        className={cn(
          'grid transition-[grid-template-rows] duration-300 ease-out',
          open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
        )}
      >
        <div className="overflow-hidden">
          <p className="border-t border-slate-100 px-5 pb-5 pt-3 text-pretty text-sm leading-relaxed text-slate-600 sm:text-[0.9375rem]">
            {a}
          </p>
        </div>
      </div>
    </motion.div>
  );
}

export function SectionDivider({ className }: { className?: string }) {
  return (
    <div
      className={cn('mx-auto flex max-w-6xl items-center gap-2 px-4 py-2 sm:px-6', className)}
      aria-hidden
    >
      <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[var(--afrique-terracotta)]/30 to-transparent" />
      <div className="flex gap-1">
        <span className="h-1.5 w-1.5 rounded-full bg-[var(--afrique-gold)]" />
        <span className="h-1.5 w-1.5 rounded-full bg-brand" />
        <span className="h-1.5 w-1.5 rounded-full bg-[var(--afrique-forest)]" />
      </div>
      <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[var(--afrique-terracotta)]/30 to-transparent" />
    </div>
  );
}

export function LandingFooter() {
  return (
    <footer className="border-t border-[var(--afrique-gold)]/20 bg-gradient-to-b from-white to-[var(--afrique-cream)] px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col items-center justify-between gap-8 sm:flex-row sm:items-start">
          <div className="text-center sm:text-left">
            <Link href="/" className="inline-flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand/10">
                <Wrench className="text-brand" size={18} />
              </div>
              <span className="font-bold text-slate-800">Atelier Maître</span>
            </Link>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-slate-500">
              Logiciel de gestion d&apos;atelier automobile — Cameroun &amp; CEMAC.
            </p>
          </div>
          <nav className="flex flex-wrap justify-center gap-x-8 gap-y-2 text-sm text-slate-600 sm:justify-end">
            <a href="#fonctionnalites" className="transition-colors hover:text-brand">
              Fonctionnalités
            </a>
            <a href="#multi-garages" className="transition-colors hover:text-brand">
              Multi-garages
            </a>
            <a href="#faq" className="transition-colors hover:text-brand">
              FAQ
            </a>
            <Link href="/login" className="transition-colors hover:text-brand">
              Connexion
            </Link>
          </nav>
        </div>
        <div className="mt-8 border-t border-slate-100 pt-6 text-center text-sm text-slate-500">
          <p>© {new Date().getFullYear()} Atelier Maître · Douala, Cameroun</p>
          <p className="mt-1 text-sm text-slate-400 flex items-baseline justify-center gap-1.5">
            <BrandCalligraphy className="text-[1.3em] text-slate-400">by</BrandCalligraphy>
            <span className="font-semibold text-slate-500 tracking-wide text-xs">Trigenys Group</span>
          </p>
        </div>
      </div>
    </footer>
  );
}
