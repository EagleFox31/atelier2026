# Workflows Atelier 2026
> Cartographie des flux métier — ce qui existe, ce qui est manuel, ce qui peut être automatisé

---

## 1. Workflow OT (Ordre de Travail) — Machine à états

C'est le workflow central du système. **Entièrement implémenté côté backend.**

```
                    ┌──────────┐
                    │  DRAFT   │ ← Création OT sans réception physique
                    └────┬─────┘
                         │ mileageIn requis
                    ┌────▼─────┐
                    │ RECEIVED │ ← Véhicule physiquement en atelier
                    └────┬─────┘
                         │
                    ┌────▼──────────┐
                    │  DIAGNOSING   │ ← Technicien examine le véhicule
                    └────┬──────────┘
                         │ observations ajoutées
                    ┌────▼──────────┐
                    │ QUOTE_PENDING │ ← Devis créé, en attente client
                    └────┬──────────┘
                         │ client approuve
                    ┌────▼──────────────┐
                    │ QUOTE_APPROVED    │
                    └────┬──────────────┘
                         │
                    ┌────▼──────────┐
                    │  IN_PROGRESS  │ ← Travaux en cours
                    └────┬──────────┘
                         │
                    ┌────▼──────────┐        ┌──────────────┐
                    │  QC_PENDING   │──────►│  QC_REJECTED │──► IN_PROGRESS
                    └────┬──────────┘        └──────────────┘
                         │ OK
                    ┌────▼──────────┐
                    │   QC_DONE     │
                    └────┬──────────┘
                         │
                    ┌────▼──────────┐
                    │     READY     │ ← Véhicule prêt, client notifié
                    └────┬──────────┘
                         │ facture émise
                    ┌────▼──────────┐
                    │   INVOICED    │
                    └────┬──────────┘
                         │ paiement reçu
                    ┌────▼──────────┐
                    │    CLOSED     │
                    └───────────────┘

    Tout état → CANCELLED (motif obligatoire)
```

### Ce qui est **automatique** aujourd'hui
| Déclencheur | Action auto | Où |
|-------------|-------------|-----|
| UPDATE status sur `service_orders` | INSERT dans `ot_status_history` | Trigger SQL `trg_ot_status_history` |
| `quote_lines.partStatus` → CONSUMED | Mouvement stock OUT + màj `qty_in_stock` | Trigger SQL `trg_stock_consumption` |
| Facture impayée J+7 | SMS de relance | `SchedulerService` (cron 7h WAT) |

### Ce qui est **manuel** aujourd'hui
| Étape | Qui le fait | Via |
|-------|------------|-----|
| Créer l'OT | Réceptionniste | Bouton "Nouvel OT" |
| Passer RECEIVED | Réceptionniste | Bouton transition |
| Ajouter observations | Technicien | `POST /workshop/ot/:id/observation` |
| Créer le devis depuis observations | Caissier | Page billing |
| Appeler le client pour validation | Chef d'atelier | Téléphone 📞 |
| Approuver le devis | Caissier (signature client) | Bouton "Approuver" |
| Passer les statuts de travaux | Chef d'atelier | Boutons transition |
| Contrôle qualité | Chef d'atelier | Formulaire QC |
| Notifier le client "véhicule prêt" | Caissier | Bouton SMS manuel |
| Créer la facture | Caissier | Bouton "Facturer" |
| Encaisser le paiement | Caissier | Formulaire paiement |
| Livrer le véhicule | Caissier | Passer CLOSED |

---

## 2. Workflow Facturation

```
Observations OT
      │
      ▼
  Devis (DRAFT)
      │ caissier envoie
      ▼
  Devis (SENT)
      │ client approuve (signature)
      ▼
  Devis (APPROVED)
      │ caissier convertit
      ▼
  Facture (ISSUED) ← dueDate J+7 automatique
      │
      ├── Paiement partiel → Facture (PARTIAL)
      │
      └── Paiement total  → Facture (PAID)
                                │
                                └── OT → INVOICED (MANUEL) → CLOSED (MANUEL)
```

### Ce qui est **manuel**
- Création du devis (caissier saisit les lignes manuellement)
- Envoi du devis au client (pas de SMS/email auto)
- Enregistrement de la signature client
- Conversion devis → facture
- Enregistrement du paiement
- Passage OT en INVOICED puis CLOSED après paiement

### Ce qui **pourrait être automatisé**
- ✨ Quand `Invoice.status` passe à **PAID** → passer l'OT lié automatiquement en **INVOICED**
- ✨ Quand OT passe en **READY** → envoyer SMS client "votre véhicule est prêt"
- ✨ Quand devis créé → SMS client avec montant et lien de validation
- ✨ Quand facture PAID → SMS reçu de paiement au client

---

## 3. Workflow Stock

```
Entrée stock (PURCHASE)
      │
      ▼
  PartsCatalog.qtyInStock ↑
      │
      ├── Réservation pour OT (STOCK_RESERVED) ← Manual
      │         │
      │         └── Consommation (CONSUMED) → trigger stock OUT auto
      │
      ├── ASP (Achat Sur Place)
      │         Entrée + Sortie immédiate
      │
      └── Vente Comptoir (COUNTER_SALE)
                Sortie directe

Seuil critique → Queue BullMQ `stock-alerts` → [pas de suite aujourd'hui]
```

### Ce qui est **manuel**
- Réception de stock (formulaire)
- Création des mouvements d'ajustement
- Commander des pièces auprès du fournisseur (hors système)
- Marquer une pièce comme CONSUMED (c'est le trigger qui le fait mais il faut que quelqu'un change le partStatus)

### Ce qui **pourrait être automatisé**
- ✨ Alerte stock critique → SMS/notification au chef d'atelier (BullMQ existe, pas de consumer SMS)
- ✨ Quand OT passe en IN_PROGRESS → réserver automatiquement les pièces du devis approuvé
- ✨ Bon de commande fournisseur automatique quand stock < minThreshold

---

## 4. Workflow Rendez-vous → OT

```
Client appelle → [TÉLÉPHONE - hors système]
      │
      ▼
Rendez-vous créé (SCHEDULED)
      │ confirmation
      ▼
Rendez-vous (CONFIRMED)
      │ client arrive
      ▼
Réceptionniste crée un OT avec appointmentId (POST /workshop/ot)
      │ API lie automatiquement l'OT au RDV et passe le RDV en COMPLETED
      ▼
Rendez-vous (COMPLETED) ← automatique via transaction
```

> **Lien Appointment ↔ ServiceOrder ✅ Implémenté** — `Appointment.serviceOrderId` existe en base. Lors de la création d'un OT avec `appointmentId`, l'API met à jour ce lien et passe le statut du RDV en `COMPLETED` dans la même transaction.

### Ce qui reste **manuel**
- Réceptionniste doit saisir `appointmentId` dans le formulaire de création OT

### Ce qui **pourrait être automatisé**
- ✨ Bouton "Créer un OT depuis ce RDV" (frontend) → pré-remplir formulaire avec customer + vehicle + reason + appointmentId
- ✨ SMS de rappel J-1 avant le RDV (SchedulerService + BullMQ) — non implémenté

---

## 5. Workflow Notifications SMS

```
Déclencheur manuel/automatique
      │
      ▼
Job ajouté dans BullMQ queue `sms-notifications`
      │
      ▼
SmsProcessor.process() → détecte opérateur (Orange/MTN)
      │
      ▼
mockSmsGateway() [simulation 500ms]
      │
      ▼
SMSNotification INSERT en base (status: SENT)
```

### Notifications **existantes mais non déclenchées automatiquement**
| Événement | SMS prévu | État |
|-----------|-----------|------|
| Facture impayée J+7 | ✅ SchedulerService | Actif (cron) |
| Véhicule prêt | ✅ WorkshopService (BullMQ) | Actif (OT → READY) |
| Rappel RDV J-1 | ❌ | Non implémenté |
| Alerte stock critique | ⚠️ Queue alimentée | Consumer SMS absent |
| Devis envoyé | ❌ | Non implémenté |
| Confirmation RDV | ❌ | Non implémenté |

---

## 6. Workflow Immobilisation Véhicule

```
Véhicule bloqué (pièces / paiement / accord client)
      │
      ▼
VehicleImmobilization créée (MANUEL)
      │
      ├── +24h → alertSent24h = true [SchedulerService - ACTIF]
      ├── +72h → alertSent72h = true [SchedulerService - ACTIF]
      └── +7j  → alertSent7d  = true [SchedulerService - ACTIF]

[Mais le SMS au client n'est pas envoyé, juste un log]
```

### Ce qui **pourrait être automatisé**
- ✨ À chaque alerte → SMS client + SMS chef d'atelier
- ✨ Quand paiement reçu → résoudre automatiquement l'immobilisation

---

## 7. Récapitulatif — Priorités d'automatisation

### 🔴 Impact fort, effort faible

| # | Automatisation | Déclencheur | Action | Effort |
|---|----------------|-------------|--------|--------|
| 1 | **OT → INVOICED auto** | `Invoice.status` = PAID | `PATCH /workshop/ot/:id/status` → INVOICED | 1h |
| 2 | **SMS "véhicule prêt"** | OT → READY | BullMQ → SMS client | 2h |
| 3 | **SMS rappel RDV J-1** | Cron minuit | Pour tous RDV du lendemain | 2h |
| 4 | **Bouton "OT depuis RDV"** | Frontend planning | Pré-remplir formulaire OT | 3h |

### 🟠 Impact moyen, effort moyen

| # | Automatisation | Déclencheur | Action | Effort |
|---|----------------|-------------|--------|--------|
| 5 | **SMS alerte stock** | BullMQ `stock-alerts` | SMS chef + ADMIN | 3h |
| 6 | **Réservation pièces auto** | OT → QUOTE_APPROVED | partStatus → STOCK_RESERVED | 4h |
| 7 | **SMS devis envoyé** | Quote → SENT | SMS client + montant | 2h |
| 8 | **Relance J+15 facture** | Cron (manquant) | SMS client + audit | 1h |

### 🟡 Impact long terme

| # | Automatisation | Description | Effort |
|---|----------------|-------------|--------|
| 9 | **Bon de commande fournisseur** | Stock < minThreshold → bon auto | 1j |
| 10 | **QC checklist automatisée** | Définir les items QC par type d'intervention | 2j |
| 11 | **Rapports hebdo automatiques** | Cron lundi → rapport CA + OTs par email | 3h |
| 12 | **Lien Appointment ↔ ServiceOrder** | Lier l'OT au RDV à la création et passer le RDV en COMPLETED | ✅ Implémenté (Schéma + API) |

---

## Implémentation recommandée — Phase immédiate

### ~~Automatisation #1 : OT auto-INVOICED quand facture payée~~ ✅ Implémenté

> `BillingService.recordPayment()` appelle `WorkshopService.updateStatus(INVOICED)` via `setImmediate` dès que `balanceXaf <= 0`.

### ~~Automatisation #2 : SMS "véhicule prêt" quand OT → READY~~ ✅ Implémenté

> `WorkshopService.updateStatus()` ajoute un job `vehicle_ready` dans la queue BullMQ `sms-notifications` dès que `targetStatus === READY`.

### Automatisation #3 : Rappel RDV J-1

```typescript
// src/workers/scheduler.service.ts — nouveau cron
@Cron('0 20 * * *') // 21h WAT chaque soir
async sendAppointmentReminders() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  // ... chercher tous RDV du lendemain et envoyer SMS
}
```
