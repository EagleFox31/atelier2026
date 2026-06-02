'use client';

import React from 'react';
import { Wrench } from 'lucide-react';

interface LoaderProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
}

export function Loader({ className, size = 'md', showText = true }: LoaderProps) {
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
        {/* Glow background effect */}
        <div className="absolute inset-0 bg-brand/10 rounded-full blur-xl animate-pulse" />

        {/* Outer Rotating Gear Track */}
        <svg
          className="absolute inset-0 w-full h-full text-brand/20 animate-[spin_10s_linear_infinite]"
          viewBox="0 0 100 100"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Inner ring */}
          <circle cx="50" cy="50" r="38" stroke="currentColor" strokeWidth="2" strokeDasharray="6 6" />
          {/* Outer Ring */}
          <circle cx="50" cy="50" r="44" stroke="currentColor" strokeWidth="1" />
        </svg>

        {/* Animated Spin Ring (Gradient track) */}
        <svg
          className="absolute inset-0 w-full h-full animate-spin text-brand"
          viewBox="0 0 100 100"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="loader-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="var(--color-brand, #3b82f6)" stopOpacity="1" />
              <stop offset="100%" stopColor="var(--color-brand, #3b82f6)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <circle
            cx="50"
            cy="50"
            r="41"
            stroke="url(#loader-grad)"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeDasharray="80 180"
          />
        </svg>

        {/* Center Wrench Icon with wiggle/oscillating animation */}
        <div className="absolute flex items-center justify-center text-brand animate-[wiggle_1.5s_ease-in-out_infinite]">
          <Wrench size={iconSizes[size]} className="transform -rotate-45" />
        </div>
      </div>

      {showText && (
        <div className="flex flex-col items-center gap-1 select-none">
          <span className="text-sm font-bold tracking-wider text-foreground/80 uppercase animate-pulse">
            Atelier<span className="text-brand"> Maître</span>
          </span>
          <span className="text-[10px] text-muted-foreground font-medium tracking-wide">
            Chargement en cours...
          </span>
        </div>
      )}

      {/* Inject custom Tailwind animations directly if not defined in config */}
      <style jsx global>{`
        @keyframes wiggle {
          0%, 100% { transform: rotate(-5deg); }
          50% { transform: rotate(15deg); }
        }
      `}</style>
    </div>
  );
}
