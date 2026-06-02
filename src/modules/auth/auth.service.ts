
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { JwtSecretsService } from './jwt-secrets.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private jwtSecrets: JwtSecretsService,
  ) {}

  async login(identifier: string, password: string) {
    // Login par email OU code employé (Point 6)
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email: identifier },
          { employeeCode: identifier },
        ],
        deletedAt: null,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Identifiants invalides');
    }

    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Compte désactivé');
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Identifiants invalides');
    }

    const payload = {
      sub: user.id,
      email: user.email,
      version: user.tokenVersion,
      tenantId: user.tenantId ?? null,
      garageId: user.garageId ?? null,
    };
    
    // Mise à jour de la date de dernière connexion
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return {
      access_token: await this.jwtService.signAsync(payload, {
        secret: this.jwtSecrets.getSigningSecret(),
        expiresIn: this.jwtSecrets.getExpiresIn(),
      }),
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        employeeCode: user.employeeCode,
      },
    };
  }

  /**
   * Logout (Point 6) : Incrément de tokenVersion pour invalider tous les tokens existants
   */
  async logout(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        tokenVersion: { increment: 1 },
      },
    });
    return { success: true, message: 'Déconnecté avec succès (sessions invalidées)' };
  }

  async completeOnboarding(userId: string) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { onboardingCompletedAt: new Date() },
      select: { onboardingCompletedAt: true },
    });

    return {
      onboardingCompletedAt: user.onboardingCompletedAt?.toISOString() ?? null,
    };
  }

  async forgotPassword(identifier: string) {
    // Trouve l'employé par email ou identifiant
    const user = await this.prisma.user.findFirst({
      where: {
        deletedAt: null,
        OR: [{ email: identifier }, { employeeCode: identifier }],
      },
      select: { id: true, firstName: true, lastName: true, garageId: true },
    });

    // Toujours répondre OK — ne pas révéler si le compte existe
    if (!user) return { message: 'Demande transmise à l\'administrateur.' };

    // Marquer la demande de reset
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordResetRequestedAt: new Date() },
    });

    // ADMIN du même garage (+ SUPER_ADMIN plateforme si pas de garage sur le demandeur)
    const adminWhere: Record<string, unknown> = {
      revokedAt: null,
      role: { code: { in: ['ADMIN', 'SUPER_ADMIN'] } },
      user: {
        deletedAt: null,
        status: 'ACTIVE',
        ...(user.garageId ? { garageId: user.garageId } : {}),
      },
    };

    const adminUserRoles = await this.prisma.userRole.findMany({
      where: adminWhere,
      select: { userId: true },
      distinct: ['userId'],
    });

    const adminIds = adminUserRoles.map(ur => ur.userId);
    if (adminIds.length === 0) return { message: 'Demande transmise à l\'administrateur.' };

    // Créer une notification in-app pour chaque admin
    const fullName = `${user.firstName} ${user.lastName}`;
    await this.prisma.$transaction(
      adminIds.map(recipientId =>
        this.prisma.inAppNotification.create({
          data: {
            recipientId,
            title: 'Demande de réinitialisation de mot de passe',
            body: `${fullName} a demandé une réinitialisation de son mot de passe.`,
            link: '/team',
          },
        }),
      ),
    );

    return { message: 'Demande transmise à l\'administrateur.' };
  }
}
