import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { CustomerType } from '@prisma/client';

@Injectable()
export class CustomersService {
    constructor(private prisma: PrismaService) { }

    async findAll(search?: string, type?: CustomerType, garageId?: string | null) {
        const where: any = {
            deletedAt: null,
            ...(garageId ? { garageId } : {}),
        };
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
        return this.prisma.customer.findMany({ where, orderBy: { createdAt: 'desc' } });
    }

    async findOne(id: string, garageId?: string | null) {
        const where: any = { id, deletedAt: null, ...(garageId ? { garageId } : {}) };
        const customer = await this.prisma.customer.findFirst({
            where,
            include: {
                vehicles: true,
                serviceOrders: { orderBy: { openedAt: 'desc' }, take: 5 },
            },
        });
        if (!customer) throw new NotFoundException('Client introuvable');
        return customer;
    }

    async create(data: any, garageId?: string | null) {
        return this.prisma.customer.create({
            data: { ...data, ...(garageId ? { garageId } : {}) },
        });
    }

    async update(id: string, data: any, garageId?: string | null) {
        await this.findOne(id, garageId);
        return this.prisma.customer.update({ where: { id }, data });
    }

    async remove(id: string, garageId?: string | null) {
        await this.findOne(id, garageId);
        return this.prisma.customer.update({ where: { id }, data: { deletedAt: new Date() } });
    }
}
