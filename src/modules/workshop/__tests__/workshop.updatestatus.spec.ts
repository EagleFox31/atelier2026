import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { OTStatus, PartStatus } from '@prisma/client';
import { WorkshopService } from '../workshop.service';

// ─── Factories ────────────────────────────────────────────────────────────────

function makeOT(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'ot-1',
    status: OTStatus.DRAFT,
    version: 3,
    mileageIn: null,
    customerId: 'cust-1',
    cancellationReason: null,
    closedAt: null,
    vehicle: null,
    vehicleId: 'veh-1',
    workItems: [],
    quotes: [],
    observations: [],
    ...overrides,
  };
}

function makeUser(roleCodes: string[]) {
  return {
    id: 'user-1',
    roles: roleCodes.map((code) => ({ role: { code } })),
  };
}

function makeDeps() {
  const prismaMock = {
    serviceOrder: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    quote: {
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      findFirst: jest.fn().mockResolvedValue(null),
    },
    customer: {
      findUnique: jest.fn().mockResolvedValue(null),
    },
    user: {
      findUnique: jest.fn().mockResolvedValue(null),
    },
    vehicle: {
      findUnique: jest.fn().mockResolvedValue(null),
    },
    $executeRaw: jest.fn().mockResolvedValue(1),
  };
  const auditMock    = { log: jest.fn() };
  const notifMock    = {
    notifyUsers: jest.fn(),
    getInbox: jest.fn(),
    getUnreadCount: jest.fn(),
    markRead: jest.fn(),
    markAllRead: jest.fn(),
    getUserIdsByRoles: jest.fn().mockResolvedValue(['chef-1', 'admin-1']),
    createInApp: jest.fn().mockResolvedValue([]),
  };
  const partsFlowMock = {
    onQuoteApproved: jest.fn().mockResolvedValue({ reserved: 0, aspCreated: 0, missingCount: 0 }),
    consumeReservedParts: jest.fn().mockResolvedValue({ consumed: 0 }),
    releaseReservationsForOrder: jest.fn().mockResolvedValue(undefined),
    reconcilePartsAtQc: jest.fn().mockResolvedValue({ reconciled: 0 }),
  };
  const smsQueueMock = { add: jest.fn() };

  const service = new WorkshopService(
    prismaMock as any,
    auditMock as any,
    notifMock as any,
    partsFlowMock as any,
    smsQueueMock as any,
  );
  return { service, prismaMock, auditMock, notifMock, smsQueueMock, partsFlowMock };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('WorkshopService.updateStatus()', () => {
  beforeEach(() => jest.clearAllMocks());

  // ── Garde-fous de base ────────────────────────────────────────────────────────

  it('lève NotFoundException si l\'OT est introuvable', async () => {
    const { service, prismaMock } = makeDeps();
    prismaMock.serviceOrder.findUnique.mockResolvedValue(null);

    await expect(
      service.updateStatus('ot-inexistant', OTStatus.RECEIVED, makeUser(['ADMIN']), {}),
    ).rejects.toThrow(new NotFoundException('Ordre de travail introuvable'));
  });

  it('lève BadRequestException si la transition n\'est pas autorisée dans le graphe', async () => {
    const { service, prismaMock } = makeDeps();
    // CLOSED → IN_PROGRESS : impossible
    prismaMock.serviceOrder.findUnique.mockResolvedValue(makeOT({ status: OTStatus.CLOSED }));

    await expect(
      service.updateStatus('ot-1', OTStatus.IN_PROGRESS, makeUser(['ADMIN']), {}),
    ).rejects.toThrow(BadRequestException);
  });

  // ── RBAC ─────────────────────────────────────────────────────────────────────

  it('lève ForbiddenException si le rôle de l\'utilisateur ne peut pas effectuer la transition', async () => {
    const { service, prismaMock } = makeDeps();
    // DIAGNOSING → QUOTE_PENDING : réservé à CHEF_ATELIER, pas TECHNICIEN
    prismaMock.serviceOrder.findUnique.mockResolvedValue(
      makeOT({ status: OTStatus.DIAGNOSING }),
    );

    await expect(
      service.updateStatus('ot-1', OTStatus.QUOTE_PENDING, makeUser(['TECHNICIEN']), {}),
    ).rejects.toThrow(ForbiddenException);
  });

  it('CHEF_ATELIER peut passer DIAGNOSING → QUOTE_PENDING', async () => {
    const { service, prismaMock } = makeDeps();
    prismaMock.serviceOrder.findUnique.mockResolvedValue(
      makeOT({ status: OTStatus.DIAGNOSING, observations: [{ id: 'obs-1' }] }),
    );
    prismaMock.serviceOrder.update.mockResolvedValue({ id: 'ot-1', status: OTStatus.QUOTE_PENDING });

    const result = await service.updateStatus(
      'ot-1',
      OTStatus.QUOTE_PENDING,
      makeUser(['CHEF_ATELIER']),
      {},
    );
    expect(result.status).toBe(OTStatus.QUOTE_PENDING);
  });

  // ── Règles métier ORD-XXX ─────────────────────────────────────────────────────

  it('ORD-001 : lève BadRequestException si RECEIVED sans mileageIn', async () => {
    const { service, prismaMock } = makeDeps();
    prismaMock.serviceOrder.findUnique.mockResolvedValue(
      makeOT({ status: OTStatus.DRAFT, mileageIn: null }),
    );

    await expect(
      service.updateStatus('ot-1', OTStatus.RECEIVED, makeUser(['RECEPTIONNISTE']), {}),
    ).rejects.toThrow(
      new BadRequestException("Kilométrage d'entrée obligatoire pour le statut REÇU (ORD-001)"),
    );
  });

  it('ORD-001 : RECEIVED autorisé si mileageIn est renseigné', async () => {
    const { service, prismaMock } = makeDeps();
    prismaMock.serviceOrder.findUnique.mockResolvedValue(
      makeOT({ status: OTStatus.DRAFT, mileageIn: 45000 }),
    );
    prismaMock.serviceOrder.update.mockResolvedValue({ id: 'ot-1', status: OTStatus.RECEIVED });

    await expect(
      service.updateStatus('ot-1', OTStatus.RECEIVED, makeUser(['RECEPTIONNISTE']), {}),
    ).resolves.toBeDefined();
  });

  it('ORD-003 : lève BadRequestException si READY avec des pièces non reçues', async () => {
    const { service, prismaMock } = makeDeps();
    prismaMock.serviceOrder.findUnique.mockResolvedValue(
      makeOT({
        status: OTStatus.QC_DONE,
        quotes: [{
          lines: [{
            partId: 'part-1',
            partStatus: PartStatus.ASP_ORDERED, // ni RECEIVED ni CONSUMED
          }],
        }],
      }),
    );

    await expect(
      service.updateStatus('ot-1', OTStatus.READY, makeUser(['CHEF_ATELIER']), {}),
    ).rejects.toThrow(
      new BadRequestException('Certaines pièces commandées ne sont pas encore reçues (ORD-003)'),
    );
  });

  it('ORD-003 : READY autorisé si toutes les pièces sont CONSUMED', async () => {
    const { service, prismaMock } = makeDeps();
    prismaMock.serviceOrder.findUnique.mockResolvedValue(
      makeOT({
        status: OTStatus.QC_DONE,
        quotes: [{
          lines: [{ partId: 'part-1', partStatus: PartStatus.CONSUMED }],
        }],
      }),
    );
    prismaMock.serviceOrder.update.mockResolvedValue({ id: 'ot-1', status: OTStatus.READY });

    await expect(
      service.updateStatus('ot-1', OTStatus.READY, makeUser(['CHEF_ATELIER']), {}),
    ).resolves.toBeDefined();
  });

  it('ORD-004 : lève BadRequestException si CANCELLED sans motif d\'annulation', async () => {
    const { service, prismaMock } = makeDeps();
    prismaMock.serviceOrder.findUnique.mockResolvedValue(
      makeOT({ status: OTStatus.IN_PROGRESS }),
    );

    await expect(
      service.updateStatus(
        'ot-1',
        OTStatus.CANCELLED,
        makeUser(['CHEF_ATELIER']),
        { cancellationReason: undefined },
      ),
    ).rejects.toThrow(
      new BadRequestException("Un motif d'annulation est obligatoire (ORD-004)"),
    );
  });

  it('ORD-004 : annulation autorisée si motif fourni', async () => {
    const { service, prismaMock } = makeDeps();
    prismaMock.serviceOrder.findUnique.mockResolvedValue(
      makeOT({ status: OTStatus.IN_PROGRESS }),
    );
    prismaMock.serviceOrder.update.mockResolvedValue({ id: 'ot-1', status: OTStatus.CANCELLED });

    await expect(
      service.updateStatus(
        'ot-1',
        OTStatus.CANCELLED,
        makeUser(['CHEF_ATELIER']),
        { cancellationReason: 'Client ne se présente plus' },
      ),
    ).resolves.toBeDefined();
  });

  // ── Verrou optimiste ──────────────────────────────────────────────────────────

  it('lève ConflictException si la version a changé (modification concurrente)', async () => {
    const { service, prismaMock } = makeDeps();
    prismaMock.serviceOrder.findUnique.mockResolvedValue(
      makeOT({ status: OTStatus.DRAFT, mileageIn: 45000, version: 3 }),
    );
    // $executeRaw retourne 0 lignes affectées → version a changé (modification concurrente)
    prismaMock.$executeRaw.mockResolvedValueOnce(0);

    await expect(
      service.updateStatus('ot-1', OTStatus.RECEIVED, makeUser(['RECEPTIONNISTE']), {}),
    ).rejects.toThrow(ConflictException);
  });

  // ── Comportement nominal ──────────────────────────────────────────────────────

  it('incrémente la version à chaque transition réussie', async () => {
    const { service, prismaMock } = makeDeps();
    prismaMock.serviceOrder.findUnique.mockResolvedValue(
      makeOT({ status: OTStatus.DRAFT, mileageIn: 80000, version: 5 }),
    );
    prismaMock.serviceOrder.update.mockResolvedValue({ id: 'ot-1', status: OTStatus.RECEIVED, version: 6 });

    await service.updateStatus('ot-1', OTStatus.RECEIVED, makeUser(['RECEPTIONNISTE']), {});

    // Le service utilise $executeRaw (CTE atomique) — le WHERE clause contient la version actuelle
    expect(prismaMock.$executeRaw).toHaveBeenCalled();
    // 7ème argument du tagged template = ot.version dans le WHERE
    expect(prismaMock.$executeRaw.mock.calls[0][6]).toBe(5);
  });

  it('enregistre un audit fire-and-forget à chaque transition', async () => {
    const { service, prismaMock, auditMock } = makeDeps();
    prismaMock.serviceOrder.findUnique.mockResolvedValue(
      makeOT({ status: OTStatus.DRAFT, mileageIn: 80000 }),
    );
    prismaMock.serviceOrder.update.mockResolvedValue({ id: 'ot-1', status: OTStatus.RECEIVED });

    await service.updateStatus('ot-1', OTStatus.RECEIVED, makeUser(['RECEPTIONNISTE']), {});

    expect(auditMock.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'STATUS_CHANGE',
        entityId: 'ot-1',
        before: { status: OTStatus.DRAFT },
        after: { status: OTStatus.RECEIVED },
      }),
    );
  });

  it('audit enregistre l\'id utilisateur comme performedBy (pas "SYSTEM")', async () => {
    const { service, prismaMock, auditMock } = makeDeps();
    prismaMock.serviceOrder.findUnique.mockResolvedValue(
      makeOT({ status: OTStatus.DRAFT, mileageIn: 80000 }),
    );
    prismaMock.serviceOrder.update.mockResolvedValue({ id: 'ot-1', status: OTStatus.RECEIVED });

    await service.updateStatus(
      'ot-1',
      OTStatus.RECEIVED,
      { id: 'user-xyz', roles: [{ role: { code: 'RECEPTIONNISTE' } }] },
      {},
    );

    expect(auditMock.log).toHaveBeenCalledWith(
      expect.objectContaining({ performedBy: 'user-xyz' }),
    );
  });

  it('RBAC : un utilisateur avec 2 rôles réussit si au moins 1 est autorisé (some, pas every)', async () => {
    // TECHNICIEN + CHEF_ATELIER → CHEF_ATELIER est autorisé pour DIAGNOSING→QUOTE_PENDING
    // some() passe (1 rôle sur 2 est valide) ; every() échouerait (TECHNICIEN non autorisé)
    const { service, prismaMock } = makeDeps();
    prismaMock.serviceOrder.findUnique.mockResolvedValue(
      makeOT({ status: OTStatus.DIAGNOSING, observations: [{ id: 'obs-1' }] }),
    );
    prismaMock.serviceOrder.update.mockResolvedValue({ id: 'ot-1', status: OTStatus.QUOTE_PENDING });

    await expect(
      service.updateStatus(
        'ot-1',
        OTStatus.QUOTE_PENDING,
        makeUser(['TECHNICIEN', 'CHEF_ATELIER']),
        {},
      ),
    ).resolves.toBeDefined();
  });

  it('ORD-003 ne bloque que la transition READY, pas les autres', async () => {
    // Vérifie que la garde pièces ne s\'applique qu\'au statut READY
    const { service, prismaMock } = makeDeps();
    prismaMock.serviceOrder.findUnique.mockResolvedValue(
      makeOT({
        status: OTStatus.IN_PROGRESS,
        assignedChef: 'user-1',
        quotes: [{ lines: [{ partId: 'part-1', partStatus: PartStatus.ASP_ORDERED }] }],
      }),
    );
    prismaMock.serviceOrder.update.mockResolvedValue({ id: 'ot-1', status: OTStatus.QC_PENDING });

    await expect(
      service.updateStatus('ot-1', OTStatus.QC_PENDING, makeUser(['TECHNICIEN']), {}),
    ).resolves.toBeDefined();
  });

  it('403 si technicien tente une transition sur un OT non assigné', async () => {
    const { service, prismaMock } = makeDeps();
    prismaMock.serviceOrder.findUnique.mockResolvedValue(
      makeOT({ status: OTStatus.IN_PROGRESS, assignedChef: 'other-tech' }),
    );

    await expect(
      service.updateStatus('ot-1', OTStatus.QC_PENDING, makeUser(['TECHNICIEN']), {}),
    ).rejects.toThrow(new ForbiddenException('Cet ordre de travail ne vous est pas assigné'));
  });

  it('findUnique inclut vehicle, workItems et quotes.lines pour valider les règles métier', async () => {
    const { service, prismaMock } = makeDeps();
    prismaMock.serviceOrder.findUnique.mockResolvedValue(
      makeOT({ status: OTStatus.DRAFT, mileageIn: 80000 }),
    );
    prismaMock.serviceOrder.update.mockResolvedValue({ id: 'ot-1', status: OTStatus.RECEIVED });

    await service.updateStatus('ot-1', OTStatus.RECEIVED, makeUser(['RECEPTIONNISTE']), {});

    const call = prismaMock.serviceOrder.findUnique.mock.calls[0][0];
    expect(call.include.vehicle).toBe(true);
    expect(call.include.workItems).toBe(true);
    expect(call.include.quotes.include.lines).toBe(true);
  });

  it('closedAt est défini quand targetStatus = CLOSED', async () => {
    const { service, prismaMock } = makeDeps();
    prismaMock.serviceOrder.findUnique.mockResolvedValue(
      makeOT({ status: OTStatus.INVOICED }),
    );
    prismaMock.serviceOrder.update.mockResolvedValue({ id: 'ot-1', status: OTStatus.CLOSED });

    await service.updateStatus('ot-1', OTStatus.CLOSED, makeUser(['CAISSIER']), {});

    // 5ème param du tagged template $executeRaw = closedAt
    expect(prismaMock.$executeRaw.mock.calls[0][4]).toBeInstanceOf(Date);
  });

  it('closedAt est null quand targetStatus ≠ CLOSED (préserve la valeur existante)', async () => {
    const { service, prismaMock } = makeDeps();
    prismaMock.serviceOrder.findUnique.mockResolvedValue(
      makeOT({ status: OTStatus.DRAFT, mileageIn: 80000, closedAt: null }),
    );
    prismaMock.serviceOrder.update.mockResolvedValue({ id: 'ot-1', status: OTStatus.RECEIVED });

    await service.updateStatus('ot-1', OTStatus.RECEIVED, makeUser(['RECEPTIONNISTE']), {});

    // 5ème param du tagged template $executeRaw = closedAt (null car pas CLOSED)
    expect(prismaMock.$executeRaw.mock.calls[0][4]).toBeNull();
  });

  it('cancellationReason du body est utilisé si fourni', async () => {
    const { service, prismaMock } = makeDeps();
    prismaMock.serviceOrder.findUnique.mockResolvedValue(
      makeOT({ status: OTStatus.IN_PROGRESS, cancellationReason: 'Ancien motif' }),
    );
    prismaMock.serviceOrder.update.mockResolvedValue({ id: 'ot-1' });

    await service.updateStatus(
      'ot-1',
      OTStatus.CANCELLED,
      makeUser(['CHEF_ATELIER']),
      { cancellationReason: 'Nouveau motif' },
    );

    // 4ème param du tagged template $executeRaw = cancellationReason
    expect(prismaMock.$executeRaw.mock.calls[0][3]).toBe('Nouveau motif');
  });

  it('cancellationReason de l\'OT existant est préservé si body n\'en fournit pas', async () => {
    const { service, prismaMock } = makeDeps();
    prismaMock.serviceOrder.findUnique.mockResolvedValue(
      makeOT({ status: OTStatus.INVOICED, cancellationReason: 'Motif existant' }),
    );
    prismaMock.serviceOrder.update.mockResolvedValue({ id: 'ot-1', status: OTStatus.CLOSED });

    await service.updateStatus('ot-1', OTStatus.CLOSED, makeUser(['CAISSIER']), {});

    // 4ème param du tagged template $executeRaw = cancellationReason (préservé depuis l'OT)
    expect(prismaMock.$executeRaw.mock.calls[0][3]).toBe('Motif existant');
  });

  it('audit metadata.automated = false pour une transition utilisateur normale', async () => {
    const { service, prismaMock, auditMock } = makeDeps();
    prismaMock.serviceOrder.findUnique.mockResolvedValue(
      makeOT({ status: OTStatus.DRAFT, mileageIn: 80000 }),
    );
    prismaMock.serviceOrder.update.mockResolvedValue({ id: 'ot-1' });

    await service.updateStatus('ot-1', OTStatus.RECEIVED, makeUser(['RECEPTIONNISTE']), {});

    expect(auditMock.log).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({ automated: false }),
      }),
    );
  });
});

describe('WorkshopService.updateStatusBySystem()', () => {
  beforeEach(() => jest.clearAllMocks());

  it('bypass RBAC et applique READY → INVOICED (auto-facturation)', async () => {
    const { service, prismaMock, auditMock } = makeDeps();
    prismaMock.serviceOrder.findUnique.mockResolvedValue(
      makeOT({ status: OTStatus.READY }),
    );
    prismaMock.serviceOrder.update.mockResolvedValue({ id: 'ot-1', status: OTStatus.INVOICED });

    await service.updateStatusBySystem('ot-1', OTStatus.INVOICED, 'user-caisse', {
      reason: 'Soldé automatiquement — facture inv-1',
    });

    // Le service utilise $executeRaw (CTE atomique) — on vérifie que la transition a eu lieu
    expect(prismaMock.$executeRaw).toHaveBeenCalled();
    expect(auditMock.log).toHaveBeenCalledWith(
      expect.objectContaining({
        performedBy: 'user-caisse',
        metadata: { reason: 'Soldé automatiquement — facture inv-1', automated: true },
      }),
    );
  });

  it('respecte toujours le graphe de transitions même sans RBAC', async () => {
    const { service, prismaMock } = makeDeps();
    prismaMock.serviceOrder.findUnique.mockResolvedValue(
      makeOT({ status: OTStatus.DRAFT }),
    );

    await expect(
      service.updateStatusBySystem('ot-1', OTStatus.INVOICED, 'user-1', {}),
    ).rejects.toThrow(BadRequestException);
  });
});

describe('WorkshopService.closeServiceOrderAfterFullPayment()', () => {
  beforeEach(() => jest.clearAllMocks());

  it('INVOICED → CLOSED après encaissement total', async () => {
    const { service, prismaMock } = makeDeps();
    prismaMock.serviceOrder.findUnique
      .mockResolvedValueOnce({ id: 'ot-1', status: OTStatus.INVOICED })
      .mockResolvedValue(makeOT({ status: OTStatus.INVOICED }));

    const result = await service.closeServiceOrderAfterFullPayment('ot-1', 'user-caisse', {
      reason: 'Soldé automatiquement',
    });

    expect(result).toEqual({ closed: true, finalStatus: OTStatus.CLOSED });
    expect(prismaMock.$executeRaw).toHaveBeenCalled();
  });

  it('refuse la clôture auto si OT encore en travaux', async () => {
    const { service, prismaMock } = makeDeps();
    prismaMock.serviceOrder.findUnique.mockResolvedValue({
      id: 'ot-1',
      status: OTStatus.IN_PROGRESS,
    });

    await expect(
      service.closeServiceOrderAfterFullPayment('ot-1', 'user-caisse', {}),
    ).rejects.toThrow(BadRequestException);
  });
});

describe('WorkshopService — flux QC', () => {
  beforeEach(() => jest.clearAllMocks());

  it('CHEF_ATELIER : QC_PENDING → READY directement', async () => {
    const { service, prismaMock } = makeDeps();
    prismaMock.customer = { findUnique: jest.fn().mockResolvedValue(null) };
    prismaMock.serviceOrder.findUnique
      .mockResolvedValueOnce(makeOT({ status: OTStatus.QC_PENDING, quotes: [] }));
    prismaMock.$executeRaw.mockResolvedValue(1);

    const result = await service.updateStatus('ot-1', OTStatus.READY, makeUser(['CHEF_ATELIER']), {});

    expect(result.status).toBe(OTStatus.READY);
  });

  it('QC_PENDING → READY notifie le technicien assigné', async () => {
    const { service, prismaMock, notifMock } = makeDeps();
    prismaMock.customer = { findUnique: jest.fn().mockResolvedValue(null) };
    prismaMock.serviceOrder.findUnique.mockResolvedValue(
      makeOT({
        status: OTStatus.QC_PENDING,
        assignedChef: 'tech-1',
        vehicle: { plateNumber: 'LT-123-AB' },
        quotes: [],
      }),
    );
    prismaMock.$executeRaw.mockResolvedValue(1);

    await service.updateStatus('ot-1', OTStatus.READY, makeUser(['CHEF_ATELIER']), {});
    await new Promise((r) => setImmediate(r));

    expect(notifMock.createInApp).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientIds: ['tech-1'],
        title: 'Contrôle qualité validé',
        body: expect.stringContaining('LT-123-AB'),
      }),
    );
  });

  it('QC_REJECTED → IN_PROGRESS (itération qualité)', async () => {
    const { service, prismaMock } = makeDeps();
    prismaMock.serviceOrder.findUnique.mockResolvedValue(
      makeOT({ status: OTStatus.QC_REJECTED }),
    );
    prismaMock.serviceOrder.update.mockResolvedValue({ id: 'ot-1', status: OTStatus.IN_PROGRESS });

    await service.updateStatus('ot-1', OTStatus.IN_PROGRESS, makeUser(['ADMIN']), {});

    // Le service utilise $executeRaw (CTE atomique) pour les transitions
    expect(prismaMock.$executeRaw).toHaveBeenCalled();
  });

  it('TECHNICIEN peut passer IN_PROGRESS → QC_PENDING', async () => {
    const { service, prismaMock } = makeDeps();
    prismaMock.serviceOrder.findUnique.mockResolvedValue(
      makeOT({ status: OTStatus.IN_PROGRESS, assignedChef: 'user-1' }),
    );
    prismaMock.serviceOrder.update.mockResolvedValue({ id: 'ot-1', status: OTStatus.QC_PENDING });

    await service.updateStatus('ot-1', OTStatus.QC_PENDING, makeUser(['TECHNICIEN']), {});

    expect(prismaMock.$executeRaw).toHaveBeenCalled();
  });

  it('ORD-006 : IN_PROGRESS refusé sans devis APPROVED', async () => {
    const { service, prismaMock } = makeDeps();
    prismaMock.serviceOrder.findUnique.mockResolvedValue(
      makeOT({
        status: OTStatus.QUOTE_APPROVED,
        quotes: [{ id: 'q-1', status: 'SENT', lines: [] }],
      }),
    );

    await expect(
      service.updateStatus('ot-1', OTStatus.IN_PROGRESS, makeUser(['CHEF_ATELIER']), {}),
    ).rejects.toThrow(BadRequestException);
  });

  it('TECHNICIEN assigné peut passer QUOTE_APPROVED → IN_PROGRESS si devis APPROVED', async () => {
    const { service, prismaMock } = makeDeps();
    prismaMock.serviceOrder.findUnique.mockResolvedValue(
      makeOT({
        status: OTStatus.QUOTE_APPROVED,
        assignedChef: 'user-1',
        vehicle: { plateNumber: 'LT-777-DL' },
        quotes: [{ id: 'q-1', status: 'APPROVED', lines: [] }],
      }),
    );

    const result = await service.updateStatus(
      'ot-1',
      OTStatus.IN_PROGRESS,
      makeUser(['TECHNICIEN']),
      {},
    );

    expect(result.status).toBe(OTStatus.IN_PROGRESS);
    expect(prismaMock.$executeRaw).toHaveBeenCalled();
  });
});

// ─── assignChef() ─────────────────────────────────────────────────────────────

describe('WorkshopService.assignChef()', () => {
  beforeEach(() => jest.clearAllMocks());

  it('met à jour assignedChef sur l\'OT', async () => {
    const { service, prismaMock } = makeDeps();
    prismaMock.serviceOrder.update.mockResolvedValue({ id: 'ot-1', assignedChef: 'chef-1' });

    await service.assignChef('ot-1', 'chef-1');

    expect(prismaMock.serviceOrder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'ot-1' },
        data: { assignedChef: 'chef-1' },
      }),
    );
  });
});

// ─── removeWorkItem() ─────────────────────────────────────────────────────────

describe('WorkshopService.removeWorkItem()', () => {
  beforeEach(() => jest.clearAllMocks());

  it('supprime le workItem avec id et serviceOrderId', async () => {
    const prismaMock = {
      serviceOrder: { findUnique: jest.fn(), update: jest.fn() },
      customer: { findUnique: jest.fn() },
      oTWorkItem: { delete: jest.fn().mockResolvedValue({ id: 'wi-1' }) },
    };
    const auditMock    = { log: jest.fn() };
    const notifMock    = { notifyUsers: jest.fn(), getUserIdsByRoles: jest.fn().mockResolvedValue([]), createInApp: jest.fn().mockResolvedValue({}) };
    const smsQueueMock = { add: jest.fn() };
    const partsFlowMock = { onQuoteApproved: jest.fn(), consumeReservedParts: jest.fn(), releaseReservationsForOrder: jest.fn(), reconcilePartsAtQc: jest.fn() };
    const service = new WorkshopService(prismaMock as any, auditMock as any, notifMock as any, partsFlowMock as any, smsQueueMock as any);

    await service.removeWorkItem('ot-1', 'wi-1');

    expect(prismaMock.oTWorkItem.delete).toHaveBeenCalledWith({
      where: { id: 'wi-1', serviceOrderId: 'ot-1' },
    });
  });
});
