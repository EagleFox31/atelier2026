import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';

@Injectable()
export class VehiclesService {
    constructor(private prisma: PrismaService) { }

    async findAll(search?: string, customerId?: string, garageId?: string) {
        const db = this.prisma.forGarage(garageId);
        const where: any = { deletedAt: null };
        if (customerId) where.customerId = customerId;
        if (search) {
            where.OR = [
                { plateNumber: { contains: search, mode: 'insensitive' } },
                { vin: { contains: search, mode: 'insensitive' } },
                { customer: { firstName: { contains: search, mode: 'insensitive' } } },
                { customer: { lastName: { contains: search, mode: 'insensitive' } } },
                { customer: { companyName: { contains: search, mode: 'insensitive' } } },
            ];
        }
        return db.vehicle.findMany({
            where,
            include: { customer: true, make: true, model: true },
            orderBy: { createdAt: 'desc' },
        });
    }

    async getMakes() {
        return this.prisma.vehicleMake.findMany({ orderBy: { name: 'asc' } });
    }

    async getModels(makeId?: string) {
        const where = makeId ? { makeId } : {};
        return this.prisma.vehicleModel.findMany({ where, orderBy: { name: 'asc' } });
    }

    async findOne(id: string, garageId?: string) {
        const db = this.prisma.forGarage(garageId);
        const vehicle = await db.vehicle.findUnique({
            where: { id, deletedAt: null },
            include: {
                customer: true, make: true, model: true,
                serviceOrders: { orderBy: { openedAt: 'desc' }, take: 10 },
            },
        });
        if (!vehicle) throw new NotFoundException('Véhicule introuvable');
        return vehicle;
    }

    async create(data: any, garageId?: string) {
        const db = this.prisma.forGarage(garageId);
        return db.vehicle.create({ data });
    }

    async update(id: string, data: any, garageId?: string) {
        await this.findOne(id, garageId);
        const db = this.prisma.forGarage(garageId);
        return db.vehicle.update({ where: { id }, data });
    }

    async remove(id: string, garageId?: string) {
        await this.findOne(id, garageId);
        const db = this.prisma.forGarage(garageId);
        return db.vehicle.update({ where: { id }, data: { deletedAt: new Date() } });
    }
}
