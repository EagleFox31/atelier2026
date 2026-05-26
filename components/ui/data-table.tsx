'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronUp, ChevronDown, ChevronsUpDown, SearchX } from 'lucide-react';
// Note : on n'utilise PAS le composant shadcn <Table> ici car son wrapper
// interne ajoute overflow-x-auto qui piège position:sticky sur le thead.
// On utilise du HTML natif avec les mêmes classes Tailwind.

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DataTableColumn<T = any> {
  key: string;
  label: string;
  sortable?: boolean;
  className?: string;
  headerClassName?: string;
  /** Valeur utilisée pour le tri quand render() est défini */
  sortValue?: (row: T) => string | number | Date | null | undefined;
  /** Rendu personnalisé de la cellule. Si absent, affiche row[key] */
  render?: (row: T, index: number) => React.ReactNode;
}

export interface DataTableProps<T = any> {
  columns: DataTableColumn<T>[];
  data: T[];
  loading?: boolean;
  skeletonRows?: number;
  keyExtractor: (row: T) => string;
  onRowClick?: (row: T) => void;
  maxHeight?: string;
  emptyMessage?: string;
  emptyIcon?: React.ReactNode;
  className?: string;
  rowClassName?: (row: T) => string;
}

type SortDir = 'asc' | 'desc' | null;

// ─── Icône de tri ─────────────────────────────────────────────────────────────

function SortIcon({ dir }: { dir: SortDir }) {
  if (dir === 'asc')  return <ChevronUp  size={14} className="text-brand" />;
  if (dir === 'desc') return <ChevronDown size={14} className="text-brand" />;
  return <ChevronsUpDown size={14} className="text-slate-400 opacity-50" />;
}

// ─── Composant principal ──────────────────────────────────────────────────────

export function DataTable<T = any>({
  columns,
  data,
  loading = false,
  skeletonRows = 5,
  keyExtractor,
  onRowClick,
  maxHeight = 'calc(100vh - 320px)',
  emptyMessage = 'Aucun résultat',
  emptyIcon,
  className,
  rowClassName,
}: DataTableProps<T>) {
  const [sortKey, setSortKey]   = React.useState<string | null>(null);
  const [sortDir, setSortDir]   = React.useState<SortDir>(null);

  // ── Gestion du tri ──────────────────────────────────────────────────────────
  function handleSort(col: DataTableColumn<T>) {
    if (!col.sortable) return;
    if (sortKey !== col.key) {
      setSortKey(col.key);
      setSortDir('asc');
    } else if (sortDir === 'asc') {
      setSortDir('desc');
    } else {
      setSortKey(null);
      setSortDir(null);
    }
  }

  // ── Données triées ──────────────────────────────────────────────────────────
  const sorted = React.useMemo(() => {
    if (!sortKey || !sortDir) return data;

    const col = columns.find(c => c.key === sortKey);
    if (!col) return data;

    return [...data].sort((a, b) => {
      const valA = col.sortValue ? col.sortValue(a) : (a as any)[col.key];
      const valB = col.sortValue ? col.sortValue(b) : (b as any)[col.key];

      if (valA == null && valB == null) return 0;
      if (valA == null) return 1;
      if (valB == null) return -1;

      let cmp: number;
      if (valA instanceof Date || valB instanceof Date) {
        cmp = new Date(valA as any).getTime() - new Date(valB as any).getTime();
      } else if (typeof valA === 'number' && typeof valB === 'number') {
        cmp = valA - valB;
      } else {
        cmp = String(valA).localeCompare(String(valB), 'fr', { sensitivity: 'base' });
      }

      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [data, sortKey, sortDir, columns]);

  // ── Rendu ───────────────────────────────────────────────────────────────────
  // Le scroll est sur CE div (overflow-x ET overflow-y).
  // thead a sticky top-0 dont le contexte est exactement ce div — ça fonctionne.
  return (
    <div
      className={cn('relative w-full overflow-auto rounded-md', className)}
      style={{ maxHeight }}
    >
      <table className="w-full caption-bottom text-sm">

        {/* Header sticky — fonctionne car le scroll est sur le div parent direct */}
        <thead className="sticky top-0 z-10 bg-muted/50 [&_tr]:border-b">
          <tr>
            {columns.map(col => (
              <th
                key={col.key}
                className={cn(
                  'h-10 px-2 text-left align-middle font-bold whitespace-nowrap text-foreground',
                  'select-none',
                  col.sortable && 'cursor-pointer hover:text-foreground/80',
                  col.headerClassName,
                )}
                onClick={() => handleSort(col)}
              >
                <span className="inline-flex items-center gap-1">
                  {col.label}
                  {col.sortable && (
                    <SortIcon dir={sortKey === col.key ? sortDir : null} />
                  )}
                </span>
              </th>
            ))}
          </tr>
        </thead>

        <tbody className="[&_tr:last-child]:border-0">

          {/* Skeletons */}
          {loading && Array.from({ length: skeletonRows }).map((_, i) => (
            <tr key={`sk-${i}`} className="border-b">
              {columns.map(col => (
                <td key={col.key} className={cn('p-2 align-middle', col.className)}>
                  <Skeleton className="h-4 w-full max-w-[160px]" />
                </td>
              ))}
            </tr>
          ))}

          {/* Données */}
          {!loading && sorted.map((row, index) => (
            <tr
              key={keyExtractor(row)}
              className={cn(
                'border-b transition-colors',
                onRowClick && 'cursor-pointer hover:bg-muted/50',
                rowClassName?.(row),
              )}
              onClick={() => onRowClick?.(row)}
            >
              {columns.map(col => (
                <td key={col.key} className={cn('p-2 align-middle whitespace-nowrap', col.className)}>
                  {col.render
                    ? col.render(row, index)
                    : ((row as any)[col.key] ?? '—')}
                </td>
              ))}
            </tr>
          ))}

          {/* Vide */}
          {!loading && sorted.length === 0 && (
            <tr>
              <td colSpan={columns.length} className="py-20 text-center">
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  {emptyIcon ?? <SearchX size={40} strokeWidth={1} />}
                  <p className="text-sm">{emptyMessage}</p>
                </div>
              </td>
            </tr>
          )}

        </tbody>
      </table>
    </div>
  );
}
