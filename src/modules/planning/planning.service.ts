import { Injectable } from '@nestjs/common';
import { AppointmentStatus, type Appointment } from '@prisma/client';
import { PrismaService } from '../../shared/prisma/prisma.service';
import {
  assertAppointmentInGarage,
  assertCustomerInGarage,
  assertVehicleInGarage,
  garageWhere,
  requireGarageId,
} from '../../shared/garage/garage-scope';
import {
  CustomerNotificationEmitter,
  formatNotificationDate,
  formatNotificationTime,
  notificationKeys,
} from '../customer-notifications';
import { CreateAppointmentDto, UpdateAppointmentDto } from './dto/planning.dto';

/** RDV encore à venir : seuls ceux-là donnent lieu à une confirmation client. */
const ACTIVE_APPOINTMENT_STATUSES = new Set<AppointmentStatus>([
  AppointmentStatus.SCHEDULED,
  AppointmentStatus.CONFIRMED,
]);

@Injectable()
export class PlanningService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly customerNotifications: CustomerNotificationEmitter,
  ) {}

  async create(data: CreateAppointmentDto, garageId?: string | null) {
    const g = requireGarageId(garageId);
    await assertCustomerInGarage(this.prisma, data.customerId, g);
    if (data.vehicleId) {
      await assertVehicleInGarage(this.prisma, data.vehicleId, g);
    }
    const appointment = await this.prisma.appointment.create({
      data: { ...data, garageId: g },
    });
    this.notifyAppointmentConfirmed(appointment);
    return appointment;
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
    const appointment = await this.prisma.appointment.update({ where: { id }, data });
    // Replanifié ou confirmé : nouvelle confirmation (la clé porte l'horaire, un
    // même horaire n'est jamais confirmé deux fois).
    if (data.scheduledAt !== undefined || data.status === AppointmentStatus.CONFIRMED) {
      this.notifyAppointmentConfirmed(appointment);
    }
    return appointment;
  }

  async remove(id: string, garageId?: string | null) {
    await assertAppointmentInGarage(this.prisma, id, garageId);
    return this.prisma.appointment.delete({ where: { id } });
  }

  private notifyAppointmentConfirmed(appointment: Appointment) {
    if (!ACTIVE_APPOINTMENT_STATUSES.has(appointment.status)) return;
    this.customerNotifications.emitInBackground('APPOINTMENT_CONFIRMED', async () => ({
      garageId: appointment.garageId,
      eventType: 'APPOINTMENT_CONFIRMED',
      idempotencyKey: notificationKeys.appointmentConfirmed(appointment.id, appointment.scheduledAt),
      customerId: appointment.customerId,
      refs: { appointmentId: appointment.id },
      variables: {
        date: formatNotificationDate(appointment.scheduledAt),
        time: formatNotificationTime(appointment.scheduledAt),
      },
    }));
  }
}
