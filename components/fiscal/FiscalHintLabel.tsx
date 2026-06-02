'use client';

import type { ReactNode } from 'react';
import { CircleHelp } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { FISCAL_HINTS, type FiscalHintId } from '@/lib/fiscal-hints';
import { cn } from '@/lib/utils';

interface FiscalHintLabelProps {
  children: ReactNode;
  hint: FiscalHintId;
  className?: string;
}

/** Libellé inline avec icône ? et infobulle (TVA, timbre, etc.). */
export function FiscalHintLabel({ children, hint, className }: FiscalHintLabelProps) {
  const { title, body } = FISCAL_HINTS[hint];

  return (
    <span className={cn('inline-flex items-center gap-1', className)}>
      {children}
      <Tooltip>
        <TooltipTrigger
          type="button"
          className="inline-flex shrink-0 rounded-full text-muted-foreground/80 hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring print:hidden"
          aria-label={`Aide : ${title}`}
          onClick={(e) => e.stopPropagation()}
        >
          <CircleHelp className="size-3.5" aria-hidden />
        </TooltipTrigger>
        <TooltipContent
          side="top"
          className="z-[120] max-w-[18rem] whitespace-normal text-left leading-snug"
        >
          <span className="font-medium">{title}</span>
          <span className="mt-1 block font-normal opacity-90">{body}</span>
        </TooltipContent>
      </Tooltip>
    </span>
  );
}
