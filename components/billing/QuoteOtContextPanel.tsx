'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { AlertCircle } from 'lucide-react';
import { ReceptionInspectionCard } from '@/components/workshop/ReceptionInspectionCard';

interface QuoteOtContextPanelProps {
  observations?: any[] | null;
  receptionChecks?: any[] | null;
}

export function QuoteOtContextPanel({ observations, receptionChecks }: QuoteOtContextPanelProps) {
  const obs = observations ?? [];

  return (
    <div className="space-y-4 lg:sticky lg:top-6">
      {obs.length > 0 && (
        <Card className="rounded-2xl border-border shadow-sm border-amber-200/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-bold flex items-center gap-2 text-muted-foreground uppercase tracking-widest">
              <AlertCircle size={12} className="text-amber-500" />
              Constats technicien ({obs.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-[320px] overflow-y-auto">
            {obs.map(obsItem => (
              <div
                key={obsItem.id}
                className={cn(
                  'p-3 rounded-xl bg-muted/30 border-l-4',
                  obsItem.severity === 'URGENT'  ? 'border-l-red-400'   :
                  obsItem.severity === 'WARNING' ? 'border-l-amber-400' :
                                                     'border-l-blue-400',
                )}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <Badge variant="outline" className="text-[10px] border-border rounded-full py-0">
                    {obsItem.category}
                  </Badge>
                  <span className={cn(
                    'text-[10px] font-bold uppercase tracking-wide',
                    obsItem.severity === 'URGENT'  ? 'text-red-500'   :
                    obsItem.severity === 'WARNING' ? 'text-amber-500' : 'text-blue-500',
                  )}>
                    {obsItem.severity}
                  </span>
                </div>
                <p className="text-sm text-foreground leading-relaxed">{obsItem.description}</p>
                {obsItem.observer && (
                  <p className="text-[10px] text-muted-foreground mt-1.5">
                    {[obsItem.observer.firstName, obsItem.observer.lastName].filter(Boolean).join(' ')}
                  </p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <ReceptionInspectionCard receptionChecks={receptionChecks} highlight />
    </div>
  );
}
