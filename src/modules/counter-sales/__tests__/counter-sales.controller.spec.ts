import { CounterSalesService } from '../counter-sales.service';

function makeDeps() {
  const prismaMock = {
    counterSale: {
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue({ id: 'sale-1' }),
    },
    customer: { findFirst: jest.fn().mockResolvedValue({ id: 'cust-1' }) },
    partsCatalog: { findFirst: jest.fn().mockResolvedValue({ id: 'p-1' }) },
  };
  const service = new CounterSalesService(prismaMock as any);
  return { service, prismaMock };
}

const SELLER = { id: 'user-caisse', roles: [] };
const GARAGE_ID = 'garage-demo-1';

// Extrait les champs fiscaux du dernier appel à prisma.counterSale.create
function getCreatedData(prismaMock: ReturnType<typeof makeDeps>['prismaMock']) {
  return prismaMock.counterSale.create.mock.calls[0][0].data;
}

describe('CounterSalesService — calcul fiscal (TVA 19.25%, timbre)', () => {
  beforeEach(() => jest.clearAllMocks());

  // ── Calcul par ligne ───────────────────────────────────────────────────────────

  it('lineTotalXaf = qty × unitPrice (sans remise)', async () => {
    const { service, prismaMock } = makeDeps();
    await service.create(
      { lines: [{ partId: 'p-1', quantity: 2, unitPriceXaf: 5000 }] },
      SELLER.id,
      GARAGE_ID,
    );
    expect(getCreatedData(prismaMock).subtotalXaf).toBe(10000); // 2 × 5000
  });

  it('applique la remise par ligne (10%)', async () => {
    const { service, prismaMock } = makeDeps();
    await service.create(
      { lines: [{ partId: 'p-1', quantity: 1, unitPriceXaf: 10000, discountPct: 10 }] },
      SELLER.id,
      GARAGE_ID,
    );
    // round(1 × 10000 × 0.90) = 9000
    expect(getCreatedData(prismaMock).subtotalXaf).toBe(9000);
  });

  it('cumule le subtotal de plusieurs lignes', async () => {
    const { service, prismaMock } = makeDeps();
    await service.create(
      {
        lines: [
          { partId: 'p-1', quantity: 1, unitPriceXaf: 5000 },  // 5000
          { partId: 'p-2', quantity: 2, unitPriceXaf: 3000 },  // 6000
        ],
      },
      SELLER.id,
      GARAGE_ID,
    );
    expect(getCreatedData(prismaMock).subtotalXaf).toBe(11000);
  });

  // ── TVA 19.25% ────────────────────────────────────────────────────────────────

  it('taxAmountXaf = round(subtotal × 19.25%)', async () => {
    const { service, prismaMock } = makeDeps();
    // subtotal = 20000 → tax = round(20000 × 0.1925) = 3850
    await service.create(
      { lines: [{ partId: 'p-1', quantity: 2, unitPriceXaf: 10000 }] },
      SELLER.id,
      GARAGE_ID,
    );
    expect(getCreatedData(prismaMock).taxAmountXaf).toBe(3850);
  });

  it('taxAmountXaf est arrondi à l\'entier le plus proche', async () => {
    const { service, prismaMock } = makeDeps();
    // subtotal = 9000 → tax = round(9000 × 0.1925) = round(1732.5) = 1733
    await service.create(
      { lines: [{ partId: 'p-1', quantity: 1, unitPriceXaf: 9000 }] },
      SELLER.id,
      GARAGE_ID,
    );
    expect(getCreatedData(prismaMock).taxAmountXaf).toBe(1733);
  });

  // ── Timbre 1000 XAF ───────────────────────────────────────────────────────────

  it('applique le timbre 1000 XAF si HT + TVA > 20000', async () => {
    const { service, prismaMock } = makeDeps();
    // subtotal=20000, tax=3850 → HT+TVA=23850 > 20000 → stamp=1000
    await service.create(
      { lines: [{ partId: 'p-1', quantity: 2, unitPriceXaf: 10000 }] },
      SELLER.id,
      GARAGE_ID,
    );
    const data = getCreatedData(prismaMock);
    expect(data.stampDutyXaf).toBe(1000);
    expect(data.totalXaf).toBe(24850); // 20000 + 3850 + 1000
  });

  it('n\'applique pas le timbre si HT + TVA ≤ 20000', async () => {
    const { service, prismaMock } = makeDeps();
    // subtotal=9000, tax=1733 → HT+TVA=10733 ≤ 20000 → stamp=0
    await service.create(
      { lines: [{ partId: 'p-1', quantity: 1, unitPriceXaf: 9000 }] },
      SELLER.id,
      GARAGE_ID,
    );
    const data = getCreatedData(prismaMock);
    expect(data.stampDutyXaf).toBe(0);
    expect(data.totalXaf).toBe(10733); // 9000 + 1733 + 0
  });

  it('seuil exact à 20000 (HT+TVA = 20000) → pas de timbre', async () => {
    const { service, prismaMock } = makeDeps();
    // subtotal=10000, tax=round(10000×0.1925)=1925 → HT+TVA=11925 ≤ 20000 → stamp=0
    await service.create(
      { lines: [{ partId: 'p-1', quantity: 1, unitPriceXaf: 10000 }] },
      SELLER.id,
      GARAGE_ID,
    );
    const data = getCreatedData(prismaMock);
    expect(data.stampDutyXaf).toBe(0);
    expect(data.totalXaf).toBe(11925);
  });

  // ── Données vendeur et client ──────────────────────────────────────────────────

  it('enregistre soldBy avec l\'id de l\'utilisateur courant', async () => {
    const { service, prismaMock } = makeDeps();
    await service.create(
      { lines: [{ partId: 'p-1', quantity: 1, unitPriceXaf: 5000 }] },
      'user-caisse-42',
      GARAGE_ID,
    );
    expect(getCreatedData(prismaMock).soldBy).toBe('user-caisse-42');
  });

  it('accepte walkInName sans customerId (client de passage)', async () => {
    const { service, prismaMock } = makeDeps();
    await service.create(
      {
        walkInName: 'Jean Dupont',
        walkInPhone: '+237690000000',
        lines: [{ partId: 'p-1', quantity: 1, unitPriceXaf: 5000 }],
      },
      SELLER.id,
      GARAGE_ID,
    );
    const data = getCreatedData(prismaMock);
    expect(data.walkInName).toBe('Jean Dupont');
    expect(data.customerId).toBeNull();
  });
});

// ── findAll() ─────────────────────────────────────────────────────────────────────

describe('CounterSalesService.findAll()', () => {
  beforeEach(() => jest.clearAllMocks());

  it('retourne toutes les ventes sans filtre', async () => {
    const { service, prismaMock } = makeDeps();
    await service.findAll(undefined, GARAGE_ID);
    expect(prismaMock.counterSale.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { garageId: GARAGE_ID } }),
    );
  });

  it('construit une clause OR sur référence, walkInName et lastName client', async () => {
    const { service, prismaMock } = makeDeps();
    await service.findAll('Dupont', GARAGE_ID);
    const where = prismaMock.counterSale.findMany.mock.calls[0][0].where;
    expect(where.OR).toHaveLength(3);
    expect(where.OR[0]).toEqual({ reference: { contains: 'Dupont', mode: 'insensitive' } });
    expect(where.OR[1]).toEqual({ walkInName: { contains: 'Dupont', mode: 'insensitive' } });
    expect(where.OR[2]).toEqual({ customer: { lastName: { contains: 'Dupont', mode: 'insensitive' } } });
  });

  it('include contient customer, lines avec part et vendeur (firstName+lastName)', async () => {
    const { service, prismaMock } = makeDeps();
    await service.findAll(undefined, GARAGE_ID);
    const call = prismaMock.counterSale.findMany.mock.calls[0][0];
    expect(call.include.customer).toBe(true);
    expect(call.include.lines.include.part).toBe(true);
    expect(call.include.seller.select.firstName).toBe(true);
    expect(call.include.seller.select.lastName).toBe(true);
  });

  it('limite à 50 résultats', async () => {
    const { service, prismaMock } = makeDeps();
    await service.findAll(undefined, GARAGE_ID);
    expect(prismaMock.counterSale.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 50 }),
    );
  });

  it('tri par createdAt desc', async () => {
    const { service, prismaMock } = makeDeps();
    await service.findAll(undefined, GARAGE_ID);
    expect(prismaMock.counterSale.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { createdAt: 'desc' } }),
    );
  });
});

describe('CounterSalesService.create() — champs optionnels null par défaut', () => {
  beforeEach(() => jest.clearAllMocks());

  it('walkInPhone vaut null si non fourni', async () => {
    const { service, prismaMock } = makeDeps();
    await service.create(
      { lines: [{ partId: 'p-1', quantity: 1, unitPriceXaf: 5000 }] },
      'user-1',
      GARAGE_ID,
    );
    expect(getCreatedData(prismaMock).walkInPhone).toBeNull();
  });

  it('walkInPhone vaut la valeur fournie', async () => {
    const { service, prismaMock } = makeDeps();
    await service.create(
      { walkInPhone: '+237690000000', lines: [{ partId: 'p-1', quantity: 1, unitPriceXaf: 5000 }] },
      'user-1',
      GARAGE_ID,
    );
    expect(getCreatedData(prismaMock).walkInPhone).toBe('+237690000000');
  });

  it('paymentRef vaut null si non fourni', async () => {
    const { service, prismaMock } = makeDeps();
    await service.create(
      { lines: [{ partId: 'p-1', quantity: 1, unitPriceXaf: 5000 }] },
      'user-1',
      GARAGE_ID,
    );
    expect(getCreatedData(prismaMock).paymentRef).toBeNull();
  });

  it('notes vaut null si non fourni', async () => {
    const { service, prismaMock } = makeDeps();
    await service.create(
      { lines: [{ partId: 'p-1', quantity: 1, unitPriceXaf: 5000 }] },
      'user-1',
      GARAGE_ID,
    );
    expect(getCreatedData(prismaMock).notes).toBeNull();
  });

  it('paymentMethod vaut CASH par défaut', async () => {
    const { service, prismaMock } = makeDeps();
    await service.create(
      { lines: [{ partId: 'p-1', quantity: 1, unitPriceXaf: 5000 }] },
      'user-1',
      GARAGE_ID,
    );
    expect(getCreatedData(prismaMock).paymentMethod).toBe('CASH');
  });

  it('include contient lines avec part', async () => {
    const { service, prismaMock } = makeDeps();
    await service.create(
      { lines: [{ partId: 'p-1', quantity: 1, unitPriceXaf: 5000 }] },
      'user-1',
      GARAGE_ID,
    );
    const call = prismaMock.counterSale.create.mock.calls[0][0];
    expect(call.include.lines.include.part).toBe(true);
  });
});
