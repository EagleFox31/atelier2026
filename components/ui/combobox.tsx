'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Check, Search, Loader2, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';

interface ComboboxOption {
  id:       string;
  label:    string;
  sublabel?: string;
}

interface ComboboxProps {
  placeholder?:  string;
  disabled?:     boolean;
  value?:        string;                     // id sélectionné
  onChange?:     (id: string | null, option: ComboboxOption | null) => void;
  fetchOptions:  (search: string) => Promise<ComboboxOption[]>;
  initialOption?: ComboboxOption;            // affiche le label sans fetch
  debounce?:     number;
  className?:    string;
  /** Longueur minimale avant recherche / état vide (défaut 2). */
  minSearchLength?: number;
  /** Panneau affiché sous le champ quand la recherche ne retourne aucun résultat. */
  renderNoResults?: (search: string) => React.ReactNode;
}

export function Combobox({
  placeholder = 'Rechercher...',
  disabled,
  value,
  onChange,
  fetchOptions,
  initialOption,
  debounce = 300,
  className,
  minSearchLength = 2,
  renderNoResults,
}: ComboboxProps) {
  const [search, setSearch]         = useState('');
  const [options, setOptions]       = useState<ComboboxOption[]>([]);
  const [selected, setSelected]     = useState<ComboboxOption | null>(initialOption ?? null);
  const [open, setOpen]             = useState(false);
  const [loading, setLoading]       = useState(false);
  const [noResults, setNoResults]   = useState(false);
  const ref                         = useRef<HTMLDivElement>(null);

  // Sync selected depuis value externe
  useEffect(() => {
    if (!value) { setSelected(null); setSearch(''); }
  }, [value]);

  // Fermer si clic à l'extérieur
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Fetch avec debounce
  useEffect(() => {
    if (!search || search.length < minSearchLength) {
      setOptions([]);
      setNoResults(false);
      return;
    }
    const t = setTimeout(async () => {
      setLoading(true);
      setNoResults(false);
      try {
        const data = await fetchOptions(search);
        setOptions(data);
        setNoResults(data.length === 0);
        setOpen(true);
      } catch {
        setOptions([]);
        setNoResults(false);
      } finally {
        setLoading(false);
      }
    }, debounce);
    return () => clearTimeout(t);
  }, [search, fetchOptions, debounce, minSearchLength]);

  function select(opt: ComboboxOption) {
    setSelected(opt);
    setSearch('');
    setOpen(false);
    setNoResults(false);
    onChange?.(opt.id, opt);
  }

  function clear(e: React.MouseEvent) {
    e.stopPropagation();
    setSelected(null);
    setSearch('');
    setOptions([]);
    setNoResults(false);
    onChange?.(null, null);
  }

  const showNoResultsPanel =
    !selected &&
    !loading &&
    noResults &&
    search.length >= minSearchLength &&
    !!renderNoResults;

  return (
    <div ref={ref} className={cn('relative', className)}>
      {selected ? (
        <div className="flex items-center justify-between px-3 py-2 bg-brand/5 border border-brand/30 rounded-lg">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">{selected.label}</p>
            {selected.sublabel && <p className="text-xs text-muted-foreground truncate">{selected.sublabel}</p>}
          </div>
          {!disabled && (
            <button type="button" onClick={clear} className="ml-2 shrink-0 text-muted-foreground hover:text-red-500 transition-colors">
              <X size={14} />
            </button>
          )}
        </div>
      ) : (
        <div className="relative">
          <Input
            placeholder={placeholder}
            value={search}
            disabled={disabled}
            onChange={e => { setSearch(e.target.value); setOpen(true); }}
            onFocus={() => { if (search) setOpen(true); }}
            className="pr-8"
          />
          {loading
            ? <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-muted-foreground" />
            : <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          }
        </div>
      )}

      <AnimatePresence>
        {open && options.length > 0 && (
          <motion.ul
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.12 }}
            className="absolute z-[120] w-full mt-1 bg-card border border-border rounded-xl shadow-xl max-h-52 overflow-auto"
          >
            {options.map(opt => (
              <li key={opt.id}
                className="flex items-center justify-between px-4 py-2.5 hover:bg-muted cursor-pointer"
                onMouseDown={() => select(opt)}
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{opt.label}</p>
                  {opt.sublabel && <p className="text-xs text-muted-foreground truncate">{opt.sublabel}</p>}
                </div>
                <Check size={14} className="text-brand shrink-0 ml-2" />
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>

      {showNoResultsPanel && (
        <div className="mt-3 rounded-xl border border-dashed border-brand/40 bg-brand/5 p-4">
          <p className="text-xs text-muted-foreground mb-3">
            Aucun résultat pour « <span className="font-medium text-foreground">{search}</span> »
          </p>
          {renderNoResults(search)}
        </div>
      )}
    </div>
  );
}
