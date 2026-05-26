import { BadRequestException, NotFoundException } from '@nestjs/common';
import { OTStatus } from '@prisma/client';
import { WorkshopService } from '../workshop.service';

function makeDeps() {
  const txMock = {
    serviceOrder: { create: jest.fn() },
    appointment:  { update: jest.fn().mockResolvedValue({}) },
  };
  const prismaMock = {
    serviceOrder: {
      findMany:   jest.fn().mockResolvedValue([]),
      findUnique: jest.fn(),
      update:     jest.fn().mockResolvedValue({}),
    },
    appointment: {
      update: jest.fn().mockResolvedValue({}),
    },
    technicianObservation: {
      create: jest.fn(),
    },
    oTWorkItem: {
      create: jest.fn(),
      delete: jest.fn(),
    },
    receptionCheck: {
      create: jest.fn(),
    },
    receptionCheckCatalog: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    laborCatalog: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    qualityControl: {
      create: jest.fn(),
      aggregate: jest.fn().mockResolvedValue({ _max: { round: 0 } }),
    },
    $queryRaw: jest.fn().mockResolvedValue([{ max_round: 0 }]),
    customer: {
      findUnique: jest.fn().mockResolvedValue(null),
    },
    $transaction: jest.fn().mockImplementation(async (fn: any) => fn(txMock)),
  };
  const auditMock         = { log: jest.fn() };
  const notifMock         = { notifyUsers: jest.fn(), getInbox: jest.fn(), getUnreadCount: jest.fn(), markRead: jest.fn(), markAllRead: jest.fn(), getUserIdsByRoles: jest.fn().mockResolvedValue([]), createInApp: jest.fn().mockResolvedValue({}) };
  const smsQueueMock      = { add: jest.fn() };
  const partsFlowMock     = { onQuoteApproved: jest.fn(), consumeReservedParts: jest.fn(), releaseReservationsForOrder: jest.fn(), reconcilePartsAtQc: jest.fn() };
  const service = new WorkshopService(prismaMock as any, auditMock as any, notifMock as any, partsFlowMock as any, smsQueueMock as any);
  return { service, prismaMock, txMock, auditMock, smsQueueMock };
}

// ─── listOTs() ────────────────────────────────────────────────────────────────

describe('WorkshopService.listOTs()', () => {
  beforeEach(() => jest.clearAllMocks());

  it('retourne tous les OTs sans filtre', async () => {
    const { service, prismaMock } = makeDeps();
    await service.listOTs();
    expect(prismaMock.serviceOrder.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: {} }),
    );
  });

  it('filtre par statut', async () => {
    const { service, prismaMock } = makeDeps();
    await service.listOTs(OTStatus.IN_PROGRESS);
    const where = prismaMock.serviceOrder.findMany.mock.calls[0][0].where;
    expect(where.status).toBe(OTStatus.IN_PROGRESS);
  });

  it('filtre textuel sur référence, plainte, client, plaque (4 conditions OR)', async () => {
    const { service, prismaMock } = makeDeps();
    await service.listOTs(undefined, 'LT-1234');
    const where = prismaMock.serviceOrder.findMany.mock.calls[0][0].where;
    expect(where.OR).toHaveLength(4);
  });

  it('tri par createdAt desc', async () => {
    const { service, prismaMock } = makeDeps();
    await service.listOTs();
    expect(prismaMock.serviceOrder.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { createdAt: 'desc' } }),
    );
  });

  it('sans statut : where ne contient pas de clé status', async () => {
    const { service, prismaMock } = makeDeps();
    await service.listOTs();
    const where = prismaMock.serviceOrder.findMany.mock.calls[0][0].where;
    expect(where).not.toHaveProperty('status');
  });

  it('inclut customer, vehicle et workItems dans la réponse', async () => {
    const { service, prismaMock } = makeDeps();
    await service.listOTs();
    const call = prismaMock.serviceOrder.findMany.mock.calls[0][0];
    expect(call.include.customer).toBe(true);
    expect(call.include.vehicle).toBeTruthy();
    expect(call.include.workItems).toBe(true);
  });

  it('filtre par technicien assigné quand profil TECHNICIEN pur', async () => {
    const { service, prismaMock } = makeDeps();
    const techUser = {
      id: 'tech-1',
      roles: [{ role: { code: 'TECHNICIEN' } }],
    };
    await service.listOTs(undefined, undefined, techUser);
    expect(prismaMock.serviceOrder.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { assignedChef: 'tech-1' } }),
    );
  });

  it('ne filtre pas pour un chef d\'atelier', async () => {
    const { service, prismaMock } = makeDeps();
    const chefUser = {
      id: 'chef-1',
      roles: [{ role: { code: 'CHEF_ATELIER' } }],
    };
    await service.listOTs(undefined, undefined, chefUser);
    expect(prismaMock.serviceOrder.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: {} }),
    );
  });

  it('OR contient référence, plainte, client et plaque avec le bon contenu', async () => {
    const { service, prismaMock } = makeDeps();
    await service.listOTs(undefined, 'LT-1234');
    const where = prismaMock.serviceOrder.findMany.mock.calls[0][0].where;
    expect(where.OR[0]).toEqual({ reference: { contains: 'LT-1234', mode: 'insensitive' } });
    expect(where.OR[1]).toEqual({ clientComplaint: { contains: 'LT-1234', mode: 'insensitive' } });
    expect(where.OR[2]).toEqual({ customer: { lastName: { contains: 'LT-1234', mode: 'insensitive' } } });
    expect(where.OR[3]).toEqual({ vehicle: { plateNumber: { contains: 'LT-1234', mode: 'insensitive' } } });
  });
});

describe('WorkshopService.getOT()', () => {
  beforeEach(() => jest.clearAllMocks());

  it('lève NotFoundException si OT introuvable', async () => {
    const { service, prismaMock } = makeDeps();
    prismaMock.serviceOrder.findUnique.mockResolvedValue(null);

    await expect(service.getOT('ot-inexistant')).rejects.toThrow(
      new NotFoundException('Ordre de travail introuvable'),
    );
  });

  it('retourne l\'OT avec les relations imbriquées', async () => {
    const { service, prismaMock } = makeDeps();
    const ot = { id: 'ot-1', status: OTStatus.DRAFT, workItems: [], observations: [] };
    prismaMock.serviceOrder.findUnique.mockResolvedValue(ot);

    const result = await service.getOT('ot-1');
    expect(result).toEqual(ot);
  });

  it('getOT : inclut toutes les relations imbriquées (laborCatalog, observer, catalog, user, lines)', async () => {
    const { service, prismaMock } = makeDeps();
    prismaMock.serviceOrder.findUnique.mockResolvedValue({ id: 'ot-1' });

    await service.getOT('ot-1');

    const call = prismaMock.serviceOrder.findUnique.mock.calls[0][0];
    expect(call.include.customer).toBe(true);
    expect(call.include.vehicle).toBeTruthy();
    expect(call.include.workItems.include.laborCatalog).toBe(true);
    expect(call.include.workItems.include.technician).toBe(true);
    expect(call.include.observations.include.observer).toBe(true);
    expect(call.include.receptionChecks.include.checkItems.include.catalog).toBe(true);
    expect(call.include.statusHistory.include.user).toBe(true);
    expect(call.include.quotes.include.lines).toBeTruthy();
  });

  it('403 si technicien accède à un OT non assigné', async () => {
    const { service, prismaMock } = makeDeps();
    prismaMock.serviceOrder.findUnique.mockResolvedValue({
      id: 'ot-1',
      assignedChef: 'other-tech',
    });
    await expect(
      service.getOT('ot-1', { id: 'tech-1', roles: [{ role: { code: 'TECHNICIEN' } }] }),
    ).rejects.toThrow('Cet ordre de travail ne vous est pas assigné');
  });

  it('200 si technicien accède à son OT assigné', async () => {
    const { service, prismaMock } = makeDeps();
    const ot = { id: 'ot-1', assignedChef: 'tech-1' };
    prismaMock.serviceOrder.findUnique.mockResolvedValue(ot);
    await expect(
      service.getOT('ot-1', { id: 'tech-1', roles: [{ role: { code: 'TECHNICIEN' } }] }),
    ).resolves.toEqual(ot);
  });
});

// ─── createOT() ───────────────────────────────────────────────────────────────

describe('WorkshopService.createOT()', () => {
  beforeEach(() => jest.clearAllMocks());

  it('crée un OT en statut DRAFT si mileageIn absent', async () => {
    const { service, txMock } = makeDeps();
    txMock.serviceOrder.create.mockResolvedValue({ id: 'ot-new', status: OTStatus.DRAFT });

    const result = await service.createOT(
      { vehicleId: 'veh-1', customerId: 'cust-1', clientComplaint: 'Bruit moteur' },
      'user-1',
    );

    expect(txMock.serviceOrder.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: OTStatus.DRAFT }),
      }),
    );
    expect(result.status).toBe(OTStatus.DRAFT);
  });

  it('crée un OT en statut RECEIVED si mileageIn fourni', async () => {
    const { service, txMock } = makeDeps();
    txMock.serviceOrder.create.mockResolvedValue({ id: 'ot-new', status: OTStatus.RECEIVED });

    await service.createOT(
      { vehicleId: 'veh-1', customerId: 'cust-1', clientComplaint: 'Révision', mileageIn: 45000 },
      'user-1',
    );

    expect(txMock.serviceOrder.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: OTStatus.RECEIVED, mileageIn: 45000 }),
      }),
    );
  });

  it('enregistre openedBy avec l\'id de l\'utilisateur', async () => {
    const { service, txMock } = makeDeps();
    txMock.serviceOrder.create.mockResolvedValue({ id: 'ot-new' });

    await service.createOT(
      { vehicleId: 'veh-1', customerId: 'cust-1', clientComplaint: 'Test' },
      'user-chef-1',
    );

    const data = txMock.serviceOrder.create.mock.calls[0][0].data;
    expect(data.openedBy).toBe('user-chef-1');
  });

  it('met à jour le RDV (COMPLETED + serviceOrderId) si appointmentId fourni', async () => {
    const { service, txMock } = makeDeps();
    txMock.serviceOrder.create.mockResolvedValue({ id: 'ot-new' });

    await service.createOT(
      { vehicleId: 'veh-1', customerId: 'cust-1', clientComplaint: 'RDV', appointmentId: 'appt-1' },
      'user-1',
    );

    expect(txMock.appointment.update).toHaveBeenCalledWith({
      where: { id: 'appt-1' },
      data: { serviceOrderId: 'ot-new', status: 'COMPLETED' },
    });
  });

  it('priority est NORMAL par défaut si non fourni', async () => {
    const { service, txMock } = makeDeps();
    txMock.serviceOrder.create.mockResolvedValue({ id: 'ot-new', status: OTStatus.DRAFT });

    await service.createOT(
      { vehicleId: 'veh-1', customerId: 'cust-1', clientComplaint: 'Test' },
      'user-1',
    );

    const data = txMock.serviceOrder.create.mock.calls[0][0].data;
    expect(data.priority).toBe('NORMAL');
  });

  it('priority utilise la valeur fournie (HIGH) et non NORMAL par défaut', async () => {
    const { service, txMock } = makeDeps();
    txMock.serviceOrder.create.mockResolvedValue({ id: 'ot-new', status: OTStatus.DRAFT });

    await service.createOT(
      { vehicleId: 'veh-1', customerId: 'cust-1', clientComplaint: 'Test', priority: 'HIGH' },
      'user-1',
    );

    const data = txMock.serviceOrder.create.mock.calls[0][0].data;
    expect(data.priority).toBe('HIGH');
  });

  it('ne touche pas appointment si appointmentId absent', async () => {
    const { service, txMock } = makeDeps();
    txMock.serviceOrder.create.mockResolvedValue({ id: 'ot-new' });

    await service.createOT(
      { vehicleId: 'veh-1', customerId: 'cust-1', clientComplaint: 'Test' },
      'user-1',
    );

    expect(txMock.appointment.update).not.toHaveBeenCalled();
  });
});

// ─── addObservation() ─────────────────────────────────────────────────────────

describe('WorkshopService.addObservation()', () => {
  const chefUser = { id: 'user-1', roles: [{ role: { code: 'CHEF_ATELIER' } }] };
  const techUser = { id: 'tech-1', roles: [{ role: { code: 'TECHNICIEN' } }] };

  beforeEach(() => jest.clearAllMocks());

  it('crée une observation avec les valeurs par défaut (AUTRE / INFO / includeInQuote:true)', async () => {
    const { service, prismaMock } = makeDeps();
    prismaMock.serviceOrder.findUnique.mockResolvedValue({
      id: 'ot-1',
      status: OTStatus.DIAGNOSING,
      assignedChef: 'tech-1',
    });
    prismaMock.technicianObservation.create.mockResolvedValue({ id: 'obs-1' });

    await service.addObservation('ot-1', chefUser, { description: 'Fuite huile' });

    expect(prismaMock.technicianObservation.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        serviceOrderId: 'ot-1',
        observedBy: 'user-1',
        description: 'Fuite huile',
        category: 'AUTRE',
        severity: 'INFO',
        includeInQuote: true,
      }),
    });
  });

  it('respecte includeInQuote: false si explicitement fourni', async () => {
    const { service, prismaMock } = makeDeps();
    prismaMock.serviceOrder.findUnique.mockResolvedValue({
      id: 'ot-1',
      status: OTStatus.DIAGNOSING,
      assignedChef: 'tech-1',
    });
    prismaMock.technicianObservation.create.mockResolvedValue({ id: 'obs-1' });

    await service.addObservation('ot-1', chefUser, {
      description: 'Égratignure cosmétique',
      includeInQuote: false,
    });

    const data = prismaMock.technicianObservation.create.mock.calls[0][0].data;
    expect(data.includeInQuote).toBe(false);
  });

  it('autorise un technicien assigné avec ORD_VIEW en DIAGNOSING', async () => {
    const { service, prismaMock } = makeDeps();
    prismaMock.serviceOrder.findUnique.mockResolvedValue({
      id: 'ot-1',
      status: OTStatus.DIAGNOSING,
      assignedChef: 'tech-1',
    });
    prismaMock.technicianObservation.create.mockResolvedValue({ id: 'obs-1' });

    await service.addObservation('ot-1', techUser, { description: 'Batterie HS' });

    expect(prismaMock.technicianObservation.create).toHaveBeenCalled();
  });

  it('refuse un technicien non assigné', async () => {
    const { service, prismaMock } = makeDeps();
    prismaMock.serviceOrder.findUnique.mockResolvedValue({
      id: 'ot-1',
      status: OTStatus.DIAGNOSING,
      assignedChef: 'other-tech',
    });

    await expect(
      service.addObservation('ot-1', techUser, { description: 'Test' }),
    ).rejects.toThrow('ne vous est pas assigné');
  });
});

// ─── addWorkItem() ────────────────────────────────────────────────────────────

describe('WorkshopService.addWorkItem()', () => {
  beforeEach(() => jest.clearAllMocks());

  it('crée un work item avec quantity=1 et discountPct=0 par défaut', async () => {
    const { service, prismaMock } = makeDeps();
    prismaMock.oTWorkItem.create.mockResolvedValue({ id: 'wi-1' });

    await service.addWorkItem('ot-1', {
      laborCatalogId: 'cat-1',
      unitPriceXaf: 15000,
    });

    expect(prismaMock.oTWorkItem.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        serviceOrderId: 'ot-1',
        laborCatalogId: 'cat-1',
        quantity: 1,
        discountPct: 0,
        unitPriceXaf: 15000,
      }),
    });
  });
});

// ─── addReceptionCheck() ──────────────────────────────────────────────────────

describe('WorkshopService.addReceptionCheck()', () => {
  beforeEach(() => jest.clearAllMocks());

  it('charge le catalogue si aucun checkItem fourni', async () => {
    const { service, prismaMock } = makeDeps();
    prismaMock.receptionCheckCatalog.findMany.mockResolvedValue([
      { id: 'cat-1' },
      { id: 'cat-2' },
    ]);
    prismaMock.receptionCheck.create.mockResolvedValue({ id: 'rc-1' });

    await service.addReceptionCheck('ot-1', 'user-1', { mileageAtReception: 45000 });

    expect(prismaMock.receptionCheckCatalog.findMany).toHaveBeenCalled();
    const items = prismaMock.receptionCheck.create.mock.calls[0][0].data.checkItems.create;
    expect(items).toHaveLength(2);
  });

  it('n\'appelle pas le catalogue si des checkItems sont fournis', async () => {
    const { service, prismaMock } = makeDeps();
    prismaMock.receptionCheck.create.mockResolvedValue({ id: 'rc-1' });

    await service.addReceptionCheck('ot-1', 'user-1', {
      mileageAtReception: 45000,
      checkItems: [{ catalogId: 'cat-1', result: 'OK' as const }],
    });

    expect(prismaMock.receptionCheckCatalog.findMany).not.toHaveBeenCalled();
  });

  it('préserve le result fourni (OK/WARNING/CRITICAL) sans le remplacer par NA', async () => {
    const { service, prismaMock } = makeDeps();
    prismaMock.receptionCheck.create.mockResolvedValue({ id: 'rc-1' });

    await service.addReceptionCheck('ot-1', 'user-1', {
      mileageAtReception: 45000,
      checkItems: [
        { catalogId: 'cat-1', result: 'OK' as const },
        { catalogId: 'cat-2', result: 'WARNING' as const },
        { catalogId: 'cat-3', result: 'CRITICAL' as const },
      ],
    });

    const items = prismaMock.receptionCheck.create.mock.calls[0][0].data.checkItems.create;
    expect(items[0].result).toBe('OK');
    expect(items[1].result).toBe('WARNING');
    expect(items[2].result).toBe('CRITICAL');
  });

  it('result vaut NA si non fourni dans un checkItem', async () => {
    const { service, prismaMock } = makeDeps();
    prismaMock.receptionCheckCatalog.findMany.mockResolvedValue([{ id: 'cat-1' }]);
    prismaMock.receptionCheck.create.mockResolvedValue({ id: 'rc-1' });

    await service.addReceptionCheck('ot-1', 'user-1', { mileageAtReception: 45000 });

    const items = prismaMock.receptionCheck.create.mock.calls[0][0].data.checkItems.create;
    expect(items[0].result).toBe('NA');
  });

  it('include contient checkItems.catalog dans la réponse', async () => {
    const { service, prismaMock } = makeDeps();
    prismaMock.receptionCheck.create.mockResolvedValue({ id: 'rc-1' });

    await service.addReceptionCheck('ot-1', 'user-1', { mileageAtReception: 45000 });

    const call = prismaMock.receptionCheck.create.mock.calls[0][0];
    expect(call.include.checkItems.include.catalog).toBe(true);
  });

  it('fuelLevel par défaut est 4', async () => {
    const { service, prismaMock } = makeDeps();
    prismaMock.receptionCheck.create.mockResolvedValue({ id: 'rc-1' });

    await service.addReceptionCheck('ot-1', 'user-1', { mileageAtReception: 45000 });

    const data = prismaMock.receptionCheck.create.mock.calls[0][0].data;
    expect(data.fuelLevel).toBe(4);
  });

  it('met à jour mileageIn de l\'OT', async () => {
    const { service, prismaMock } = makeDeps();
    prismaMock.receptionCheck.create.mockResolvedValue({ id: 'rc-1' });

    await service.addReceptionCheck('ot-1', 'user-1', { mileageAtReception: 48000 });

    expect(prismaMock.serviceOrder.update).toHaveBeenCalledWith({
      where: { id: 'ot-1' },
      data: { mileageIn: 48000 },
    });
  });
});

// ─── addQualityControl() ──────────────────────────────────────────────────────

describe('WorkshopService.addQualityControl()', () => {
  beforeEach(() => jest.clearAllMocks());

  it('premier QC = round 1 quand aucun QC précédent', async () => {
    const { service, prismaMock } = makeDeps();
    prismaMock.$queryRaw.mockResolvedValue([{ max_round: 0 }]);
    prismaMock.qualityControl.create.mockResolvedValue({ id: 'qc-1', round: 1 });

    await service.addQualityControl('ot-1', 'user-1', { overallResult: 'CRITICAL', checklist: [] });

    const data = prismaMock.qualityControl.create.mock.calls[0][0].data;
    expect(data.round).toBe(1);
  });

  it('incrémente le round depuis le max existant (2 → 3)', async () => {
    const { service, prismaMock } = makeDeps();
    prismaMock.$queryRaw.mockResolvedValue([{ max_round: 2 }]);
    prismaMock.qualityControl.create.mockResolvedValue({ id: 'qc-1', round: 3 });

    await service.addQualityControl('ot-1', 'user-1', { overallResult: 'OK', checklist: [] });

    const data = prismaMock.qualityControl.create.mock.calls[0][0].data;
    expect(data.round).toBe(3);
  });

  it('isApproved = true si overallResult = OK', async () => {
    const { service, prismaMock } = makeDeps();
    prismaMock.$queryRaw.mockResolvedValue([{ max_round: 0 }]);
    prismaMock.qualityControl.create.mockResolvedValue({ id: 'qc-1' });

    await service.addQualityControl('ot-1', 'user-1', { overallResult: 'OK', checklist: [] });

    const data = prismaMock.qualityControl.create.mock.calls[0][0].data;
    expect(data.isApproved).toBe(true);
  });

  it('isApproved = false si overallResult ≠ OK', async () => {
    const { service, prismaMock } = makeDeps();
    prismaMock.$queryRaw.mockResolvedValue([{ max_round: 0 }]);
    prismaMock.qualityControl.create.mockResolvedValue({ id: 'qc-1' });

    await service.addQualityControl('ot-1', 'user-1', { overallResult: 'CRITICAL', checklist: [] });

    const data = prismaMock.qualityControl.create.mock.calls[0][0].data;
    expect(data.isApproved).toBe(false);
  });

  it('passe le checklist fourni tel quel', async () => {
    const { service, prismaMock } = makeDeps();
    prismaMock.$queryRaw.mockResolvedValue([{ max_round: 0 }]);
    prismaMock.qualityControl.create.mockResolvedValue({ id: 'qc-1' });

    const checklist = [{ itemId: 'c-1', result: 'OK' }, { itemId: 'c-2', result: 'WARNING' }];
    await service.addQualityControl('ot-1', 'user-1', { overallResult: 'OK', checklist });

    const data = prismaMock.qualityControl.create.mock.calls[0][0].data;
    expect(data.checklist).toEqual(checklist);
  });

  it('checklist vaut [] si non fourni', async () => {
    const { service, prismaMock } = makeDeps();
    prismaMock.$queryRaw.mockResolvedValue([{ max_round: 0 }]);
    prismaMock.qualityControl.create.mockResolvedValue({ id: 'qc-1' });

    await service.addQualityControl('ot-1', 'user-1', { overallResult: 'OK' } as any);

    const data = prismaMock.qualityControl.create.mock.calls[0][0].data;
    expect(Array.isArray(data.checklist)).toBe(true);
  });
});

// ─── assignChef() ─────────────────────────────────────────────────────────────

describe('WorkshopService.assignChef()', () => {
  beforeEach(() => jest.clearAllMocks());

  it('appelle serviceOrder.update avec where.id et data.assignedChef', async () => {
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

  it('supprime le work item ciblé (where: id + serviceOrderId)', async () => {
    const { service, prismaMock } = makeDeps();
    prismaMock.oTWorkItem.delete.mockResolvedValue({ id: 'wi-1' });

    await service.removeWorkItem('ot-1', 'wi-1');

    expect(prismaMock.oTWorkItem.delete).toHaveBeenCalledWith({
      where: { id: 'wi-1', serviceOrderId: 'ot-1' },
    });
  });
});

// ─── getLaborCatalog() / getReceptionCatalog() ────────────────────────────────

describe('WorkshopService — catalogues', () => {
  beforeEach(() => jest.clearAllMocks());

  it('getLaborCatalog : filtre isActive:true, tri category asc', async () => {
    const { service, prismaMock } = makeDeps();
    await service.getLaborCatalog();
    expect(prismaMock.laborCatalog.findMany).toHaveBeenCalledWith({
      where: { isActive: true },
      orderBy: { category: 'asc' },
    });
  });

  it('getReceptionCatalog : filtre isActive:true, tri sortOrder asc', async () => {
    const { service, prismaMock } = makeDeps();
    await service.getReceptionCatalog();
    expect(prismaMock.receptionCheckCatalog.findMany).toHaveBeenCalledWith({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
  });
});
