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
        const employeeCode = await this.generateEmployeeCode(data.firstName, data.lastName);

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

    /** Génère prenom.nom (ex: jean.dupont), avec suffixe numérique si doublon. */
    private async generateEmployeeCode(firstName: string, lastName: string): Promise<string> {
        const normalize = (s: string) =>
            s.toLowerCase()
             .normalize('NFD').replace(/[̀-ͯ]/g, '')
             .replace(/[^a-z]/g, '');

        const base = `${normalize(firstName)}.${normalize(lastName)}`;

        const exists = await this.prisma.user.findUnique({ where: { employeeCode: base } });
        if (!exists) return base;

        for (let i = 2; i < 100; i++) {
            const candidate = `${base}${i}`;
            const found = await this.prisma.user.findUnique({ where: { employeeCode: candidate } });
            if (!found) return candidate;
        }
        return `${base}-${Date.now()}`;
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
