import { Injectable } from '@nestjs/common';
import { PaymentMethod } from '@prisma/client';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { computeAmounts, computeLineTotal } from '../../shared/fiscal/compute-amounts';

import { CreateCounterSaleDto } from './dto/counter-sales.dto';

export type CreateCounterSaleInput = CreateCounterSaleDto;
export type CounterSaleLineInput = CreateCounterSaleDto['lines'][number];

@Injectable()
export class CounterSalesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(search?: string) {
    const where: Record<string, unknown> = {};
    if (search) {
      where.OR = [
        { reference: { contains: search, mode: 'insensitive' } },
        { walkInName: { contains: search, mode: 'insensitive' } },
        { customer: { lastName: { contains: search, mode: 'insensitive' } } },
      ];
    }

    return this.prisma.counterSale.findMany({
      where,
      include: {
        customer: true,
        lines: { include: { part: true } },
        seller: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  create(data: CreateCounterSaleInput, soldByUserId: string) {
    const lines = (data.lines || []).map((line) => {
      const discountPct = line.discountPct ?? 0;
      const lineTotalXaf = computeLineTotal(line.quantity, line.unitPriceXaf, discountPct);
      return { ...line, discountPct, lineTotalXaf };
    });

    const subtotalXaf = lines.reduce((sum, line) => sum + line.lineTotalXaf, 0);
    const fiscal = computeAmounts(subtotalXaf);

    return this.prisma.counterSale.create({
      data: {
        customerId: data.customerId ?? null,
        walkInName: data.walkInName ?? null,
        walkInPhone: data.walkInPhone ?? null,
        subtotalXaf: fiscal.subtotal,
        taxAmountXaf: fiscal.taxAmount,
        stampDutyXaf: fiscal.stampDuty,
        totalXaf: fiscal.total,
        paymentMethod: data.paymentMethod ?? PaymentMethod.CASH,
        paymentRef: data.paymentRef ?? null,
        soldBy: soldByUserId,
        notes: data.notes ?? null,
        lines: {
          create: lines.map((line, i) => ({
            partId: line.partId,
            quantity: line.quantity,
            unitPriceXaf: line.unitPriceXaf,
            discountPct: line.discountPct,
            sortOrder: i,
          })),
        },
      },
      include: { lines: { include: { part: true } } },
    });
  }
}
