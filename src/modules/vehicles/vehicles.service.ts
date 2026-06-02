import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { garageWhere, requireGarageId } from '../../shared/garage/garage-scope';

@Injectable()
export class VehiclesService {
    constructor(private prisma: PrismaService) { }

    async findAll(search?: string, customerId?: string, garageId?: string | null) {
        const where: any = {
            deletedAt: null,
            ...garageWhere(garageId),
        };
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
        return this.prisma.vehicle.findMany({
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

    async findOne(id: string, garageId?: string | null) {
        const where: any = { id, deletedAt: null, ...garageWhere(garageId) };
        const vehicle = await this.prisma.vehicle.findFirst({
            where,
            include: {
                customer: true, make: true, model: true,
                serviceOrders: { orderBy: { openedAt: 'desc' }, take: 10 },
            },
        });
        if (!vehicle) throw new NotFoundException('Véhicule introuvable');
        return vehicle;
    }

    async create(data: any, garageId?: string | null) {
        return this.prisma.vehicle.create({
            data: { ...data, garageId: requireGarageId(garageId) },
        });
    }

    async update(id: string, data: any, garageId?: string | null) {
        await this.findOne(id, garageId);
        return this.prisma.vehicle.update({ where: { id }, data });
    }

    async remove(id: string, garageId?: string | null) {
        await this.findOne(id, garageId);
        return this.prisma.vehicle.update({ where: { id }, data: { deletedAt: new Date() } });
    }
}
