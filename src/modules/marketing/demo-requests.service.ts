import { Injectable, NotFoundException } from '@nestjs/common';
import { DemoRequestStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { UpdateDemoRequestDto } from './dto/update-demo-request.dto';

const demoRequestSelect = {
  id: true,
  fullName: true,
  email: true,
  phone: true,
  garageName: true,
  city: true,
  message: true,
  status: true,
  adminNotes: true,
  handledById: true,
  createdAt: true,
  updatedAt: true,
  handledBy: {
    select: { id: true, firstName: true, lastName: true },
  },
} satisfies Prisma.DemoRequestSelect;

export type DemoRequestDto = Prisma.DemoRequestGetPayload<{ select: typeof demoRequestSelect }>;

@Injectable()
export class DemoRequestsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(params: {
    status?: DemoRequestStatus;
    q?: string;
    limit?: number;
    offset?: number;
  }): Promise<DemoRequestDto[]> {
    const limit = Math.min(params.limit ?? 50, 100);
    const offset = params.offset ?? 0;

    const where: Prisma.DemoRequestWhereInput = {};

    if (params.status) {
      where.status = params.status;
    }

    if (params.q?.trim()) {
      const q = params.q.trim();
      where.OR = [
        { fullName: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
        { garageName: { contains: q, mode: 'insensitive' } },
        { phone: { contains: q, mode: 'insensitive' } },
        { city: { contains: q, mode: 'insensitive' } },
      ];
    }

    return this.prisma.demoRequest.findMany({
      where,
      select: demoRequestSelect,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });
  }

  async getById(id: string): Promise<DemoRequestDto> {
    const row = await this.prisma.demoRequest.findUnique({
      where: { id },
      select: demoRequestSelect,
    });
    if (!row) {
      throw new NotFoundException('Demande de démo introuvable');
    }
    return row;
  }

  async countByStatus(status: DemoRequestStatus): Promise<number> {
    return this.prisma.demoRequest.count({ where: { status } });
  }

  async update(
    id: string,
    dto: UpdateDemoRequestDto,
    handledById: string,
  ): Promise<DemoRequestDto> {
    await this.getById(id);

    return this.prisma.demoRequest.update({
      where: { id },
      data: {
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.adminNotes !== undefined ? { adminNotes: dto.adminNotes } : {}),
        handledById,
      },
      select: demoRequestSelect,
    });
  }
}
