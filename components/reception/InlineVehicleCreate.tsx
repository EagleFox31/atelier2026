'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { vehiclesApi, handleApiError } from '@/lib/api';
import { Car, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export interface CreatedVehicle {
  id: string;
  label: string;
  sublabel?: string;
  raw: Record<string, unknown>;
}

interface InlineVehicleCreateProps {
  customerId: string;
  searchHint?: string;
  onCreated: (vehicle: CreatedVehicle) => void;
  className?: string;
}

export function InlineVehicleCreate({ customerId, searchHint = '', onCreated, className }: InlineVehicleCreateProps) {
  const [plateNumber, setPlateNumber] = useState(searchHint.trim().toUpperCase());
  const [makeId, setMakeId] = useState('');
  const [modelId, setModelId] = useState('');
  const [makes, setMakes] = useState<{ id: string; name: string }[]>([]);
  const [models, setModels] = useState<{ id: string; name: string }[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const prevMakeId = useRef('');

  useEffect(() => {
    vehiclesApi.makes().then((d: unknown) => setMakes(Array.isArray(d) ? d as { id: string; name: string }[] : [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (!makeId) { setModels([]); return; }
    if (makeId !== prevMakeId.current) setModelId('');
    prevMakeId.current = makeId;
    setModelsLoading(true);
    vehiclesApi.models(makeId)
      .then((d: unknown) => setModels(Array.isArray(d) ? d as { id: string; name: string }[] : []))
      .catch(() => setModels([]))
      .finally(() => setModelsLoading(false));
  }, [makeId]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!plateNumber.trim() || !makeId || !modelId) {
      toast.error('Plaque, marque et modèle sont requis');
      return;
    }
    setSubmitting(true);
    try {
      const created = await vehiclesApi.create({
        customerId,
        plateNumber: plateNumber.trim(),
        makeId,
        modelId,
        year: new Date().getFullYear(),
        currentMileage: 0,
      }) as {
        id: string;
        plateNumber: string;
        make?: { name: string };
        model?: { name: string };
      };
      const sublabel = [created.make?.name, created.model?.name].filter(Boolean).join(' ');
      toast.success('Véhicule enregistré');
      onCreated({
        id: created.id,
        label: created.plateNumber,
        sublabel,
        raw: created as Record<string, unknown>,
      });
    } catch (err) {
      handleApiError(err, 'Impossible d\'enregistrer le véhicule');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleCreate} className={cn('space-y-3', className)}>
      <p className="text-sm font-semibold text-foreground flex items-center gap-2">
        <Car size={16} className="text-brand" />
        Enregistrer ce véhicule
      </p>
      <div className="space-y-1.5">
        <Label className="text-xs">Immatriculation <span className="text-destructive">*</span></Label>
        <Input
          value={plateNumber}
          onChange={e => setPlateNumber(e.target.value.toUpperCase())}
          placeholder="LT-123-AA"
          className="h-9 font-mono"
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Marque <span className="text-destructive">*</span></Label>
          <Select value={makeId} onValueChange={v => v && setMakeId(v)}>
            <SelectTrigger className="w-full h-9 bg-background">
              <SelectValue placeholder="Marque…">
                {makes.find(m => m.id === makeId)?.name}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {makes.map(m => (
                <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Modèle <span className="text-destructive">*</span></Label>
          <Select
            value={modelId}
            onValueChange={v => v && setModelId(v)}
            disabled={!makeId || modelsLoading}
          >
            <SelectTrigger className="w-full h-9 bg-background">
              <SelectValue placeholder={!makeId ? 'Marque d\'abord' : 'Modèle…'}>
                {models.find(m => m.id === modelId)?.name}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {models.map(m => (
                <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <Button type="submit" disabled={submitting} className="w-full bg-brand hover:bg-brand-hover h-10">
        {submitting ? <Loader2 size={16} className="animate-spin" /> : 'Créer et sélectionner'}
      </Button>
    </form>
  );
}
