'use client';

import { Car, Wrench, Cog } from 'lucide-react';
import { motion, useTransform, useReducedMotion, type MotionValue } from 'motion/react';

interface LandingHeroBackgroundProps {
  scrollYProgress: MotionValue<number>;
}

/** Décor hero avec parallax au scroll (vitesses différentes par couche). */
export function LandingHeroBackground({ scrollYProgress }: LandingHeroBackgroundProps) {
  const reduceMotion = useReducedMotion();

  const gridY = useTransform(scrollYProgress, [0, 1], reduceMotion ? [0, 0] : [0, 90]);
  const linesY = useTransform(scrollYProgress, [0, 1], reduceMotion ? [0, 0] : [0, 50]);
  const haloY = useTransform(scrollYProgress, [0, 1], reduceMotion ? [0, 0] : [0, -40]);
  const haloScale = useTransform(scrollYProgress, [0, 1], reduceMotion ? [1, 1] : [1, 1.12]);

  const orbLeftY = useTransform(scrollYProgress, [0, 1], reduceMotion ? [0, 0] : [0, 140]);
  const orbRightY = useTransform(scrollYProgress, [0, 1], reduceMotion ? [0, 0] : [0, 100]);
  const orbRightX = useTransform(scrollYProgress, [0, 1], reduceMotion ? [0, 0] : [0, -30]);
  const orbBottomY = useTransform(scrollYProgress, [0, 1], reduceMotion ? [0, 0] : [0, 80]);

  const ringsY = useTransform(scrollYProgress, [0, 1], reduceMotion ? [0, 0] : [0, 120]);
  const ringsRotate = useTransform(scrollYProgress, [0, 1], reduceMotion ? [0, 0] : [0, 18]);

  const wrenchY = useTransform(scrollYProgress, [0, 1], reduceMotion ? [0, 0] : [0, 160]);
  const wrenchRotate = useTransform(scrollYProgress, [0, 1], reduceMotion ? [-18, -18] : [-18, -28]);
  const carY = useTransform(scrollYProgress, [0, 1], reduceMotion ? [0, 0] : [0, 110]);
  const carX = useTransform(scrollYProgress, [0, 1], reduceMotion ? [0, 0] : [0, 24]);
  const cogY = useTransform(scrollYProgress, [0, 1], reduceMotion ? [0, 0] : [0, 200]);
  const cogRotate = useTransform(scrollYProgress, [0, 1], reduceMotion ? [12, 12] : [12, 48]);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <div className="absolute inset-0 bg-gradient-to-br from-[var(--afrique-sky)] via-[var(--afrique-sand)] to-[var(--afrique-cream)]" />

      <motion.div className="absolute inset-0 opacity-[0.22]" style={{ y: gridY }}>
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              'radial-gradient(circle, var(--afrique-gold) 1px, transparent 1px)',
            backgroundSize: '22px 22px',
            maskImage: 'radial-gradient(ellipse 85% 75% at 50% 35%, black 20%, transparent 72%)',
            WebkitMaskImage:
              'radial-gradient(ellipse 85% 75% at 50% 35%, black 20%, transparent 72%)',
          }}
        />
      </motion.div>

      <motion.div className="absolute inset-0 opacity-[0.025]" style={{ y: linesY }}>
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `
              linear-gradient(to right, var(--afrique-forest) 1px, transparent 1px),
              linear-gradient(to bottom, var(--afrique-terracotta) 1px, transparent 1px)
            `,
            backgroundSize: '64px 64px',
            maskImage: 'linear-gradient(to bottom, black 0%, transparent 85%)',
            WebkitMaskImage: 'linear-gradient(to bottom, black 0%, transparent 85%)',
          }}
        />
      </motion.div>

      <motion.div
        className="absolute inset-0 opacity-55"
        style={{ y: haloY, scale: haloScale }}
      >
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse 95% 55% at 42% -8%, rgba(29, 111, 164, 0.18) 0%, transparent 45%), radial-gradient(ellipse 70% 40% at 90% 20%, rgba(212, 160, 23, 0.12) 0%, transparent 50%)',
          }}
        />
      </motion.div>

      <motion.div
        className="absolute -left-28 top-24 h-[26rem] w-[26rem] rounded-full blur-3xl"
        style={{ y: orbLeftY, background: 'rgba(212, 160, 23, 0.14)' }}
      />
      <motion.div
        className="absolute -right-24 top-8 h-80 w-80 rounded-full blur-3xl"
        style={{ y: orbRightY, x: orbRightX, background: 'rgba(31, 107, 69, 0.12)' }}
      />
      <motion.div
        className="absolute bottom-0 left-1/2 h-72 w-[36rem] -translate-x-1/2 rounded-full blur-3xl"
        style={{ y: orbBottomY, background: 'rgba(196, 105, 58, 0.1)' }}
      />

      <motion.svg
        className="absolute -right-16 top-1/2 hidden h-[520px] w-[520px] -translate-y-1/2 text-[var(--afrique-gold)] opacity-[0.09] lg:block"
        viewBox="0 0 520 520"
        fill="none"
        style={{ y: ringsY, rotate: ringsRotate }}
      >
        <circle cx="260" cy="260" r="248" stroke="currentColor" strokeWidth="1" />
        <circle cx="260" cy="260" r="190" stroke="currentColor" strokeWidth="1" strokeDasharray="6 10" />
        <circle cx="260" cy="260" r="128" stroke="currentColor" strokeWidth="1" />
        <circle cx="260" cy="260" r="72" stroke="currentColor" strokeWidth="1" strokeDasharray="4 8" />
      </motion.svg>

      <motion.div
        className="absolute left-[6%] top-[22%] hidden sm:block"
        style={{ y: wrenchY, rotate: wrenchRotate }}
      >
        <Wrench className="h-20 w-20 text-[var(--afrique-brand)] opacity-[0.07]" strokeWidth={1.25} />
      </motion.div>
      <motion.div
        className="absolute right-[8%] top-[14%] hidden md:block"
        style={{ y: carY, x: carX }}
      >
        <Car className="h-24 w-24 rotate-6 text-[var(--afrique-forest)] opacity-[0.07]" strokeWidth={1.25} />
      </motion.div>
      <motion.div
        className="absolute bottom-[18%] left-[10%] hidden lg:block"
        style={{ y: cogY, rotate: cogRotate }}
      >
        <Cog className="h-16 w-16 text-[var(--afrique-terracotta)] opacity-[0.08]" strokeWidth={1.25} />
      </motion.div>

      <div className="absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-[var(--afrique-sand)] via-[var(--afrique-sand)]/90 to-transparent" />
    </div>
  );
}
