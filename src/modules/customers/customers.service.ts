import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { CustomerType } from '@prisma/client';

@Injectable()
export class CustomersService {
    constructor(private prisma: PrismaService) { }

    async findAll(search?: string, type?: CustomerType) {
        const where: any = { deletedAt: null };
        if (type) where.customerType = type;
        if (search) {
            where.OR = [
                { firstName: { contains: search, mode: 'insensitive' } },
                { lastName: { contains: search, mode: 'insensitive' } },
                { companyName: { contains: search, mode: 'insensitive' } },
                { phonePrimary: { contains: search } },
                { email: { contains: search, mode: 'insensitive' } },
            ];
        }

        return this.prisma.customer.findMany({
            where,
            orderBy: { createdAt: 'desc' },
        });
    }

    async findOne(id: string) {
        const customer = await this.prisma.customer.findUnique({
            where: { id, deletedAt: null },
            include: {
                vehicles: true,
                serviceOrders: {
                    orderBy: { openedAt: 'desc' },
                    take: 5
                }
            },
        });

        if (!customer) throw new NotFoundException('Client introuvable');
        return customer;
    }

    async create(data: any) {
        return this.prisma.customer.create({
            data,
        });
    }

    async update(id: string, data: any) {
        await this.findOne(id);
        return this.prisma.customer.update({
            where: { id },
            data,
        });
    }

    async remove(id: string) {
        await this.findOne(id);
        return this.prisma.customer.update({
            where: { id },
            data: { deletedAt: new Date() },
        });
    }
}
