import { Injectable } from '@nestjs/common';
import { AppointmentStatus } from '@prisma/client';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { CreateAppointmentDto, UpdateAppointmentDto } from './dto/planning.dto';

@Injectable()
export class PlanningService {
  constructor(private readonly prisma: PrismaService) {}

  create(data: CreateAppointmentDto) {
    return this.prisma.appointment.create({ data });
  }

  findAll(date?: string, status?: AppointmentStatus) {
    const where: Record<string, unknown> = {};
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

  update(id: string, data: UpdateAppointmentDto) {
    return this.prisma.appointment.update({ where: { id }, data });
  }

  /** Hard delete intentionnel — Appointment n'a pas de deletedAt */
  remove(id: string) {
    return this.prisma.appointment.delete({ where: { id } });
  }
}
