import { Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../shared/prisma/prisma.service';

@Injectable()
export class TeamService {
    constructor(private prisma: PrismaService) { }

    async findAll(search?: string, roleId?: string) {
        const where: any = { deletedAt: null };
        if (search) {
            where.OR = [
                { firstName: { contains: search, mode: 'insensitive' } },
                { lastName: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
                { employeeCode: { contains: search, mode: 'insensitive' } },
            ];
        }

        // Filtre par rôle assigné en ce moment
        if (roleId) {
            where.roles = {
                some: {
                    roleId: roleId,
                    revokedAt: null
                }
            };
        }

        return this.prisma.user.findMany({
            where,
            select: { // Exclut le mot de passe
                id: true,
                employeeCode: true,
                firstName: true,
                lastName: true,
                email: true,
                phone: true,
                status: true,
                roles: {
                    where: { revokedAt: null },
                    include: { role: true }
                },
                createdAt: true,
            },
            orderBy: { firstName: 'asc' },
        });
    }

    async findOne(id: string) {
        const user = await this.prisma.user.findUnique({
            where: { id, deletedAt: null },
            select: {
                id: true,
                employeeCode: true,
                firstName: true,
                lastName: true,
                email: true,
                phone: true,
                status: true,
                lastLoginAt: true,
                roles: {
                    where: { revokedAt: null },
                    include: { role: true }
                },
                assignedOTs: {
                    where: { status: { notIn: ['CLOSED', 'CANCELLED'] } },
                    include: { vehicle: true }
                },
                workItems: {
                    where: { status: 'IN_PROGRESS' },
                    include: { serviceOrder: { select: { reference: true } } }
                }
            },
        });

        if (!user) throw new NotFoundException('Membre de l\'équipe introuvable');
        return user;
    }

    async create(data: { firstName: string; lastName: string; email?: string; phone?: string; roleCode?: string; password?: string }) {
        const passwordHash = await bcrypt.hash(data.password ?? 'Atelier2026!', 10);
        const employeeCode = await this.generateEmployeeCode();

        const user = await this.prisma.user.create({
            data: {
                employeeCode,
                firstName: data.firstName,
                lastName: data.lastName,
                email: data.email,
                phone: data.phone,
                passwordHash,
            },
            select: { id: true, employeeCode: true, firstName: true, lastName: true, email: true, phone: true, status: true },
        });

        if (data.roleCode) {
            const role = await this.prisma.role.findUnique({ where: { code: data.roleCode } });
            if (role) {
                await this.prisma.userRole.create({ data: { userId: user.id, roleId: role.id } });
            }
        }

        return user;
    }

    /** Prochain code EMP-NNN — inclut les comptes soft-deleted (unicité DB). */
    private async generateEmployeeCode(): Promise<string> {
        const rows = await this.prisma.$queryRaw<{ employee_code: string }[]>`
            SELECT employee_code FROM users
            WHERE employee_code LIKE 'EMP-%'
            ORDER BY CAST(SUBSTRING(employee_code FROM 5) AS INTEGER) DESC
            LIMIT 1
        `;
        const lastNum = rows[0]?.employee_code
            ? parseInt(rows[0].employee_code.slice(4), 10)
            : 0;
        if (Number.isNaN(lastNum)) {
            throw new Error(`Code employé invalide en base : ${rows[0]?.employee_code}`);
        }
        return `EMP-${String(lastNum + 1).padStart(3, '0')}`;
    }

    async update(id: string, data: any) {
        await this.findOne(id);
        return this.prisma.user.update({
            where: { id },
            data,
            select: { id: true, employeeCode: true, firstName: true, lastName: true, email: true, phone: true, status: true },
        });
    }

    async assignRole(id: string, roleCode: string) {
        await this.findOne(id);
        const role = await this.prisma.role.findUnique({ where: { code: roleCode } });
        if (!role) throw new NotFoundException(`Rôle '${roleCode}' introuvable`);

        // Révoquer les rôles actifs existants
        await this.prisma.userRole.updateMany({
            where: { userId: id, revokedAt: null },
            data: { revokedAt: new Date() },
        });

        return this.prisma.userRole.create({
            data: { userId: id, roleId: role.id },
            include: { role: true },
        });
    }

    async remove(id: string) {
        await this.findOne(id);
        return this.prisma.user.update({
            where: { id },
            data: { deletedAt: new Date(), status: 'DELETED' },
            select: { id: true }
        });
    }
}
