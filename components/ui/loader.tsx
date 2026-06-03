'use client';

import React, { useId } from 'react';
import { Wrench } from 'lucide-react';
import { LANDING_COLORS as C } from '@/components/marketing/landing-colors';

interface LoaderProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
}

export function Loader({ className, size = 'md', showText = true }: LoaderProps) {
  const gradId = useId().replace(/:/g, '');

  const sizeClasses = {
    sm: 'w-12 h-12',
    md: 'w-20 h-20',
    lg: 'w-32 h-32',
  };

  const iconSizes = {
    sm: 16,
    md: 24,
    lg: 40,
  };

  return (
    <div className={`flex flex-col items-center justify-center gap-4 ${className || ''}`}>
      <div className={`relative ${sizeClasses[size]} flex items-center justify-center`}>
        <div
          className="absolute inset-0 rounded-full blur-xl animate-pulse"
          style={{ background: `${C.brand}22` }}
        />

        <svg
          className="absolute inset-0 h-full w-full animate-[spin_10s_linear_infinite]"
          viewBox="0 0 100 100"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          style={{ color: `${C.gold}44` }}
        >
          <circle cx="50" cy="50" r="38" stroke="currentColor" strokeWidth="2" strokeDasharray="6 6" />
          <circle cx="50" cy="50" r="44" stroke="currentColor" strokeWidth="1" />
        </svg>

        <svg
          className="absolute inset-0 h-full w-full animate-spin"
          viewBox="0 0 100 100"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={C.brand} stopOpacity="1" />
              <stop offset="55%" stopColor={C.gold} stopOpacity="1" />
              <stop offset="100%" stopColor={C.brand} stopOpacity="0.15" />
            </linearGradient>
          </defs>
          <circle
            cx="50"
            cy="50"
            r="41"
            stroke={`url(#${gradId})`}
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeDasharray="80 180"
          />
        </svg>

        <div
          className="absolute flex animate-[wiggle_1.5s_ease-in-out_infinite] items-center justify-center"
          style={{ color: C.brand }}
        >
          <Wrench size={iconSizes[size]} className="-rotate-45" strokeWidth={2.25} />
        </div>
      </div>

      {showText && (
        <div className="flex select-none flex-col items-center gap-1">
          <span className="animate-pulse text-sm font-bold uppercase tracking-wider text-foreground/80">
            Atelier
            <span style={{ color: C.brand }}> Maître</span>
          </span>
          <span className="text-[10px] font-medium tracking-wide text-muted-foreground">
            Chargement en cours...
          </span>
        </div>
      )}

      <style jsx global>{`
        @keyframes wiggle {
          0%,
          100% {
            transform: rotate(-5deg);
          }
          50% {
            transform: rotate(15deg);
          }
        }
      `}</style>
    </div>
  );
}
