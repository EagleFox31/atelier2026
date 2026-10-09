import { ConflictException, GoneException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { quoteValidityEnd } from '../../shared/billing/quote-access-token';
import { hashOpaqueToken, isWellFormedOpaqueToken } from '../../shared/security/opaque-token';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { customerDisplayName } from '../customer-notifications';
import { NotificationsService } from '../notifications/notifications.service';
import { SubscriptionService } from '../subscription/subscription.service';
import { BillingService } from './billing.service';

export type PublicQuoteDecision = 'APPROVED' | 'REJECTED';

const linkInvalid = () =>
  new NotFoundException({ message: 'Ce lien de devis est invalide.', errorCode: 'QUOTE_LINK_INVALID' });
const linkExpired = (message = 'Ce lien de devis a expiré. Contactez le garage pour en recevoir un nouveau.') =>
  new GoneException({ message, errorCode: 'QUOTE_LINK_EXPIRED' });
const alreadyDecided = () =>
  new ConflictException({ message: 'Ce devis a déjà reçu une réponse.', errorCode: 'QUOTE_ALREADY_DECIDED' });

const ACCESS_INCLUDE = {
  garage: { select: { tenantId: true, name: true } },
  quote: {
    include: {
      customer: { select: { customerType: true, companyName: true, firstName: true, lastName: true } },
      lines: { orderBy: { sortOrder: 'asc' as const } },
      serviceOrder: {
        select: {
          id: true,
          reference: true,
          assignedChef: true,
          vehicle: { select: { plateNumber: true, make: { select: { name: true } }, model: { select: { name: true } } } },
        },
      },
    },
  },
};

/**
 * Lien public de devis (`/public/quotes/:token`) : le client consulte, valide ou refuse.
 *
 * - Jeton mal formé, inconnu, ou garage bloqué → 404 QUOTE_LINK_INVALID (rien n'est révélé).
 * - Lien révoqué (un plus récent existe), expiré, devis hors validité, garage en lecture seule
 *   pour une décision → 410 QUOTE_LINK_EXPIRED.
 * - Décision déjà prise (par ce lien ou au comptoir) → 409 QUOTE_ALREADY_DECIDED.
 * - Décision atomique : prise du jeton (`decidedAt IS NULL`) puis passage du devis
 *   `SENT → APPROVED|REJECTED` conditionnel ; deux clics simultanés ne décident qu'une fois.
 */
@Injectable()
export class PublicQuoteService {
  private readonly logger = new Logger(PublicQuoteService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly billing: BillingService,
    private readonly notifications: NotificationsService,
    private readonly subscriptions: SubscriptionService,
  ) {}

  async describe(token: string, now: Date = new Date()) {
    const access = await this.load(token);
    const summary = await this.subscriptions.getSummary(access.garage.tenantId);
    if (summary.blocked) throw linkInvalid();

    // Un devis déjà tranché reste consultable (le client y voit sa réponse).
    const decided = access.decidedAt !== null || access.quote.status !== 'SENT';
    const expired = decided ? null : this.expiry(access, now);
    if (expired) throw linkExpired(expired);

    await this.prisma.quoteAccessToken.update({ where: { id: access.id }, data: { lastViewedAt: now } });
    return this.view(access, decided, summary.readOnly);
  }

  async decide(token: string, decision: PublicQuoteDecision, reason?: string, now: Date = new Date()) {
    const access = await this.load(token);
    const summary = await this.subscriptions.getSummary(access.garage.tenantId);
    if (summary.blocked) throw linkInvalid();
    if (access.decidedAt !== null || access.quote.status !== 'SENT') throw alreadyDecided();
    const expired = this.expiry(access, now);
    if (expired) throw linkExpired(expired);
    if (summary.readOnly) throw linkExpired('Le garage ne peut pas enregistrer de réponse en ligne pour le moment. Contactez-le directement.');

    const claimed = await this.prisma.quoteAccessToken.updateMany({
      where: { id: access.id, decidedAt: null, revokedAt: null, expiresAt: { gt: now } },
      data: { decidedAt: now },
    });
    if (claimed.count === 0) throw alreadyDecided();

    const quoteId = access.quote.id;
    const updated = await this.prisma.quote.updateMany({
      where: { id: quoteId, garageId: access.garageId, status: 'SENT' },
      data:
        decision === 'APPROVED'
          ? { status: 'APPROVED', approvedByClientAt: now, clientApprovalMethod: 'DIGITAL' }
          : { status: 'REJECTED' },
    });
    if (updated.count === 0) throw alreadyDecided();

    if (decision === 'APPROVED') {
      // Effets identiques à l'approbation au comptoir ; l'auteur du devis porte les mouvements de stock.
      await this.billing.afterQuoteApproved(access.quote, access.quote.createdBy, access.garageId);
    } else {
      await this.notifyRejection(access, reason);
    }
    this.logger.log(`Devis ${access.quote.reference} ${decision === 'APPROVED' ? 'validé' : 'refusé'} par le client (lien public).`);
    return { status: decision };
  }

  private async load(token: string) {
    if (!isWellFormedOpaqueToken(token)) throw linkInvalid();
    const access = await this.prisma.quoteAccessToken.findUnique({
      where: { tokenHash: hashOpaqueToken(token) },
      include: ACCESS_INCLUDE,
    });
    if (!access || access.quote.garageId !== access.garageId) throw linkInvalid();
    return access;
  }

  /** Motif d'expiration, ou `null` si le lien est utilisable. */
  private expiry(
    access: { revokedAt: Date | null; expiresAt: Date; quote: { validUntil: Date | null } },
    now: Date,
  ): string | null {
    if (access.revokedAt) return 'Un lien plus récent vous a été envoyé pour ce devis.';
    if (access.expiresAt <= now) return 'Ce lien de devis a expiré. Contactez le garage pour en recevoir un nouveau.';
    const validityEnd = quoteValidityEnd(access.quote.validUntil);
    if (validityEnd && validityEnd <= now) return 'La validité de ce devis est dépassée. Contactez le garage.';
    return null;
  }

  private async notifyRejection(access: LoadedAccess, reason?: string) {
    try {
      const recipientIds = await this.notifications.getUserIdsByRoles(
        ['RECEPTIONNISTE', 'CHEF_ATELIER', 'ADMIN'],
        access.garageId,
      );
      const otRef = access.quote.serviceOrder?.reference;
      const cleanReason = reason?.replace(/\s+/g, ' ').trim().slice(0, 300);
      await this.notifications.createInApp({
        recipientIds,
        title: `Devis refusé — ${customerDisplayName(access.quote.customer) || 'Client'}`,
        body: `${access.quote.reference}${otRef ? ` (OT ${otRef})` : ''} a été refusé par le client.${cleanReason ? ` Motif : ${cleanReason}` : ''}`,
        link: `/billing/quotes/${access.quote.id}`,
        serviceOrderId: access.quote.serviceOrderId,
      });
    } catch (err) {
      this.logger.warn(`Échec notification refus devis ${access.quote.id}: ${(err as Error).message}`);
    }
  }

  /** Vue publique : aucun identifiant interne, aucune coordonnée du client. */
  private view(access: LoadedAccess, decided: boolean, readOnly: boolean) {
    const { quote } = access;
    const vehicle = quote.serviceOrder?.vehicle;
    return {
      garageName: access.garage.name,
      customerName: customerDisplayName(quote.customer),
      reference: quote.reference,
      status: quote.status,
      issuedAt: quote.sentAt ?? quote.createdAt,
      validUntil: quote.validUntil,
      approvedAt: quote.approvedByClientAt,
      vehicle: vehicle
        ? {
            plate: vehicle.plateNumber,
            label: [vehicle.make?.name, vehicle.model?.name].filter(Boolean).join(' ') || null,
          }
        : null,
      notes: quote.notes,
      lines: quote.lines.map((line) => ({
        lineType: line.lineType,
        description: line.description,
        quantity: Number(line.quantity),
        unitPriceXaf: Number(line.unitPriceXaf),
        discountPct: Number(line.discountPct),
        lineTotalXaf: Number(line.lineTotalXaf),
      })),
      subtotalXaf: Number(quote.subtotalXaf),
      taxRate: Number(quote.taxRate),
      taxAmountXaf: Number(quote.taxAmountXaf),
      stampDutyXaf: Number(quote.stampDutyXaf),
      totalXaf: Number(quote.totalXaf),
      canDecide: !decided && !readOnly,
    };
  }
}

type LoadedAccess = Awaited<ReturnType<PublicQuoteService['load']>>;
