import {
  BadRequestException,
  ConflictException,
  GoneException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../shared/prisma/prisma.service';
import {
  TransactionalEmailService,
  type EmailSendResult,
} from '../../shared/email/transactional-email.service';
import { assertTeamMemberInGarage, requireGarageId } from '../../shared/garage/garage-scope';
import {
  hashInvitationToken,
  invitationHashMatches,
  isWellFormedInvitationToken,
  issueInvitation,
  type IssuedInvitation,
} from '../../shared/security/invitation-token';
import { AuthService } from '../auth/auth.service';
import { renderTeamInvitationEmail } from './team-invitation.email';

/** Résultat d'un envoi d'invitation, renvoyé au front (jamais le jeton). */
export type InvitationDelivery = {
  status: 'pending';
  email: string;
  expiresAt: string;
  emailStatus: EmailSendResult;
};

export type InvitationRecipient = {
  userId: string;
  email: string;
  firstName: string;
  roleCode: string | null;
  employeeCode: string | null;
  workshopName: string;
  invitedByName?: string | null;
};

const ERR = {
  invalid: () =>
    new NotFoundException({
      message: 'Ce lien d’invitation n’est pas valide.',
      errorCode: 'INVITATION_INVALID',
    }),
  expired: () =>
    new GoneException({
      message: 'Ce lien d’invitation a expiré. Demandez à votre administrateur de vous en renvoyer un.',
      errorCode: 'INVITATION_EXPIRED',
    }),
  used: () =>
    new ConflictException({
      message: 'Cette invitation a déjà été utilisée. Connectez-vous avec votre mot de passe.',
      errorCode: 'INVITATION_USED',
    }),
};

/**
 * Invitations sécurisées des employés (#15).
 *
 * Seule l'empreinte SHA-256 du jeton est en base ; le jeton brut ne vit que dans l'e-mail.
 * Un renvoi remplace l'empreinte (l'ancien lien meurt) ; l'acceptation est atomique
 * (UPDATE conditionnel) donc à usage unique même en cas de double clic / requêtes concurrentes.
 * L'empreinte est conservée après acceptation pour répondre INVITATION_USED plutôt qu'INVALID.
 */
@Injectable()
export class TeamInvitationService {
  private readonly logger = new Logger(TeamInvitationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: TransactionalEmailService,
    private readonly auth: AuthService,
  ) {}

  /** Nouveau jeton + champs Prisma (à écrire dans la même opération que la création du compte). */
  issue(now: Date = new Date()): IssuedInvitation {
    return issueInvitation(now);
  }

  /** Envoie l'e-mail d'invitation. Ne lève jamais (le compte existe déjà, l'admin pourra renvoyer). */
  async deliver(
    recipient: InvitationRecipient,
    invitation: Pick<IssuedInvitation, 'token'> & { expiresAt: Date; sentAt: Date },
  ): Promise<EmailSendResult> {
    const appUrl = TransactionalEmailService.resolveAppUrl();
    if (!appUrl) {
      this.logger.warn(
        `Invitation équipe (user ${recipient.userId}) non envoyée : APP_PUBLIC_URL ou APP_DOMAIN absent (lien impossible).`,
      );
      return 'skipped';
    }
    const { subject, html, text } = renderTeamInvitationEmail({
      firstName: recipient.firstName,
      roleCode: recipient.roleCode,
      employeeCode: recipient.employeeCode,
      email: recipient.email,
      workshopName: recipient.workshopName,
      invitedByName: recipient.invitedByName,
      expiresAt: invitation.expiresAt,
      appUrl,
      token: invitation.token,
    });
    return this.email.send({
      to: recipient.email,
      subject,
      html,
      text,
      // Une clé par envoi : un renvoi volontaire part, un retry du même envoi est ignoré.
      idempotencyKey: `team-invite/${recipient.userId}/${invitation.sentAt.getTime()}`,
      category: 'team_invitation',
      logLabel: `Invitation équipe (user ${recipient.userId})`,
      from: process.env.TEAM_INVITE_EMAIL_FROM?.trim() || undefined,
    });
  }

  /** Renvoi par un ADMIN : nouveau jeton, l'ancien lien devient invalide. */
  async resend(
    userId: string,
    garageId: string | null | undefined,
    invitedBy?: { firstName?: string | null; lastName?: string | null } | null,
  ): Promise<InvitationDelivery> {
    await assertTeamMemberInGarage(this.prisma, userId, garageId);
    const g = requireGarageId(garageId);
    const user = await this.prisma.user.findFirst({
      where: { id: userId, garageId: g, deletedAt: null },
      select: {
        id: true,
        email: true,
        firstName: true,
        employeeCode: true,
        status: true,
        inviteAcceptedAt: true,
        garage: { select: { name: true } },
        roles: { where: { revokedAt: null }, select: { role: { select: { code: true } } } },
      },
    });
    if (!user) throw new NotFoundException('Membre de l\'équipe introuvable');
    if (!user.email) {
      throw new BadRequestException({
        message: 'Ce membre n’a pas d’adresse e-mail : ajoutez-en une ou générez un mot de passe temporaire.',
        errorCode: 'INVITATION_NO_EMAIL',
      });
    }
    if (user.inviteAcceptedAt) {
      throw new ConflictException({
        message: 'Ce membre a déjà activé son compte.',
        errorCode: 'INVITATION_ALREADY_ACCEPTED',
      });
    }
    if (user.status !== 'ACTIVE') {
      throw new ConflictException({
        message: 'Réactivez d’abord ce compte avant de renvoyer une invitation.',
        errorCode: 'INVITATION_USER_INACTIVE',
      });
    }

    const invitation = this.issue();
    await this.prisma.user.update({ where: { id: user.id }, data: invitation.data, select: { id: true } });

    const inviter = [invitedBy?.firstName, invitedBy?.lastName].filter(Boolean).join(' ') || null;
    const emailStatus = await this.deliver(
      {
        userId: user.id,
        email: user.email,
        firstName: user.firstName,
        roleCode: user.roles[0]?.role.code ?? null,
        employeeCode: user.employeeCode,
        workshopName: user.garage?.name ?? 'votre atelier',
        invitedByName: inviter,
      },
      {
        token: invitation.token,
        expiresAt: invitation.data.inviteExpiresAt,
        sentAt: invitation.data.inviteSentAt,
      },
    );

    return {
      status: 'pending',
      email: user.email,
      expiresAt: invitation.data.inviteExpiresAt.toISOString(),
      emailStatus,
    };
  }

  /** Informations minimales pour la page publique d'activation. */
  async describe(token: string) {
    const user = await this.findValid(token, new Date());
    return {
      firstName: user.firstName,
      employeeCode: user.employeeCode,
      workshopName: user.garage?.name ?? null,
      expiresAt: user.inviteExpiresAt!.toISOString(),
    };
  }

  /** Acceptation : définit le mot de passe, consomme le jeton, ouvre la session. */
  async accept(token: string, password: string) {
    const now = new Date();
    const user = await this.findValid(token, now);
    const passwordHash = await bcrypt.hash(password, 10);

    // Usage unique garanti par la base : seule la première requête satisfait ce WHERE.
    const { count } = await this.prisma.user.updateMany({
      where: {
        id: user.id,
        inviteTokenHash: user.inviteTokenHash,
        inviteAcceptedAt: null,
        inviteExpiresAt: { gt: now },
        status: 'ACTIVE',
        deletedAt: null,
      },
      data: {
        passwordHash,
        mustChangePassword: false,
        passwordResetRequestedAt: null,
        inviteAcceptedAt: now,
        lastLoginAt: now,
        // Toute session antérieure (compte existant ré-invité) est révoquée.
        tokenVersion: { increment: 1 },
      },
    });
    if (count !== 1) throw ERR.used();

    const fresh = await this.prisma.user.findFirst({
      where: { id: user.id, deletedAt: null },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        employeeCode: true,
        tokenVersion: true,
        tenantId: true,
        garageId: true,
      },
    });
    if (!fresh) throw ERR.invalid();

    const access_token = await this.auth.signAccessToken(fresh);
    this.logger.log(`Invitation acceptée (user ${fresh.id})`);
    return {
      access_token,
      user: {
        id: fresh.id,
        firstName: fresh.firstName,
        lastName: fresh.lastName,
        email: fresh.email,
        employeeCode: fresh.employeeCode,
        mustChangePassword: false,
      },
    };
  }

  /** Recherche par empreinte + contrôles d'état ; codes d'erreur stables pour le front. */
  private async findValid(token: string, now: Date) {
    if (!isWellFormedInvitationToken(token)) throw ERR.invalid();
    const hash = hashInvitationToken(token);
    const user = await this.prisma.user.findFirst({
      where: { inviteTokenHash: hash, deletedAt: null },
      select: {
        id: true,
        firstName: true,
        employeeCode: true,
        status: true,
        inviteTokenHash: true,
        inviteExpiresAt: true,
        inviteAcceptedAt: true,
        garage: { select: { name: true } },
      },
    });
    if (!user?.inviteTokenHash || !invitationHashMatches(user.inviteTokenHash, hash)) throw ERR.invalid();
    if (user.inviteAcceptedAt) throw ERR.used();
    if (user.status !== 'ACTIVE') throw ERR.invalid();
    if (!user.inviteExpiresAt || user.inviteExpiresAt.getTime() <= now.getTime()) throw ERR.expired();
    return user;
  }
}
