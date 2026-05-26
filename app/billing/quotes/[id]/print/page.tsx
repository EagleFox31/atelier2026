'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Loader2, FileText, AlertCircle, Printer, RotateCcw } from 'lucide-react';
import { billingApi, handleApiError, settingsApi } from '@/lib/api';
import { buildQuotePrintData } from '@/lib/billing-print-data';
import { generateQuotePdfBlobUrl, openPdfBlobUrl } from '@/lib/generate-billing-pdf';
import type { WorkshopSettings } from '@/lib/workshop-settings';
import { FALLBACK_WORKSHOP_SETTINGS } from '@/lib/workshop-settings';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type Status = 'loading' | 'ready' | 'generating' | 'done' | 'error';

export default function QuotePrintPage() {
  const params = useParams();
  const id = params.id as string;

  const [quote, setQuote] = useState<any>(null);
  const [workshop, setWorkshop] = useState<WorkshopSettings>(FALLBACK_WORKSHOP_SETTINGS);
  const [status, setStatus] = useState<Status>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfFilename, setPdfFilename] = useState<string>('');

  useEffect(() => {
    Promise.all([
      billingApi.getQuote(id),
      settingsApi.getWorkshop().catch(() => FALLBACK_WORKSHOP_SETTINGS),
    ])
      .then(([quoteData, workshopData]) => {
        setQuote(quoteData);
        setWorkshop(workshopData);
        setStatus('ready');
      })
      .catch(err => {
        handleApiError(err, 'Impossible de charger le devis');
        setErrorMsg('Devis introuvable ou acces refuse');
        setStatus('error');
      });
  }, [id]);

  async function generateAndOpenPdf() {
    if (!quote) return;
    setStatus('generating');
    setErrorMsg('');
    try {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
      const printData = buildQuotePrintData(quote, workshop);
      const url = generateQuotePdfBlobUrl(printData);
      setPdfUrl(url);
      const rawName = (quote.customer?.companyName || quote.customer?.firstName || '');
      const clientSlug = rawName
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toUpperCase();
      const filename = clientSlug
        ? `devis-${quote.reference}-${clientSlug}`
        : `devis-${quote.reference}`;
      setPdfFilename(filename);
      openPdfBlobUrl(url, filename);
      setStatus('done');
    } catch (err) {
      console.error('[PDF]', err);
      setErrorMsg(
        err instanceof Error ? err.message : 'Erreur lors de la generation du PDF',
      );
      setStatus('error');
    }
  }

  useEffect(() => {
    if (status !== 'ready' || !quote) return;
    const t = window.setTimeout(() => { generateAndOpenPdf(); }, 300);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, quote]);

  useEffect(() => () => {
    if (pdfUrl) URL.revokeObjectURL(pdfUrl);
  }, [pdfUrl]);

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col items-center p-6">
      <div className={status === 'done' ? 'w-full max-w-4xl' : 'w-full max-w-lg'}>
        {status === 'loading' && (
          <div className="flex items-center gap-3 rounded-xl bg-white border border-slate-200 px-5 py-4 shadow-sm">
            <Loader2 className="animate-spin text-brand shrink-0" size={22} />
            <div>
              <p className="font-semibold text-slate-900">Chargement du devis…</p>
              <p className="text-sm text-slate-500">Preparation du document</p>
            </div>
          </div>
        )}

        {status === 'generating' && (
          <div className="flex items-center gap-3 rounded-xl bg-white border border-slate-200 px-5 py-4 shadow-sm">
            <Loader2 className="animate-spin text-brand shrink-0" size={22} />
            <div>
              <p className="font-semibold text-slate-900">Generation du PDF…</p>
              <p className="text-sm text-slate-500">Ouverture dans un nouvel onglet</p>
            </div>
          </div>
        )}

        {status === 'done' && quote && pdfUrl && (
          <div className="space-y-4">
            <div className="rounded-xl bg-white border border-green-200 px-5 py-4 shadow-sm space-y-3">
              <div className="flex items-start gap-3">
                <FileText className="text-green-600 shrink-0 mt-0.5" size={22} />
                <div>
                  <p className="font-semibold text-slate-900">PDF pret</p>
                  <p className="text-sm text-slate-500">
                    Devis <span className="font-mono font-medium">{quote.reference}</span> — apercu
                    ci-dessous ou ouverture dans un nouvel onglet.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => openPdfBlobUrl(pdfUrl, pdfFilename)}
                >
                  <Printer size={14} />
                  Ouvrir dans un nouvel onglet
                </Button>
                <a
                  href={pdfUrl}
                  download={`${pdfFilename}.pdf`}
                  className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'gap-2')}
                >
                  Télécharger
                </a>
              </div>
            </div>
            <iframe
              title={`Devis ${quote.reference}`}
              src={pdfUrl}
              className="w-full rounded-xl border border-slate-200 bg-white shadow-sm"
              style={{ height: 'calc(100vh - 220px)', minHeight: '480px' }}
            />
          </div>
        )}

        {status === 'error' && (
          <div className="rounded-xl bg-red-50 border border-red-200 px-5 py-4 space-y-3">
            <div className="flex items-start gap-3">
              <AlertCircle className="text-red-500 shrink-0 mt-0.5" size={22} />
              <div>
                <p className="font-semibold text-red-900">Echec de generation</p>
                <p className="text-sm text-red-800">{errorMsg}</p>
              </div>
            </div>
            {quote && (
              <Button variant="outline" size="sm" className="gap-2" onClick={generateAndOpenPdf}>
                <RotateCcw size={14} />
                Reessayer
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
