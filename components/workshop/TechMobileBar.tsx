'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Package, List, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MOBILE_BOTTOM_NAV_OFFSET } from '@/lib/constants';
import { resolveTechMobilePrimary } from '@/lib/workshop-tech-mobile';

interface TechMobileBarProps {
  status: string;
  canDiagnose: boolean;
  isAssigned: boolean;
  loading?: boolean;
  onOpenDiagnosis: (mode: 'start' | 'add') => void;
  onStatusChange: (status: string) => void;
}

export function TechMobileBar({
  status,
  canDiagnose,
  isAssigned,
  loading = false,
  onOpenDiagnosis,
  onStatusChange,
}: TechMobileBarProps) {
  const router = useRouter();
  const primary = resolveTechMobilePrimary(status, { canDiagnose, isAssigned });

  function handlePrimaryClick() {
    if (!primary || loading) return;
    if (primary.kind === 'diagnosis-start') onOpenDiagnosis('start');
    else if (primary.kind === 'diagnosis-add') onOpenDiagnosis('add');
    else if (primary.kind === 'status' && primary.targetStatus) onStatusChange(primary.targetStatus);
  }

  const PrimaryIcon = primary?.icon;

  return (
    <div
      className="md:hidden fixed left-0 right-0 z-[90] border-t border-border bg-card/95 backdrop-blur-xl px-3 py-2 shadow-[0_-4px_16px_rgba(0,0,0,0.08)]"
      style={{ bottom: MOBILE_BOTTOM_NAV_OFFSET }}
    >
      <div className="flex items-center gap-2 max-w-lg mx-auto">
        <Button
          variant="outline"
          size="sm"
          className="h-11 px-3 border-border shrink-0"
          onClick={() => router.push('/workshop')}
        >
          <List size={16} className="mr-1.5" />
          OT
        </Button>

        {primary && PrimaryIcon && (
          <Button
            size="sm"
            className="h-11 flex-1 bg-brand hover:bg-brand-hover font-bold gap-1.5"
            onClick={handlePrimaryClick}
            disabled={loading}
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <PrimaryIcon size={16} />}
            {primary.label}
          </Button>
        )}

        <Link
          href="/stock"
          className={cn(
            'inline-flex h-11 items-center justify-center rounded-lg border border-border bg-background px-3 text-sm font-medium shrink-0 hover:bg-muted',
            !primary && 'flex-1',
          )}
        >
          <Package size={16} className="mr-1.5" />
          Stock
        </Link>
      </div>
    </div>
  );
}
