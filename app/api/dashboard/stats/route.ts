import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { OTStatus, InvoiceStatus } from '@prisma/client';

export async function GET() {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    // 1. OT en cours (tous ceux qui ne sont ni brouillons, ni annulés, ni clôturés/facturés)
    const activeOTsCount = await prisma.serviceOrder.count({
      where: {
        status: {
          notIn: [OTStatus.DRAFT, OTStatus.INVOICED, OTStatus.CLOSED, OTStatus.CANCELLED]
        }
      }
    });

    // 2. Véhicules reçus aujourd'hui
    const vehiclesToday = await prisma.serviceOrder.count({
      where: {
        openedAt: { gte: today }
      }
    });

    // 3. OTs terminés / prêts (ce mois-ci)
    const completedThisMonth = await prisma.serviceOrder.count({
      where: {
        status: { in: [OTStatus.READY, OTStatus.INVOICED, OTStatus.CLOSED] },
        updatedAt: { gte: firstDayOfMonth }
      }
    });

    // 4. Chiffre d'affaires encaissé (ce mois-ci)
    const aggregateQuery = await prisma.invoice.aggregate({
      _sum: { totalXaf: true },
      where: {
        status: InvoiceStatus.PAID,
        paidAt: { gte: firstDayOfMonth }
      }
    });

    const totalRevenue = Number(aggregateQuery._sum.totalXaf || 0);
    // Format lisible
    const formattedRevenue = totalRevenue >= 1000000
      ? (totalRevenue / 1000000).toFixed(1) + 'M'
      : totalRevenue.toLocaleString('fr-FR');

    return NextResponse.json({
      stats: [
        { title: "OT en cours", value: activeOTsCount.toString(), trend: "-" },
        { title: "Reçus aujourd'hui", value: vehiclesToday.toString(), trend: "-" },
        { title: "Terminés (Mois)", value: completedThisMonth.toString(), trend: "-" },
        { title: "Chiffre d'affaires", value: formattedRevenue, trend: "-" },
      ]
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
