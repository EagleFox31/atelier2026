import { Injectable } from '@nestjs/common';
import { AppointmentStatus } from '@prisma/client';
import { PrismaService } from '../../shared/prisma/prisma.service';
import {
  assertAppointmentInGarage,
  assertCustomerInGarage,
  assertVehicleInGarage,
  garageWhere,
  requireGarageId,
} from '../../shared/garage/garage-scope';
import { CreateAppointmentDto, UpdateAppointmentDto } from './dto/planning.dto';

@Injectable()
export class PlanningService {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateAppointmentDto, garageId?: string | null) {
    const g = requireGarageId(garageId);
    await assertCustomerInGarage(this.prisma, data.customerId, g);
    if (data.vehicleId) {
      await assertVehicleInGarage(this.prisma, data.vehicleId, g);
    }
    return this.prisma.appointment.create({
      data: { ...data, garageId: g },
    });
  }

  findAll(garageId?: string | null, date?: string, status?: AppointmentStatus) {
    const where: Record<string, unknown> = { ...garageWhere(garageId) };
    if (status) where.status = status;
    if (date) {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      where.scheduledAt = { gte: startOfDay, lte: endOfDay };
    }

    return this.prisma.appointment.findMany({
      where,
      include: { customer: true, vehicle: true },
      orderBy: { scheduledAt: 'asc' },
    });
  }

  async update(id: string, data: UpdateAppointmentDto, garageId?: string | null) {
    await assertAppointmentInGarage(this.prisma, id, garageId);
    return this.prisma.appointment.update({ where: { id }, data });
  }

  async remove(id: string, garageId?: string | null) {
    await assertAppointmentInGarage(this.prisma, id, garageId);
    return this.prisma.appointment.delete({ where: { id } });
  }
}
