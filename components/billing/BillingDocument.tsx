'use client';

import React from 'react';
import { formatXAF } from '@/lib/utils';

export interface BillingDocumentData {
  docType?: 'DEVIS' | 'FACTURE';
  reference: string;
  date: string;
  validUntil?: string;
  serviceOrderRef?: string;
  preparedBy?: string;
  workshop: {
    shopName: string;
    tagline: string;
    niu?: string | null;
    email: string;
    phone: string;
    address: string;
  };
  customer: {
    name: string;
    address?: string;
    phone: string;
  };
  vehicle: {
    brand: string;
    model: string;
    plate: string;
    vin?: string;
    mileage?: number;
  };
  items: Array<{
    type: string;
    description: string;
    quantity: number;
    unitPrice: number;
    reference?: string;
  }>;
  subtotal: number;
  tax: number;
  stampDuty?: number;
  total: number;
  notes?: string;
  approvedAt?: string;
}

interface BillingDocumentProps {
  type: 'QUOTE' | 'INVOICE';
  data: BillingDocumentData;
}

const BRAND = '#1D6FA4';
const DEFAULT_TERMS =
  "Garantie 6 mois sur pièces neuves · Main d'œuvre garantie 3 mois · TVA 19,25 % · Paiement à réception du véhicule sauf accord contraire · Tribunal compétent : Yaoundé.";

function lineTotal(item: BillingDocumentData['items'][0]) {
  return Math.round(Number(item.quantity) * Number(item.unitPrice));
}

export function BillingDocument({ type, data }: BillingDocumentProps) {
  const isQuote = type === 'QUOTE';
  const docTitle = isQuote ? 'Devis' : 'Facture';
  const stampDuty = data.stampDuty ?? 0;

  return (
    <article
      className="billing-print mx-auto bg-white text-slate-900 font-sans"
      style={{ maxWidth: '210mm', minHeight: '297mm', padding: '14mm 16mm' }}
    >
      {/* Bandeau */}
      <div
        className="rounded-t-xl h-1.5 w-full mb-6"
        style={{ background: `linear-gradient(90deg, ${BRAND} 0%, #155A87 100%)` }}
      />

      {/* En-tête */}
      <header className="flex justify-between items-start gap-8 mb-8">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center text-white text-lg font-black shrink-0"
              style={{ backgroundColor: BRAND }}
            >
              A
            </div>
            <div>
              <p className="text-xl font-black tracking-tight leading-none">{data.workshop.shopName}</p>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400 mt-1">
                {data.workshop.tagline}
              </p>
            </div>
          </div>
          <div className="text-[10px] text-slate-500 leading-relaxed">
            {data.workshop.address}<br />
            {data.workshop.niu && <>NIU {data.workshop.niu}<br /></>}
            {data.workshop.phone} · {data.workshop.email}
          </div>
        </div>

        <div className="text-right shrink-0">
          <p
            className="text-[10px] font-bold uppercase tracking-[0.25em] mb-1"
            style={{ color: BRAND }}
          >
            {docTitle}
          </p>
          <p className="text-2xl font-black font-mono tracking-tight">{data.reference}</p>
          <dl className="mt-4 space-y-2 text-left inline-block text-right">
            <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
              <dt className="text-slate-400 uppercase text-[9px] font-bold tracking-wide">Émis le</dt>
              <dd className="font-semibold">{data.date}</dd>
              {isQuote && data.validUntil && (
                <>
                  <dt className="text-slate-400 uppercase text-[9px] font-bold tracking-wide">Valide jusqu&apos;au</dt>
                  <dd className="font-semibold" style={{ color: BRAND }}>{data.validUntil}</dd>
                </>
              )}
              {data.serviceOrderRef && (
                <>
                  <dt className="text-slate-400 uppercase text-[9px] font-bold tracking-wide">OT</dt>
                  <dd className="font-mono font-semibold">{data.serviceOrderRef}</dd>
                </>
              )}
              {data.preparedBy && (
                <>
                  <dt className="text-slate-400 uppercase text-[9px] font-bold tracking-wide">Établi par</dt>
                  <dd className="font-semibold">{data.preparedBy}</dd>
                </>
              )}
            </div>
          </dl>
        </div>
      </header>

      {/* Client + Véhicule */}
      <section className="grid grid-cols-2 gap-6 mb-6">
        <div className="rounded-xl border border-slate-200 p-4 bg-slate-50/80">
          <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400 mb-2">Client</p>
          <p className="text-base font-bold text-slate-900">{data.customer.name}</p>
          {data.customer.address && (
            <p className="text-sm text-slate-600 mt-1">{data.customer.address}</p>
          )}
          {data.customer.phone && (
            <p className="text-sm font-medium text-slate-800 mt-1">{data.customer.phone}</p>
          )}
        </div>
        <div className="rounded-xl border border-slate-200 p-4">
          <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400 mb-2">Véhicule</p>
          <p className="text-sm font-bold text-slate-900">
            {[data.vehicle.brand, data.vehicle.model].filter(Boolean).join(' ') || '—'}
          </p>
          <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
            <div>
              <p className="text-[9px] text-slate-400 uppercase font-bold">Immat.</p>
              <p className="font-mono font-bold">{data.vehicle.plate || '—'}</p>
            </div>
            {data.vehicle.mileage != null && data.vehicle.mileage > 0 && (
              <div>
                <p className="text-[9px] text-slate-400 uppercase font-bold">Km</p>
                <p className="font-bold">{Number(data.vehicle.mileage).toLocaleString('fr-FR')}</p>
              </div>
            )}
            {data.vehicle.vin && (
              <div className="col-span-2">
                <p className="text-[9px] text-slate-400 uppercase font-bold">VIN</p>
                <p className="font-mono text-[10px] text-slate-600 break-all">{data.vehicle.vin}</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Description / objet */}
      {data.notes && (
        <section className="mb-6 rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-2 bg-slate-100 border-b border-slate-200">
            <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-500">
              {isQuote ? 'Objet du devis' : 'Notes'}
            </p>
          </div>
          <p className="px-4 py-3 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
            {data.notes}
          </p>
        </section>
      )}

      {/* Lignes */}
      <section className="mb-6 rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr style={{ backgroundColor: BRAND }} className="text-white">
              <th className="text-left py-2.5 px-3 text-[9px] font-bold uppercase tracking-wider w-16">Type</th>
              <th className="text-left py-2.5 px-3 text-[9px] font-bold uppercase tracking-wider">Désignation</th>
              <th className="text-center py-2.5 px-3 text-[9px] font-bold uppercase tracking-wider w-12">Qté</th>
              <th className="text-right py-2.5 px-3 text-[9px] font-bold uppercase tracking-wider w-24">P.U. HT</th>
              <th className="text-right py-2.5 px-3 text-[9px] font-bold uppercase tracking-wider w-28">Total HT</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((item, i) => (
              <tr
                key={i}
                className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/90'}
                style={{ borderBottom: '1px solid #e2e8f0' }}
              >
                <td className="py-3 px-3 align-top">
                  <span
                    className="inline-block text-[8px] font-bold uppercase px-1.5 py-0.5 rounded"
                    style={{
                      backgroundColor: item.type === 'PART' ? '#f1f5f9' : '#E8F3FB',
                      color: item.type === 'PART' ? '#475569' : BRAND,
                    }}
                  >
                    {item.type === 'PART' ? 'Pièce' : 'M.O.'}
                  </span>
                </td>
                <td className="py-3 px-3 align-top">
                  <p className="font-semibold text-slate-900 leading-snug">{item.description}</p>
                  {item.reference && (
                    <p className="text-[10px] text-slate-400 font-mono mt-0.5">Réf. {item.reference}</p>
                  )}
                </td>
                <td className="py-3 px-3 text-center align-top font-medium">{item.quantity}</td>
                <td className="py-3 px-3 text-right align-top font-mono text-xs">{formatXAF(item.unitPrice)}</td>
                <td className="py-3 px-3 text-right align-top font-mono font-bold text-xs">
                  {formatXAF(lineTotal(item))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Totaux */}
      <section className="flex justify-end mb-10">
        <div className="w-72 rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 space-y-2 bg-slate-50">
            <div className="flex justify-between text-xs">
              <span className="text-slate-500 font-medium">Sous-total HT</span>
              <span className="font-mono font-semibold">{formatXAF(data.subtotal)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-500 font-medium">TVA 19,25 %</span>
              <span className="font-mono font-semibold">{formatXAF(data.tax)}</span>
            </div>
            {stampDuty > 0 && (
              <div className="flex justify-between text-xs">
                <span className="text-slate-500 font-medium">Timbre fiscal</span>
                <span className="font-mono font-semibold">{formatXAF(stampDuty)}</span>
              </div>
            )}
          </div>
          <div
            className="flex justify-between items-center px-4 py-3 text-white"
            style={{ backgroundColor: BRAND }}
          >
            <span className="text-xs font-bold uppercase tracking-wide">Total TTC</span>
            <span className="text-xl font-black font-mono">{formatXAF(data.total)}</span>
          </div>
        </div>
      </section>

      {/* Pied de page */}
      <footer className="pt-6 border-t border-slate-200 space-y-6">
        <div>
          <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400 mb-2">
            Conditions
          </p>
          <p className="text-[10px] text-slate-500 leading-relaxed">{DEFAULT_TERMS}</p>
        </div>

        {isQuote && (
          <div className="space-y-3">
            <p className="text-[10px] font-semibold text-slate-700">
              Bon pour accord — devis {data.reference}
              {data.total > 0 && (
                <span className="text-slate-500 font-normal">
                  {' '}· Montant TTC : {formatXAF(data.total)}
                </span>
              )}
            </p>
            {data.approvedAt && (
              <p className="text-[10px] text-emerald-700 font-semibold">
                Accepté et signé le {data.approvedAt}
              </p>
            )}

            <div className="grid grid-cols-2 gap-5">
              {/* Signature client */}
              <div className="rounded-xl border border-slate-300 bg-slate-50/50 p-4 min-h-[130px] flex flex-col">
                <p className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-500 mb-3">
                  Client — signature
                </p>
                <p className="text-xs font-bold text-slate-900 mb-1">{data.customer.name}</p>
                {data.customer.phone && (
                  <p className="text-[10px] text-slate-500 mb-auto">{data.customer.phone}</p>
                )}
                <div className="mt-6 space-y-3">
                  <div>
                    <p className="text-[8px] uppercase text-slate-400 mb-1">Signature</p>
                    <div className="border-b border-slate-400 h-10" />
                  </div>
                  <div className="flex items-end gap-2 text-[10px] text-slate-500">
                    <span>Fait le</span>
                    <span className="inline-block border-b border-slate-300 w-8 text-center">/</span>
                    <span className="inline-block border-b border-slate-300 w-8 text-center">/</span>
                    <span className="inline-block border-b border-slate-300 flex-1 min-w-[3rem]" />
                  </div>
                </div>
              </div>

              {/* Signature chef d'atelier */}
              <div className="rounded-xl border border-slate-300 p-4 min-h-[130px] flex flex-col">
                <p
                  className="text-[9px] font-black uppercase tracking-[0.15em] mb-3"
                  style={{ color: BRAND }}
                >
                  Chef d&apos;atelier — signature & cachet
                </p>
                <p className="text-xs font-bold text-slate-900 mb-1">
                  {data.preparedBy ?? '—'}
                </p>
                <p className="text-[10px] text-slate-500 mb-auto">{data.workshop.shopName}</p>
                <div className="mt-6 space-y-3">
                  <div>
                    <p className="text-[8px] uppercase text-slate-400 mb-1">Signature & cachet</p>
                    <div className="border-b border-slate-400 h-10" />
                  </div>
                  <div className="flex items-end gap-2 text-[10px] text-slate-500">
                    <span>Fait le</span>
                    <span className="inline-block border-b border-slate-300 w-8 text-center">/</span>
                    <span className="inline-block border-b border-slate-300 w-8 text-center">/</span>
                    <span className="inline-block border-b border-slate-300 flex-1 min-w-[3rem]" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {!isQuote && (
          <div className="grid grid-cols-2 gap-3 max-w-md ml-auto">
            <div className="rounded-xl border-2 border-dashed border-slate-200 p-4 min-h-[88px] flex flex-col justify-end">
              <p className="text-[9px] font-bold uppercase text-slate-300 mb-2">Client</p>
              <div className="border-b border-slate-300 h-8" />
            </div>
            <div className="rounded-xl border-2 border-dashed border-slate-200 p-4 min-h-[88px] flex flex-col justify-end">
              <p className="text-[9px] font-bold uppercase text-slate-300 mb-2">Atelier</p>
              <div className="border-b border-slate-300 h-8" />
            </div>
          </div>
        )}
      </footer>

      <p className="text-center text-[9px] text-slate-300 mt-8">
        Document généré par {data.workshop.shopName} · {data.reference}
      </p>
    </article>
  );
}
