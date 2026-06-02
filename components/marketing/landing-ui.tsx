'use client';

import Link from 'next/link';
import { useState } from 'react';
import { motion, useScroll, useTransform } from 'motion/react';
import { Wrench, ChevronDown, type LucideIcon } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

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
        'mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-brand/80',
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
  as: Tag = 'h2',
}: {
  children: React.ReactNode;
  className?: string;
  as?: 'h1' | 'h2' | 'h3';
}) {
  return (
    <Tag
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
      className="sticky top-0 z-50 border-b border-slate-200/70 bg-white/75 backdrop-blur-xl backdrop-saturate-150"
    >
      <motion.div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-brand/20 to-transparent"
        style={{ opacity: borderOpacity }}
        aria-hidden
      />
      <div className="mx-auto flex h-[4.25rem] max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link
          href="/"
          className="group flex items-center gap-3 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-brand/35"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand/10 ring-1 ring-brand/10 transition-all duration-300 group-hover:bg-brand/15 group-hover:ring-brand/20">
            <Wrench className="text-brand transition-transform duration-300 group-hover:rotate-[-8deg]" size={22} />
          </div>
          <span className="text-lg font-bold tracking-tight text-slate-800">Atelier Maître</span>
        </Link>
        <nav className="hidden items-center gap-9 md:flex" aria-label="Navigation principale">
          <a href="#fonctionnalites" className={navLinkClass}>
            Fonctionnalités
          </a>
          <a href="#multi-garages" className={navLinkClass}>
            Multi-garages
          </a>
          <a href="#faq" className={navLinkClass}>
            FAQ
          </a>
        </nav>
        <div className="flex items-center gap-2">
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
                'rounded-xl bg-brand text-white shadow-md shadow-brand/15 transition-all duration-200 hover:bg-brand-hover hover:shadow-lg hover:shadow-brand/20',
              )}
            >
              Demander une démo
            </Link>
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
          className="rounded-full border border-slate-200/90 bg-white/70 px-3.5 py-1.5 text-xs font-medium text-slate-600 shadow-sm backdrop-blur-sm"
        >
          {label}
        </li>
      ))}
    </ul>
  );
}

export function PainCard({ children, index }: { children: React.ReactNode; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ delay: index * 0.06, duration: 0.4 }}
      className="group relative overflow-hidden rounded-2xl border border-rose-100/80 bg-gradient-to-br from-rose-50/90 to-white px-5 py-5 text-sm font-medium leading-snug text-rose-900/90 shadow-sm transition-shadow duration-300 hover:shadow-md"
    >
      <span
        className="absolute -right-3 -top-3 h-16 w-16 rounded-full bg-rose-200/30 blur-2xl transition-opacity group-hover:opacity-80"
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
  return (
    <motion.article
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-50px' }}
      transition={{ delay: index * 0.05, duration: 0.45 }}
      className="group relative rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm ring-1 ring-slate-900/[0.03] transition-all duration-300 hover:-translate-y-0.5 hover:border-brand/25 hover:shadow-lg hover:shadow-brand/5"
    >
      <div
        className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-brand/30 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        aria-hidden
      />
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand/10 ring-1 ring-brand/10 transition-all duration-300 group-hover:bg-brand/15 group-hover:ring-brand/20">
        <Icon className="text-brand transition-transform duration-300 group-hover:scale-110" size={22} strokeWidth={1.75} />
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
        open ? 'border-brand/25 shadow-sm shadow-brand/5' : 'border-slate-200/90 hover:border-slate-300',
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
      className={cn('mx-auto flex max-w-6xl items-center gap-3 px-4 py-2 sm:px-6', className)}
      aria-hidden
    >
      <div className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-200 to-transparent" />
      <div className="h-1.5 w-1.5 rounded-full bg-brand/30" />
      <div className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-200 to-transparent" />
    </div>
  );
}

export function LandingFooter() {
  return (
    <footer className="border-t border-slate-200/80 bg-white px-4 py-8 sm:px-6">
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
          <p className="mt-2">
            <a
              href="mailto:contact@atelier2026.cm"
              className="font-medium text-brand/90 transition-colors hover:text-brand"
            >
              contact@atelier2026.cm
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
