import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { CustomerType } from '@prisma/client';

@Injectable()
export class CustomersService {
    constructor(private prisma: PrismaService) { }

    async findAll(search?: string, type?: CustomerType, garageId?: string) {
        const db = this.prisma.forGarage(garageId);
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
        return db.customer.findMany({ where, orderBy: { createdAt: 'desc' } });
    }

    async findOne(id: string, garageId?: string) {
        const db = this.prisma.forGarage(garageId);
        const customer = await db.customer.findUnique({
            where: { id, deletedAt: null },
            include: {
                vehicles: true,
                serviceOrders: { orderBy: { openedAt: 'desc' }, take: 5 },
            },
        });
        if (!customer) throw new NotFoundException('Client introuvable');
        return customer;
    }

    async create(data: any, garageId?: string) {
        const db = this.prisma.forGarage(garageId);
        return db.customer.create({ data });
    }

    async update(id: string, data: any, garageId?: string) {
        await this.findOne(id, garageId);
        const db = this.prisma.forGarage(garageId);
        return db.customer.update({ where: { id }, data });
    }

    async remove(id: string, garageId?: string) {
        await this.findOne(id, garageId);
        const db = this.prisma.forGarage(garageId);
        return db.customer.update({ where: { id }, data: { deletedAt: new Date() } });
    }
}
