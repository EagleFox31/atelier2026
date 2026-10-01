import { Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { generateTempPassword } from '../../shared/security/temp-password';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { assertTeamMemberInGarage, garageWhere, requireGarageId } from '../../shared/garage/garage-scope';

@Injectable()
export class TeamService {
    constructor(private prisma: PrismaService) { }

    async findAll(search?: string, roleId?: string, garageId?: string | null) {
        const where: any = { deletedAt: null, ...garageWhere(garageId) };
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
            select: {
                id: true,
                employeeCode: true,
                firstName: true,
                lastName: true,
                email: true,
                phone: true,
                specialty: true,
                status: true,
                mustChangePassword: true,
                passwordResetRequestedAt: true,
                lastLoginAt: true,
                roles: {
                    where: { revokedAt: null },
                    include: { role: true }
                },
                assignedOTs: {
                    where: { status: { notIn: ['CLOSED', 'CANCELLED'] } },
                    select: { id: true, reference: true, status: true }
                },
                createdAt: true,
            },
            orderBy: { firstName: 'asc' },
        });
    }

    async findOne(id: string, garageId?: string | null) {
        await assertTeamMemberInGarage(this.prisma, id, garageId);
        const g = requireGarageId(garageId);
        const user = await this.prisma.user.findFirst({
            where: { id, garageId: g, deletedAt: null },
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

    async create(data: { firstName: string; lastName: string; email?: string; phone?: string; roleCode?: string; specialty?: string; password?: string; garageId?: string; tenantId?: string }) {
        const g = requireGarageId(data.garageId);
        const tenantId = data.tenantId;
        // Mot de passe défini par un tiers (ADMIN ou généré) : jamais stocké en clair,
        // renvoyé une seule fois, changement imposé à la première connexion.
        const plainPassword = data.password ?? generateTempPassword();
        const passwordHash = await bcrypt.hash(plainPassword, 10);
        const employeeCode = await this.generateEmployeeCode(data.firstName, data.lastName);

        const user = await this.prisma.user.create({
            data: {
                employeeCode,
                firstName: data.firstName,
                lastName: data.lastName,
                email: data.email,
                phone: data.phone,
                specialty: data.specialty,
                passwordHash,
                mustChangePassword: true,
                garageId: g,
                ...(tenantId ? { tenantId } : {}),
            },
            select: { id: true, employeeCode: true, firstName: true, lastName: true, email: true, phone: true, status: true, specialty: true },
        });

        if (data.roleCode) {
            const role = await this.prisma.role.findUnique({ where: { code: data.roleCode } });
            if (role) {
                await this.prisma.userRole.create({ data: { userId: user.id, roleId: role.id } });
            }
        }

        // Affichage unique côté front (contrat de réponse « tempPassword » conservé).
        return { ...user, tempPassword: plainPassword };
    }

    async resetPassword(id: string, password?: string, garageId?: string | null) {
        const user = await this.findOne(id, garageId);
        const plainPassword = password ?? generateTempPassword();
        const passwordHash = await bcrypt.hash(plainPassword, 10);
        const updated = await this.prisma.user.update({
            where: { id },
            data: {
                passwordHash,
                mustChangePassword: true,
                passwordResetRequestedAt: null,
                // Les sessions ouvertes avec l'ancien mot de passe sont révoquées.
                tokenVersion: { increment: 1 },
            },
            select: { id: true, employeeCode: true, firstName: true, lastName: true },
        });
        return { ...updated, tempPassword: plainPassword };
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

    async update(id: string, data: any, garageId?: string | null) {
        await this.findOne(id, garageId);
        return this.prisma.user.update({
            where: { id },
            data,
            select: { id: true, employeeCode: true, firstName: true, lastName: true, email: true, phone: true, status: true },
        });
    }

    async toggleStatus(id: string, garageId?: string | null) {
        const user = await this.findOne(id, garageId);
        const newStatus = user.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
        return this.prisma.user.update({
            where: { id },
            data: { status: newStatus },
            select: { id: true, status: true, firstName: true, lastName: true },
        });
    }

    async assignRole(id: string, roleCode: string, garageId?: string | null) {
        await this.findOne(id, garageId);
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

    async remove(id: string, garageId?: string | null) {
        await this.findOne(id, garageId);
        return this.prisma.user.update({
            where: { id },
            data: { deletedAt: new Date(), status: 'DELETED' },
            select: { id: true }
        });
    }
}
