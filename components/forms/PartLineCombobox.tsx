'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Loader2, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { stockApi } from '@/lib/api';
import { formatXAF } from '@/lib/utils';

export type PartLineValue = {
  description: string;
  partId: string | null;
  unitPriceXaf: number;
};

interface PartLineComboboxProps {
  value: PartLineValue;
  onChange: (next: PartLineValue) => void;
  disabled?: boolean;
  className?: string;
}

type PartOption = {
  id: string;
  label: string;
  sublabel: string;
  salePriceXaf: number;
};

export function PartLineCombobox({ value, onChange, disabled, className }: PartLineComboboxProps) {
  const [text, setText] = useState(value.description);
  const [options, setOptions] = useState<PartOption[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setText(value.description);
  }, [value.description, value.partId]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const fetchParts = useCallback(async (search: string) => {
    if (search.trim().length < 2) {
      setOptions([]);
      return;
    }
    setLoading(true);
    try {
      const data = await stockApi.listParts({ search: search.trim() }) as any[];
      setOptions(
        (Array.isArray(data) ? data : []).slice(0, 12).map((p) => ({
          id: p.id,
          label: p.nameFr ?? p.name_fr ?? p.reference,
          sublabel: [p.reference, p.qtyAvailable != null ? `Dispo: ${p.qtyAvailable}` : null]
            .filter(Boolean)
            .join(' · '),
          salePriceXaf: Number(p.salePriceXaf ?? p.sale_price_xaf ?? 0),
        })),
      );
    } catch {
      setOptions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open || value.partId) return;
    const t = setTimeout(() => { void fetchParts(text); }, 280);
    return () => clearTimeout(t);
  }, [text, open, value.partId, fetchParts]);

  function selectPart(opt: PartOption) {
    setText(opt.label);
    setOpen(false);
    setOptions([]);
    onChange({
      description: opt.label,
      partId: opt.id,
      unitPriceXaf: opt.salePriceXaf > 0 ? opt.salePriceXaf : value.unitPriceXaf,
    });
  }

  function handleTextChange(next: string) {
    setText(next);
    setOpen(true);
    onChange({
      description: next,
      partId: null,
      unitPriceXaf: value.unitPriceXaf,
    });
  }

  const isAsp = !value.partId && text.trim().length > 0;

  return (
    <div ref={ref} className={cn('relative min-w-0 flex-1', className)}>
      <div className="flex items-center gap-2 min-w-0">
        <div className="relative flex-1 min-w-0">
          <Input
            value={text}
            disabled={disabled}
            placeholder="Rechercher ou saisir une pièce (ASP si hors catalogue)…"
            onChange={(e) => handleTextChange(e.target.value)}
            onFocus={() => { if (!value.partId) setOpen(true); }}
            className={cn(
              'h-8 text-sm bg-transparent border-transparent hover:border-border focus:border-brand focus:bg-muted pr-8',
              value.partId && 'border-brand/30 bg-brand/5',
            )}
          />
          {!value.partId && (
            loading
              ? <Loader2 size={14} className="absolute right-2 top-1/2 -translate-y-1/2 animate-spin text-muted-foreground" />
              : <Search size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          )}
        </div>
        {isAsp && (
          <Badge className="shrink-0 text-[9px] px-1.5 py-0 bg-amber-500/10 text-amber-700 border-amber-500/30 border">
            ASP
          </Badge>
        )}
        {value.partId && (
          <Badge className="shrink-0 text-[9px] px-1.5 py-0 bg-emerald-500/10 text-emerald-700 border-emerald-500/30 border">
            Stock
          </Badge>
        )}
      </div>

      {open && !value.partId && options.length > 0 && (
        <ul className="absolute z-50 left-0 right-0 mt-1 bg-card border border-border rounded-xl shadow-xl max-h-48 overflow-auto">
          {options.map((opt) => (
            <li
              key={opt.id}
              className="px-3 py-2.5 hover:bg-muted cursor-pointer border-b border-border/50 last:border-0"
              onMouseDown={() => selectPart(opt)}
            >
              <p className="text-sm font-medium truncate">{opt.label}</p>
              <p className="text-xs text-muted-foreground truncate">
                {opt.sublabel}
                {opt.salePriceXaf > 0 ? ` · ${formatXAF(opt.salePriceXaf)}` : ''}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
