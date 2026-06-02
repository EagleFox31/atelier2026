'use client';

import { useRef, type ReactNode } from 'react';
import { motion, useScroll, useTransform, useReducedMotion } from 'motion/react';

interface LandingParallaxSectionProps {
  children: ReactNode;
  className?: string;
  id?: string;
  /** Décalage vertical du contenu (px) entre entrée et sortie de vue */
  contentShift?: number;
  /** Fond décoratif optionnel (ex. section bleue multi-garages) */
  decor?: boolean;
}

/** Section avec léger parallax vertical du contenu au scroll. */
export function LandingParallaxSection({
  children,
  className,
  id,
  contentShift = 24,
  decor = false,
}: LandingParallaxSectionProps) {
  const ref = useRef<HTMLElement>(null);
  const reduceMotion = useReducedMotion();

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  });

  const contentY = useTransform(
    scrollYProgress,
    [0, 1],
    reduceMotion ? [0, 0] : [contentShift, -contentShift],
  );

  const decorY = useTransform(scrollYProgress, [0, 1], reduceMotion ? [0, 0] : [-60, 80]);
  const decorX = useTransform(scrollYProgress, [0, 1], reduceMotion ? [0, 0] : [0, 40]);
  const decorY2 = useTransform(scrollYProgress, [0, 1], reduceMotion ? [0, 0] : [40, -70]);

  return (
    <section ref={ref} id={id} className={`relative overflow-hidden ${className ?? ''}`}>
      {decor && (
        <>
          <motion.div
            className="pointer-events-none absolute -left-20 top-1/4 h-64 w-64 rounded-full bg-white/[0.08] blur-3xl"
            style={{ y: decorY, x: decorX }}
            aria-hidden
          />
          <motion.div
            className="pointer-events-none absolute -right-16 bottom-1/4 h-80 w-80 rounded-full bg-sky-300/[0.12] blur-3xl"
            style={{ y: decorY2 }}
            aria-hidden
          />
        </>
      )}
      <motion.div className="relative z-10" style={{ y: contentY }}>
        {children}
      </motion.div>
    </section>
  );
}
