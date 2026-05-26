import { OTStatus } from '@prisma/client';
import { OT_TRANSITIONS, TRANSITION_ROLES } from '../workshop.service';

// ─── Machine à états : graphe des transitions ────────────────────────────────

describe('OT_TRANSITIONS — graphe complet', () => {
  it('couvre tous les statuts de l\'enum OTStatus', () => {
    const allStatuses = Object.values(OTStatus);
    allStatuses.forEach((status) => {
      expect(OT_TRANSITIONS).toHaveProperty(status);
    });
  });

  // Flux nominal atelier — QUOTE_APPROVED est posé par billing.approveQuote(), pas par le graphe OT
  const workshopPath: OTStatus[] = [
    OTStatus.DRAFT,
    OTStatus.RECEIVED,
    OTStatus.DIAGNOSING,
    OTStatus.QUOTE_PENDING,
  ];

  const postQuoteApprovalPath: OTStatus[] = [
    OTStatus.QUOTE_APPROVED,
    OTStatus.IN_PROGRESS,
    OTStatus.QC_PENDING,
    OTStatus.READY,
    OTStatus.INVOICED,
    OTStatus.CLOSED,
  ];

  it('autorise chaque étape du flux nominal atelier (hors approbation devis)', () => {
    for (let i = 0; i < workshopPath.length - 1; i++) {
      const from = workshopPath[i];
      const to = workshopPath[i + 1];
      expect(OT_TRANSITIONS[from]).toContain(to);
    }
  });

  it('QUOTE_PENDING ne passe pas à QUOTE_APPROVED via le graphe OT (approbation manuelle billing)', () => {
    expect(OT_TRANSITIONS[OTStatus.QUOTE_PENDING]).not.toContain(OTStatus.QUOTE_APPROVED);
  });

  it('autorise chaque étape après approbation devis', () => {
    for (let i = 0; i < postQuoteApprovalPath.length - 1; i++) {
      const from = postQuoteApprovalPath[i];
      const to = postQuoteApprovalPath[i + 1];
      expect(OT_TRANSITIONS[from]).toContain(to);
    }
  });

  it('CLOSED est un état terminal — aucune transition possible', () => {
    expect(OT_TRANSITIONS[OTStatus.CLOSED]).toHaveLength(0);
  });

  it('autorise le QC_REJECTED → retour IN_PROGRESS (itération qualité)', () => {
    expect(OT_TRANSITIONS[OTStatus.QC_REJECTED]).toContain(OTStatus.IN_PROGRESS);
  });

  it('autorise CANCELLED → RECEIVED (réactivation rare)', () => {
    expect(OT_TRANSITIONS[OTStatus.CANCELLED]).toContain(OTStatus.RECEIVED);
  });

  // Transitions invalides — les plus dangereuses
  it('interdit DRAFT → IN_PROGRESS (saut illégal)', () => {
    expect(OT_TRANSITIONS[OTStatus.DRAFT]).not.toContain(OTStatus.IN_PROGRESS);
  });

  it('interdit CLOSED → tout statut (aucune réouverture)', () => {
    expect(OT_TRANSITIONS[OTStatus.CLOSED]).toHaveLength(0);
  });

  it('interdit INVOICED → IN_PROGRESS (régression impossible)', () => {
    expect(OT_TRANSITIONS[OTStatus.INVOICED]).not.toContain(OTStatus.IN_PROGRESS);
  });

  it('interdit READY → DIAGNOSING', () => {
    expect(OT_TRANSITIONS[OTStatus.READY]).not.toContain(OTStatus.DIAGNOSING);
  });

  it('interdit QC_DONE → IN_PROGRESS directement (doit passer par READY)', () => {
    expect(OT_TRANSITIONS[OTStatus.QC_DONE]).not.toContain(OTStatus.IN_PROGRESS);
  });
});

// ─── RBAC des transitions ─────────────────────────────────────────────────────

describe('TRANSITION_ROLES — contrôle d\'accès par rôle', () => {
  it('DRAFT → RECEIVED : autorisé pour RECEPTIONNISTE', () => {
    const key = `${OTStatus.DRAFT}->${OTStatus.RECEIVED}`;
    expect(TRANSITION_ROLES[key]).toContain('RECEPTIONNISTE');
  });

  it('DIAGNOSING → QUOTE_PENDING : réservé à CHEF_ATELIER (pas TECHNICIEN)', () => {
    const key = `${OTStatus.DIAGNOSING}->${OTStatus.QUOTE_PENDING}`;
    expect(TRANSITION_ROLES[key]).toContain('CHEF_ATELIER');
    expect(TRANSITION_ROLES[key]).not.toContain('TECHNICIEN');
  });

  it('RECEIVED → DIAGNOSING : TECHNICIEN peut démarrer le diagnostic', () => {
    const key = `${OTStatus.RECEIVED}->${OTStatus.DIAGNOSING}`;
    expect(TRANSITION_ROLES[key]).toContain('TECHNICIEN');
  });

  it('QUOTE_APPROVED → IN_PROGRESS : TECHNICIEN assigné peut lancer les travaux', () => {
    const key = `${OTStatus.QUOTE_APPROVED}->${OTStatus.IN_PROGRESS}`;
    expect(TRANSITION_ROLES[key]).toContain('TECHNICIEN');
    expect(TRANSITION_ROLES[key]).toContain('CHEF_ATELIER');
    expect(TRANSITION_ROLES[key]).toContain('ADMIN');
  });

  it('READY → INVOICED : CAISSIER peut facturer', () => {
    const key = `${OTStatus.READY}->${OTStatus.INVOICED}`;
    expect(TRANSITION_ROLES[key]).toContain('CAISSIER');
  });

  it('INVOICED → CLOSED : CAISSIER peut clôturer', () => {
    const key = `${OTStatus.INVOICED}->${OTStatus.CLOSED}`;
    expect(TRANSITION_ROLES[key]).toContain('CAISSIER');
  });

  it('annulation (*→CANCELLED) : CHEF_ATELIER et ADMIN autorisés, pas TECHNICIEN ni RECEPTIONNISTE', () => {
    const key = `*->${OTStatus.CANCELLED}`;
    expect(TRANSITION_ROLES[key]).toContain('CHEF_ATELIER');
    expect(TRANSITION_ROLES[key]).toContain('ADMIN');
    expect(TRANSITION_ROLES[key]).not.toContain('TECHNICIEN');
    expect(TRANSITION_ROLES[key]).not.toContain('RECEPTIONNISTE');
  });

  it('ADMIN et SUPER_ADMIN présents sur toutes les transitions nominales', () => {
    const nominalKeys = [
      `${OTStatus.DRAFT}->${OTStatus.RECEIVED}`,
      `${OTStatus.RECEIVED}->${OTStatus.DIAGNOSING}`,
      `${OTStatus.DIAGNOSING}->${OTStatus.QUOTE_PENDING}`,
      `${OTStatus.IN_PROGRESS}->${OTStatus.QC_PENDING}`,
      `${OTStatus.QC_PENDING}->${OTStatus.READY}`,
      `${OTStatus.READY}->${OTStatus.INVOICED}`,
    ];
    nominalKeys.forEach((key) => {
      expect(TRANSITION_ROLES[key]).toContain('ADMIN');
      expect(TRANSITION_ROLES[key]).toContain('SUPER_ADMIN');
    });
  });
});
