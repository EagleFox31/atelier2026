import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { JwtSecretsService } from '../auth/jwt-secrets.service';
import { DEFAULT_WORKSHOP_SETTINGS } from '../settings/settings.service';
import { SignupDto } from './dto/signup.dto';
import { SignupEmailService } from './signup-email.service';
import { generateTempPassword } from '../../shared/security/temp-password';
import { unusablePassword, type IssuedInvitation } from '../../shared/security/invitation-token';
import { TeamInvitationService, type InvitationDelivery } from '../team/team-invitation.service';
import type { WelcomeTeamMember } from './signup-welcome.email';

const ALLOWED_TEAM_ROLES = new Set([
  'CHEF_ATELIER',
  'RECEPTIONNISTE',
  'TECHNICIEN',
  'CAISSIER',
]);

export type SignupTeamResult = {
  roleCode: string;
  firstName: string;
  lastName: string;
  email: string | null;
  employeeCode: string;
  /** Membre sans e-mail : mot de passe temporaire affiché une seule fois. */
  tempPassword?: string;
  /** Membre avec e-mail : invitation envoyée (jamais de mot de passe). */
  invitation?: InvitationDelivery;
};

/**
 * Membres présentés dans l'e-mail de bienvenue : liste blanche explicite des champs.
 * Le mot de passe temporaire (et tout champ ajouté plus tard) n'en fait jamais partie.
 */
export function toWelcomeTeam(team: SignupTeamResult[]): WelcomeTeamMember[] {
  return team.map(({ roleCode, firstName, lastName, employeeCode }) => ({
    roleCode,
    firstName,
    lastName,
    employeeCode,
  }));
}

@Injectable()
export class SignupService {
  private readonly logger = new Logger(SignupService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly jwtSecrets: JwtSecretsService,
    private readonly signupEmail: SignupEmailService,
    private readonly invitations: TeamInvitationService,
  ) {}

  isPublicSignupEnabled(): boolean {
    return process.env.PUBLIC_SIGNUP_ENABLED !== 'false';
  }

  async getStatus(): Promise<{ available: boolean; reason?: string }> {
    if (!this.isPublicSignupEnabled()) {
      return { available: false, reason: 'Inscriptions publiques désactivées.' };
    }
    // Multi-tenant : chaque inscription crée un nouveau tenant — toujours disponible
    return { available: true };
  }

  async register(dto: SignupDto) {
    const status = await this.getStatus();
    if (!status.available) {
      throw new ForbiddenException(status.reason ?? 'Inscription indisponible.');
    }

    const emailTaken = await this.prisma.user.findFirst({
      where: { email: dto.admin.email.trim().toLowerCase(), deletedAt: null },
    });
    if (emailTaken) {
      throw new ConflictException('Cet email est déjà utilisé.');
    }

    const adminRole = await this.prisma.role.findUnique({ where: { code: 'ADMIN' } });
    if (!adminRole) {
      throw new ConflictException('Configuration des rôles incomplète. Contactez le support.');
    }

    const adminPasswordHash = await bcrypt.hash(dto.admin.password, 10);
    const workshopAddress = dto.workshop.city
      ? `${dto.workshop.address.trim()} — ${dto.workshop.city.trim()}`
      : dto.workshop.address.trim();

    const tenantSlug = await this.generateSlug(dto.workshop.shopName, 'tenant');
    const garageSlug = 'principal';

    // Le pilote démarre uniquement quand la création réelle de l'espace commence.
    const trialStartedAt = new Date();
    const trialEndsAt = new Date(trialStartedAt.getTime() + 30 * 24 * 60 * 60 * 1000);
    const graceEndsAt = new Date(trialEndsAt.getTime() + 7 * 24 * 60 * 60 * 1000);
    const dataRetentionEndsAt = new Date(trialEndsAt.getTime() + 90 * 24 * 60 * 60 * 1000);

    const teamCreated: SignupTeamResult[] = [];
    const pendingInvitations: Array<{
      result: SignupTeamResult;
      userId: string;
      email: string;
      invitation: IssuedInvitation;
    }> = [];

    const admin = await this.prisma.$transaction(async (tx) => {
      // 1. Créer le tenant
      const tenant = await tx.tenant.create({
        data: {
          slug: tenantSlug,
          name: dto.workshop.shopName.trim(),
          email: dto.admin.email.trim().toLowerCase(),
          plan: 'pro',
          subscriptionStatus: 'TRIAL',
          trialStartedAt,
          trialEndsAt,
          graceEndsAt,
          dataRetentionEndsAt,
        },
      });

      // 2. Créer le garage principal
      const garage = await tx.garage.create({
        data: {
          tenantId: tenant.id,
          slug: garageSlug,
          name: dto.workshop.shopName.trim(),
          city: dto.workshop.city?.trim() || '',
          address: workshopAddress,
          phone: dto.workshop.phone.trim(),
          niu: dto.workshop.niu?.trim() || null,
        },
      });

      // 3. Créer le compte admin lié au tenant et au garage
      const createdAdmin = await tx.user.create({
        data: {
          tenantId: tenant.id,
          garageId: garage.id,
          firstName: dto.admin.firstName.trim(),
          lastName: dto.admin.lastName.trim(),
          email: dto.admin.email.trim().toLowerCase(),
          phone: dto.admin.phone?.trim() || null,
          passwordHash: adminPasswordHash,
          employeeCode: await this.generateEmployeeCode(
            dto.admin.firstName,
            dto.admin.lastName,
            tx,
          ),
          onboardingCompletedAt: null,
          lastLoginAt: new Date(),
        },
      });

      await tx.userRole.create({
        data: { userId: createdAdmin.id, roleId: adminRole.id },
      });

      // 4. Créer les paramètres de l'atelier liés au garage
      await tx.workshopSettings.upsert({
        where: { id: `garage_${garage.id}` },
        create: {
          ...DEFAULT_WORKSHOP_SETTINGS,
          id: `garage_${garage.id}`,
          garageId: garage.id,
          shopName: dto.workshop.shopName.trim(),
          tagline:
            dto.workshop.tagline?.trim() ||
            `Garage automobile — ${dto.workshop.city?.trim() || 'Cameroun'}`,
          niu: dto.workshop.niu?.trim() || null,
          email: dto.workshop.email.trim().toLowerCase(),
          phone: dto.workshop.phone.trim(),
          address: workshopAddress,
          defaultLaborRateXaf:
            dto.workshop.defaultLaborRateXaf ?? DEFAULT_WORKSHOP_SETTINGS.defaultLaborRateXaf,
          updatedById: createdAdmin.id,
        },
        update: {},
      });

      // 5. Créer les membres d'équipe (optionnel)
      for (const member of dto.team ?? []) {
        if (!ALLOWED_TEAM_ROLES.has(member.roleCode)) continue;

        const role = await tx.role.findUnique({ where: { code: member.roleCode } });
        if (!role) continue;

        // Avec e-mail : invitation (l'employé choisit son mot de passe). Sans : mot de passe
        // temporaire affiché une seule fois, changement imposé.
        const memberEmail = member.email?.trim().toLowerCase() || null;
        const invitation = memberEmail ? this.invitations.issue() : null;
        const plainPassword = invitation ? null : generateTempPassword();
        const passwordHash = await bcrypt.hash(plainPassword ?? unusablePassword(), 10);
        const employeeCode = await this.generateEmployeeCode(
          member.firstName,
          member.lastName,
          tx,
        );

        const user = await tx.user.create({
          data: {
            tenantId: tenant.id,
            garageId: garage.id,
            employeeCode,
            firstName: member.firstName.trim(),
            lastName: member.lastName.trim(),
            email: memberEmail,
            phone: member.phone?.trim() || null,
            passwordHash,
            mustChangePassword: !invitation,
            ...(invitation ? invitation.data : {}),
          },
        });

        await tx.userRole.create({
          data: { userId: user.id, roleId: role.id, assignedBy: createdAdmin.id },
        });

        const result: SignupTeamResult = {
          roleCode: member.roleCode,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          employeeCode,
          ...(plainPassword ? { tempPassword: plainPassword } : {}),
        };
        teamCreated.push(result);
        if (invitation && memberEmail) {
          pendingInvitations.push({ result, userId: user.id, email: memberEmail, invitation });
        }
      }

      return createdAdmin;
    });

    const payload = {
      sub: admin.id,
      email: admin.email,
      version: admin.tokenVersion,
    };

    const access_token = await this.jwtService.signAsync(payload, {
      secret: this.jwtSecrets.getSigningSecret(),
      expiresIn: this.jwtSecrets.getExpiresIn(),
    });

    this.logger.log(
      `Inscription « ${dto.workshop.shopName} » (tenant: ${tenantSlug}) — admin ${admin.email} + ${teamCreated.length} membre(s)`,
    );

    // Après commit, sans bloquer la réponse : un e-mail en échec ne doit jamais
    // faire échouer l'inscription (sendWelcome ne lève pas). Aucun mot de passe transmis.
    if (admin.tenantId && admin.email) {
      void this.signupEmail.sendWelcome(admin.tenantId, {
        adminFirstName: admin.firstName,
        adminEmail: admin.email,
        adminEmployeeCode: admin.employeeCode,
        workshopName: dto.workshop.shopName.trim(),
        trialEndsAt,
        team: toWelcomeTeam(teamCreated),
      });
    }

    // Invitations envoyées après commit (un e-mail ne part jamais pour un compte annulé).
    // deliver() ne lève pas : un échec est signalé au front, l'admin pourra renvoyer.
    const shopName = dto.workshop.shopName.trim();
    const inviter = `${admin.firstName} ${admin.lastName}`.trim();
    await Promise.all(
      pendingInvitations.map(async ({ result, userId, email, invitation }) => {
        const emailStatus = await this.invitations.deliver(
          {
            userId,
            email,
            firstName: result.firstName,
            roleCode: result.roleCode,
            employeeCode: result.employeeCode,
            workshopName: shopName,
            invitedByName: inviter,
          },
          {
            token: invitation.token,
            expiresAt: invitation.data.inviteExpiresAt,
            sentAt: invitation.data.inviteSentAt,
          },
        );
        result.invitation = {
          status: 'pending',
          email,
          expiresAt: invitation.data.inviteExpiresAt.toISOString(),
          emailStatus,
        };
      }),
    );

    return {
      access_token,
      user: {
        id: admin.id,
        firstName: admin.firstName,
        lastName: admin.lastName,
        email: admin.email,
        employeeCode: admin.employeeCode,
      },
      teamCreated,
    };
  }

  /** Génère un slug URL-safe depuis un nom, avec déduplication DB. */
  private async generateSlug(name: string, type: 'tenant' | 'garage'): Promise<string> {
    const base = name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40);

    if (type === 'tenant') {
      const exists = await this.prisma.tenant.findUnique({ where: { slug: base } });
      if (!exists) return base;
      for (let i = 2; i < 100; i++) {
        const candidate = `${base}-${i}`;
        const found = await this.prisma.tenant.findUnique({ where: { slug: candidate } });
        if (!found) return candidate;
      }
    }
    return `${base}-${Date.now()}`;
  }

  private async generateEmployeeCode(
    firstName: string,
    lastName: string,
    tx: Pick<PrismaService, 'user'>,
  ): Promise<string> {
    const normalize = (s: string) =>
      s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]/g, '');

    const base = `${normalize(firstName)}.${normalize(lastName)}`;
    const exists = await tx.user.findUnique({ where: { employeeCode: base } });
    if (!exists) return base;

    for (let i = 2; i < 100; i++) {
      const candidate = `${base}${i}`;
      const found = await tx.user.findUnique({ where: { employeeCode: candidate } });
      if (!found) return candidate;
    }
    return `${base}-${Date.now()}`;
  }
}
