import type { BillingDocumentData } from '@/components/billing/BillingDocument';
import type { WorkshopSettings } from '@/lib/workshop-settings';
import { FALLBACK_WORKSHOP_SETTINGS } from '@/lib/workshop-settings';

function customerName(c: any) {
  if (!c) return '—';
  return c.customerType === 'COMPANY'
    ? c.companyName
    : [c.firstName, c.lastName].filter(Boolean).join(' ');
}

function personName(p: { firstName?: string; lastName?: string } | null | undefined) {
  if (!p) return null;
  const name = [p.firstName, p.lastName].filter(Boolean).join(' ');
  return name || null;
}

export function buildQuotePrintData(
  quote: any,
  workshop: WorkshopSettings = FALLBACK_WORKSHOP_SETTINGS,
): BillingDocumentData {
  const so = quote.serviceOrder;
  const vehicle = so?.vehicle;
  return {
    reference: quote.reference,
    date: new Date(quote.createdAt).toLocaleDateString('fr-FR'),
    validUntil: quote.validUntil
      ? new Date(quote.validUntil).toLocaleDateString('fr-FR')
      : undefined,
    serviceOrderRef: so?.reference,
    preparedBy: personName(quote.creator) ?? undefined,
    workshop: mapWorkshop(workshop),
    customer: {
      name: customerName(quote.customer),
      address: quote.customer?.city ?? undefined,
      phone: quote.customer?.phonePrimary ?? '',
    },
    vehicle: {
      brand: vehicle?.make?.name ?? '',
      model: vehicle?.model?.name ?? '',
      plate: vehicle?.plateNumber ?? '',
      vin: vehicle?.vin ?? undefined,
      mileage: so?.mileageIn != null ? Number(so.mileageIn) : undefined,
    },
    items: (quote.lines ?? []).map((l: any) => ({
      type: l.lineType,
      description: l.description || '—',
      quantity: Number(l.quantity),
      unitPrice: Number(l.unitPriceXaf),
      reference: l.part?.reference,
    })),
    subtotal: Math.round(Number(quote.subtotalXaf)),
    tax: Math.round(Number(quote.taxAmountXaf)),
    stampDuty: Math.round(Number(quote.stampDutyXaf)),
    total: Math.round(Number(quote.totalXaf)),
    notes: quote.notes ?? undefined,
    approvedAt: quote.approvedByClientAt
      ? new Date(quote.approvedByClientAt).toLocaleDateString('fr-FR')
      : undefined,
  };
}

function mapWorkshop(workshop: WorkshopSettings): BillingDocumentData['workshop'] {
  return {
    shopName: workshop.shopName,
    tagline: workshop.tagline,
    niu: workshop.niu,
    email: workshop.email,
    phone: workshop.phone,
    address: workshop.address,
  };
}

export function buildInvoicePrintData(
  invoice: any,
  workshop: WorkshopSettings = FALLBACK_WORKSHOP_SETTINGS,
): BillingDocumentData {
  const so = invoice.serviceOrder;
  const vehicle = so?.vehicle;
  return {
    docType: 'FACTURE',
    reference: invoice.reference,
    date: invoice.issuedAt
      ? new Date(invoice.issuedAt).toLocaleDateString('fr-FR')
      : new Date(invoice.createdAt).toLocaleDateString('fr-FR'),
    serviceOrderRef: so?.reference,
    workshop: mapWorkshop(workshop),
    customer: {
      name: customerName(invoice.customer),
      address: invoice.customer?.city ?? undefined,
      phone: invoice.customer?.phonePrimary ?? '',
    },
    vehicle: {
      brand: vehicle?.make?.name ?? '',
      model: vehicle?.model?.name ?? '',
      plate: vehicle?.plateNumber ?? '',
      vin: vehicle?.vin ?? undefined,
      mileage: so?.mileageIn != null ? Number(so.mileageIn) : undefined,
    },
    items: (invoice.lines ?? []).map((l: any) => ({
      type: l.lineType,
      description: l.description || '—',
      quantity: Number(l.quantity),
      unitPrice: Number(l.unitPriceXaf),
    })),
    subtotal: Math.round(Number(invoice.subtotalXaf)),
    tax: Math.round(Number(invoice.taxAmountXaf)),
    stampDuty: Math.round(Number(invoice.stampDutyXaf)),
    total: Math.round(Number(invoice.totalXaf)),
  };
}
