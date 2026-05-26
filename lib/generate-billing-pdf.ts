import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';
import type { BillingDocumentData } from '@/components/billing/BillingDocument';
import { workshopContactLine } from '@/lib/workshop-settings';

const BRAND: [number, number, number] = [29, 111, 164];
const SLATE: [number, number, number] = [51, 65, 85];
const MUTED: [number, number, number] = [100, 116, 139];

/** Helvetica jsPDF = ASCII fiable (evite erreurs sur accents / unicode). */
function pdfText(value: string | undefined | null, fallback = '-'): string {
  if (!value?.trim()) return fallback;
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[—·œŒ]/g, c => ({ '—': '-', '·': '-', 'œ': 'oe', 'Œ': 'OE' }[c] ?? c))
    .replace(/\r?\n/g, ' ')
    .replace(/[^\x20-\x7E]/g, '?');
}

function fmtXaf(n: number) {
  const s = String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${s} XAF`;
}

function fmtNum(n: number) {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

function lineTotal(item: BillingDocumentData['items'][0]) {
  return Math.round(Number(item.quantity) * Number(item.unitPrice));
}

const DEFAULT_TERMS =
  "Garantie 6 mois sur pieces neuves. Main d'oeuvre garantie 3 mois. TVA 19,25 %. Paiement a reception sauf accord contraire.";

/**
 * Genere un PDF A4 natif (sans html2canvas) — fiable avec Tailwind v4.
 */
export function generateQuotePdfBlobUrl(data: BillingDocumentData): string {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const margin = 14;
  let y = 12;

  // Bandeau
  pdf.setFillColor(...BRAND);
  pdf.rect(0, 0, pageWidth, 2.5, 'F');

  // En-tete gauche — atelier
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(14);
  pdf.setTextColor(...BRAND);
  pdf.text(pdfText(data.workshop.shopName), margin, y + 4);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(7);
  pdf.setTextColor(...MUTED);
  pdf.text(pdfText(data.workshop.tagline), margin, y + 9);
  pdf.text(pdfText(workshopContactLine(data.workshop)), margin, y + 13);

  // En-tete droite — devis
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9);
  pdf.setTextColor(...BRAND);
  pdf.text(data.docType ?? 'DEVIS', pageWidth - margin, y, { align: 'right' });
  pdf.setFontSize(13);
  pdf.setTextColor(...SLATE);
  pdf.text(pdfText(data.reference), pageWidth - margin, y + 6, { align: 'right' });
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  pdf.setTextColor(...MUTED);
  pdf.text(`Emis le ${pdfText(data.date)}`, pageWidth - margin, y + 11, { align: 'right' });
  if (data.validUntil) {
    pdf.text(`Valide jusqu'au ${pdfText(data.validUntil)}`, pageWidth - margin, y + 15, { align: 'right' });
  }
  if (data.serviceOrderRef) {
    pdf.text(`OT ${pdfText(data.serviceOrderRef)}`, pageWidth - margin, y + 19, { align: 'right' });
  }
  if (data.preparedBy) {
    pdf.text(`Etabli par ${pdfText(data.preparedBy)}`, pageWidth - margin, y + 23, { align: 'right' });
  }

  y = 38;

  // Client + Vehicule
  const colW = (pageWidth - margin * 2 - 6) / 2;

  pdf.setDrawColor(226, 232, 240);
  pdf.setFillColor(248, 250, 252);
  pdf.roundedRect(margin, y, colW, 28, 2, 2, 'FD');
  pdf.roundedRect(margin + colW + 6, y, colW, 28, 2, 2, 'S');

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(7);
  pdf.setTextColor(...MUTED);
  pdf.text('CLIENT', margin + 4, y + 6);
  pdf.text('VEHICULE', margin + colW + 10, y + 6);

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10);
  pdf.setTextColor(...SLATE);
  pdf.text(pdfText(data.customer.name), margin + 4, y + 13);
  const vehicleLine = [data.vehicle.brand, data.vehicle.model].filter(Boolean).join(' ') || '-';
  pdf.text(pdfText(vehicleLine), margin + colW + 10, y + 13);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  pdf.setTextColor(...MUTED);
  if (data.customer.phone) pdf.text(pdfText(data.customer.phone), margin + 4, y + 18);
  if (data.customer.address) pdf.text(pdfText(data.customer.address), margin + 4, y + 22);
  pdf.text(`Immat. ${pdfText(data.vehicle.plate)}`, margin + colW + 10, y + 18);
  if (data.vehicle.mileage) {
    pdf.text(`${fmtNum(data.vehicle.mileage)} km`, margin + colW + 10, y + 22);
  }

  y += 34;

  // Objet du devis
  if (data.notes) {
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(7);
    pdf.setTextColor(...MUTED);
    pdf.text('OBJET DU DEVIS', margin, y);
    y += 4;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(...SLATE);
    const noteLines = pdf.splitTextToSize(pdfText(data.notes, ''), pageWidth - margin * 2);
    pdf.text(noteLines, margin, y + 3);
    y += noteLines.length * 4 + 6;
  }

  // Tableau lignes
  autoTable(pdf, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [['Type', 'Designation', 'Qte', 'P.U. HT', 'Total HT']],
    body: data.items.map(item => [
      item.type === 'PART' ? 'Piece' : 'M.O.',
      pdfText(item.description),
      String(item.quantity),
      fmtXaf(item.unitPrice),
      fmtXaf(lineTotal(item)),
    ]),
    styles: { fontSize: 8, cellPadding: 2.5, textColor: SLATE },
    headStyles: {
      fillColor: BRAND,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7,
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 14 },
      2: { cellWidth: 12, halign: 'center' },
      3: { cellWidth: 28, halign: 'right' },
      4: { cellWidth: 28, halign: 'right' },
    },
  });

  y = ((pdf as any).lastAutoTable?.finalY ?? y + 40) + 8;

  // Totaux
  const totalsX = pageWidth - margin - 62;
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  pdf.setTextColor(...MUTED);
  pdf.text('Sous-total HT', totalsX, y);
  pdf.text(fmtXaf(data.subtotal), pageWidth - margin, y, { align: 'right' });
  y += 5;
  pdf.text('TVA 19,25 %', totalsX, y);
  pdf.text(fmtXaf(data.tax), pageWidth - margin, y, { align: 'right' });
  if ((data.stampDuty ?? 0) > 0) {
    y += 5;
    pdf.text('Timbre fiscal', totalsX, y);
    pdf.text(fmtXaf(data.stampDuty!), pageWidth - margin, y, { align: 'right' });
  }
  y += 7;
  pdf.setFillColor(...BRAND);
  pdf.roundedRect(totalsX - 4, y - 5, 66, 10, 1, 1, 'F');
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(9);
  pdf.text('Total TTC', totalsX, y + 1.5);
  pdf.text(fmtXaf(data.total), pageWidth - margin - 2, y + 1.5, { align: 'right' });

  y += 16;

  // Bon pour accord + signatures — nouvelle page si manque de place
  if (y > 240) {
    pdf.addPage();
    y = 20;
  }

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8);
  pdf.setTextColor(...SLATE);
  const bottomLabel = data.docType === 'FACTURE'
    ? `Facture - ${pdfText(data.reference)} - ${fmtXaf(data.total)} TTC`
    : `Bon pour accord - ${pdfText(data.reference)} - ${fmtXaf(data.total)} TTC`;
  pdf.text(bottomLabel, margin, y);
  y += 8;

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(7);
  pdf.setTextColor(...MUTED);
  const termsLines = pdf.splitTextToSize(DEFAULT_TERMS, pageWidth - margin * 2);
  pdf.text(termsLines, margin, y);
  y += termsLines.length * 3.5 + 6;

  if (data.approvedAt) {
    pdf.setTextColor(22, 101, 52);
    pdf.text(`Accepte et signe le ${pdfText(data.approvedAt)}`, margin, y);
    y += 8;
  }

  const sigW = (pageWidth - margin * 2 - 8) / 2;
  const sigH = 38;

  // Client
  pdf.setDrawColor(203, 213, 225);
  pdf.roundedRect(margin, y, sigW, sigH, 2, 2, 'S');
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(7);
  pdf.setTextColor(...MUTED);
  pdf.text('CLIENT - SIGNATURE', margin + 4, y + 6);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9);
  pdf.setTextColor(...SLATE);
  pdf.text(pdfText(data.customer.name), margin + 4, y + 12);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  pdf.setTextColor(...MUTED);
  if (data.customer.phone) pdf.text(pdfText(data.customer.phone), margin + 4, y + 17);
  pdf.line(margin + 4, y + sigH - 12, margin + sigW - 4, y + sigH - 12);
  pdf.setFontSize(7);
  pdf.text('Signature', margin + 4, y + sigH - 8);
  pdf.text('Fait le ____ / ____ / ______', margin + 4, y + sigH - 4);

  // Chef
  const sigX2 = margin + sigW + 8;
  pdf.setDrawColor(...BRAND);
  pdf.roundedRect(sigX2, y, sigW, sigH, 2, 2, 'S');
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(7);
  pdf.setTextColor(...BRAND);
  pdf.text("CHEF D'ATELIER — SIGNATURE & CACHET", sigX2 + 4, y + 6);
  pdf.setFontSize(9);
  pdf.setTextColor(...SLATE);
  pdf.text(pdfText(data.preparedBy), sigX2 + 4, y + 12);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  pdf.setTextColor(...MUTED);
  pdf.text(pdfText(data.workshop.shopName, 'Atelier'), sigX2 + 4, y + 17);
  pdf.setDrawColor(203, 213, 225);
  pdf.line(sigX2 + 4, y + sigH - 12, sigX2 + sigW - 4, y + sigH - 12);
  pdf.setFontSize(7);
  pdf.text('Signature & cachet', sigX2 + 4, y + sigH - 8);
  pdf.text('Fait le ____ / ____ / ______', sigX2 + 4, y + sigH - 4);

  pdf.setFontSize(6);
  pdf.setTextColor(180, 180, 180);
  pdf.text(
    `Document genere par ${pdfText(data.workshop.shopName)} - ${pdfText(data.reference)}`,
    pageWidth / 2,
    pdf.internal.pageSize.getHeight() - 8,
    { align: 'center' },
  );

  return URL.createObjectURL(pdf.output('blob'));
}

export function openPdfBlobUrl(blobUrl: string, filename: string): boolean {
  const safeName = pdfText(filename, 'devis').replace(/[^\w.-]+/g, '_');
  const win = window.open(blobUrl, '_blank', 'noopener,noreferrer');
  if (win) return true;

  const link = document.createElement('a');
  link.href = blobUrl;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.download = `${safeName}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  return false;
}
