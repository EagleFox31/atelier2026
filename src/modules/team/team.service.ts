import { Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { generateTempPassword } from '../../shared/security/temp-password';
import { invitationStatusOf, unusablePassword } from '../../shared/security/invitation-token';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { assertTeamMemberInGarage, garageWhere, requireGarageId } from '../../shared/garage/garage-scope';
import { TeamInvitationService, type InvitationDelivery } from './team-invitation.service';

@Injectable()
export class TeamService {
    constructor(
        private prisma: PrismaService,
        private invitations: TeamInvitationService,
    ) { }

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

        const members = await this.prisma.user.findMany({
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
                inviteTokenHash: true,
                inviteExpiresAt: true,
                inviteSentAt: true,
                inviteAcceptedAt: true,
            },
            orderBy: { firstName: 'asc' },
        });

        // Statut d'invitation dérivé ; l'empreinte du jeton ne quitte jamais l'API.
        const now = new Date();
        return members.map(({ inviteTokenHash, ...member }) => ({
            ...member,
            invitationStatus: invitationStatusOf({ ...member, inviteTokenHash }, now),
        }));
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

    async create(data: {
        firstName: string; lastName: string; email?: string; phone?: string; roleCode?: string;
        specialty?: string; password?: string; garageId?: string; tenantId?: string;
        invitedBy?: { firstName?: string | null; lastName?: string | null };
    }) {
        const g = requireGarageId(data.garageId);
        const tenantId = data.tenantId;
        const email = data.email?.trim().toLowerCase() || undefined;
        // Avec e-mail (et sans mot de passe imposé par l'appelant) : invitation, l'employé
        // choisit lui-même son mot de passe. Le compte reçoit un mot de passe aléatoire
        // jamais communiqué : aucune connexion possible avant l'acceptation.
        const invitation = email && !data.password ? this.invitations.issue() : null;
        // Sinon, mot de passe défini par un tiers (ADMIN ou généré) : jamais stocké en clair,
        // renvoyé une seule fois, changement imposé à la première connexion.
        const plainPassword = invitation ? null : (data.password ?? generateTempPassword());
        const passwordHash = await bcrypt.hash(plainPassword ?? unusablePassword(), 10);
        const employeeCode = await this.generateEmployeeCode(data.firstName, data.lastName);

        const user = await this.prisma.user.create({
            data: {
                employeeCode,
                firstName: data.firstName,
                lastName: data.lastName,
                email,
                phone: data.phone,
                specialty: data.specialty,
                passwordHash,
                mustChangePassword: !invitation,
                garageId: g,
                ...(tenantId ? { tenantId } : {}),
                ...(invitation ? invitation.data : {}),
            },
            select: { id: true, employeeCode: true, firstName: true, lastName: true, email: true, phone: true, status: true, specialty: true },
        });

        if (data.roleCode) {
            const role = await this.prisma.role.findUnique({ where: { code: data.roleCode } });
            if (role) {
                await this.prisma.userRole.create({ data: { userId: user.id, roleId: role.id } });
            }
        }

        if (invitation && email) {
            const garage = await this.prisma.garage.findFirst({ where: { id: g }, select: { name: true } });
            const inviter = [data.invitedBy?.firstName, data.invitedBy?.lastName].filter(Boolean).join(' ') || null;
            const emailStatus = await this.invitations.deliver(
                {
                    userId: user.id,
                    email,
                    firstName: data.firstName,
                    roleCode: data.roleCode ?? null,
                    employeeCode,
                    workshopName: garage?.name ?? 'votre atelier',
                    invitedByName: inviter,
                },
                {
                    token: invitation.token,
                    expiresAt: invitation.data.inviteExpiresAt,
                    sentAt: invitation.data.inviteSentAt,
                },
            );
            const delivery: InvitationDelivery = {
                status: 'pending',
                email,
                expiresAt: invitation.data.inviteExpiresAt.toISOString(),
                emailStatus,
            };
            return { ...user, invitation: delivery };
        }

        // Affichage unique côté front (contrat de réponse « tempPassword » conservé).
        return { ...user, tempPassword: plainPassword as string };
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
                // Repli sur le mot de passe temporaire : un lien d'invitation en cours devient invalide.
                inviteTokenHash: null,
                inviteExpiresAt: null,
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
        const current = await this.findOne(id, garageId);
        if (data?.email !== undefined && data.email !== current.email) {
            // Adresse modifiée : le lien envoyé à l'ancienne adresse ne doit plus servir.
            const now = new Date();
            await this.prisma.user.updateMany({
                where: { id, inviteAcceptedAt: null, inviteTokenHash: { not: null }, inviteExpiresAt: { gt: now } },
                data: { inviteExpiresAt: now },
            });
        }
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
