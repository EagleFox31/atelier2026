# Notifications client multicanal (WhatsApp d'abord)

Statut : lot 2 en cours (2026-10-10). Lot 3 = webhooks Meta, statuts de remise, réconciliation.

## Règles produit

- WhatsApp Cloud API est le canal client. Le SMS ne sert de secours qu'une fois un fournisseur réel validé sur Orange et MTN ; jusque-là, pas de repli.
- Un message simulé n'est jamais compté comme envoyé (`SIMULATED`, ni `SENT` ni `ACCEPTED`).
- Pas de double envoi WhatsApp + SMS. Chaque garage active ou désactive chaque événement.
- Un HTTP 200 de Meta vaut `ACCEPTED`, jamais « livré ». `SENT`, `DELIVERED` et `READ` viennent des webhooks (lot 3).
- Aucun envoi à un client réel sans : consentement enregistré, modèle approuvé, numéro professionnel, plafond de coût configuré (mode `live`).
- Aucune campagne marketing : modèles de catégorie UTILITY uniquement.

| Événement | Déclencheur | Défaut garage |
|---|---|---|
| `APPOINTMENT_CONFIRMED` | RDV créé ou confirmé, replanifié | activé |
| `APPOINTMENT_REMINDER` | cron, 24 h avant | activé |
| `SERVICE_ORDER_RECEIVED` | OT passé en RECEIVED | **désactivé** |
| `QUOTE_APPROVAL_REQUESTED` | devis envoyé (lien sécurisé) | activé |
| `VEHICLE_READY` | OT prêt | activé |
| `INVOICE_AVAILABLE` | facture émise | activé |
| `INVOICE_PAYMENT_REMINDER` | cron, politique par garage (défaut J+7, J+15) | activé |
| `PAYMENT_CONFIRMED` | paiement créé avec statut CONFIRMED | activé |

## Flux

```
 Services métier (planning, workshop, billing)        Crons (rappels RDV, relances facture)
        │ après l'écriture métier : emitter.emitSafely(événement)   │ scan idempotent
        ▼                                                          ▼
 CustomerNotificationEmitter
   préférence garage désactivée → rien
   INSERT … ON CONFLICT (garage_id, idempotency_key) DO NOTHING      ◄── PostgreSQL = source de vérité
   puis queue.add('dispatch', { notificationId }, jobId = cn_<id>)
        │
        ▼                                         ┌── balayeur (cron 1 min) : réenfile les PENDING
 Redis / BullMQ « customer-notifications »  ◄─────┘   non pris en charge, classe les issues inconnues
        │
        ▼
 CustomerNotificationProcessor
   prise en charge atomique (PENDING) → resolveDispatch() (fonction pure)
   SKIP → SKIPPED(raison) │ SEND → modèle FR/EN → WhatsAppSenderResolver(garage) → provider
   simulé → SIMULATED │ 200 → ACCEPTED (+ id Meta) │ erreur → définitive : FAILED ; temporaire : 3 essais
        │
        ▼
 Meta Cloud API ──► client           Lot 3 : webhook signé → SENT / DELIVERED / READ / FAILED
```

Pourquoi une outbox en base, écrite juste après l'écriture métier : pgbouncer interdit les transactions interactives, et Redis (instantané RDB toutes les 60 s) ne peut pas être la source de vérité. Fenêtre de perte résiduelle : un plantage entre le commit métier et l'INSERT (quelques millisecondes).

Pourquoi un cron qui scanne plutôt que des jobs BullMQ différés pour les rappels : il relit l'état réel (RDV annulé ou déplacé, facture soldée), rattrape tout seul après un arrêt et ne laisse aucun job orphelin à annuler.

## Résolution du canal (`resolveDispatch`)

La première règle qui échoue donne `SKIPPED` avec sa raison :

1. mode `off` → `MODE_OFF`
2. événement désactivé par le garage → `DISABLED_BY_GARAGE`
3. droit forfait `whatsapp` absent → `NOT_ENTITLED`
4. objet périmé (RDV annulé, facture soldée, devis révisé…) → `STALE`
5. aucun consentement WhatsApp accordé → `NO_CONSENT` (on envoie au numéro du consentement)
6. modèle (nom, langue) non approuvé → `TEMPLATE_NOT_APPROVED` (langue du client, puis `fr`)
7. mode `sandbox` et destinataire hors `WHATSAPP_TEST_RECIPIENTS` → `SANDBOX_RECIPIENT_NOT_ALLOWED`
8. plafond mensuel du garage atteint → `QUOTA_EXCEEDED`
9. sinon : envoi WhatsApp

### Moteur (`src/modules/customer-notifications/`)

- Catalogue unique (`customer-notification-catalog.ts`) : défaut par garage, modèle `am_<base>_v<version>`, variables positionnelles. Une variable manquante fait échouer l'émission (`emit`) ; `emitSafely` la journalise sans casser l'opération métier.
- Prise en charge : `UPDATE … WHERE status = PENDING AND dispatch_started_at IS NULL`. Panne temporaire → prise en charge libérée, relance BullMQ (3 essais) ; dernière tentative → `FAILED`.
- Balayeur : une prise en charge vieille de plus de 10 min (process mort pendant l'envoi) passe en `FAILED` / `UNKNOWN_OUTCOME`, **sans renvoi** : mieux vaut un message manqué qu'un doublon chez le client.
- Plafond : messages `ACCEPTED`, `SENT`, `DELIVERED`, `READ` depuis le 1er du mois à Douala ; un message simulé ne compte pas.
- Péremption (`notification-staleness.service.ts`) : RDV annulé, terminé, passé ou déplacé (horaire de la clé) ; OT annulé, clos ou pas encore prêt ; devis plus en `SENT` ; facture brouillon ou annulée (et, pour la relance, soldée) ; paiement non confirmé. Objet introuvable dans le garage = périmé.
- Bouton URL du lien de devis : ajouté avec le lien sécurisé (PR 7), le jeton étant créé à l'envoi et jamais stocké en clair.

## Clés d'idempotence (unique par garage)

| Événement | Clé |
|---|---|
| RDV confirmé | `appointment.confirmed:{id}:{scheduledAt epoch}` |
| Rappel RDV | `appointment.reminder:{id}:{scheduledAt epoch}` |
| OT pris en charge | `ot.received:{otId}` |
| Devis à approuver | `quote.sent:{quoteId}:r{revision}` |
| Véhicule prêt | `ot.ready:{otId}:v{version}` |
| Facture disponible | `invoice.issued:{invoiceId}` |
| Relance facture | `invoice.reminder:{invoiceId}:s{étape}` |
| Paiement confirmé | `payment.confirmed:{paymentId}` |

## Données

Tables (migration `prisma/migrations/20261010_customer_notifications`) :

- `customer_notifications` : historique et outbox. Statuts `PENDING`, `ACCEPTED`, `SENT`, `DELIVERED`, `READ`, `FAILED`, `SKIPPED`, `SIMULATED`. Jamais de jeton ni de PII dans Redis ; le lien de devis est stocké sous la forme `[lien]`.
- `customer_channel_consents` (état courant par client et canal) + `customer_consent_events` (journal en ajout seul, protégé par trigger : qui, quand, source, version du texte de consentement).
- `garage_notification_settings` : surcharge par garage et par événement (absence de ligne = défaut du code).
- `quote_access_tokens` : lien public de devis, seule l'empreinte SHA-256 du jeton est stockée.
- `sms_notifications` reste inchangée ; `sms_status_t` gagne `SIMULATED`.

Contrainte de déploiement : en prod, `prisma db push` tourne avant `migrate-missing.mjs`. Le SQL utilise donc exactement les noms d'objets générés par Prisma, et toute règle hors du schéma Prisma (trigger) doit vivre dans le SQL.

## Configuration

| Variable | Rôle |
|---|---|
| `CUSTOMER_NOTIFICATIONS_MODE` | `off` (défaut), `sandbox`, `live` ; valeur inconnue = l'API refuse de démarrer |
| `WHATSAPP_TEST_RECIPIENTS` | liste d'autorisation du mode `sandbox` |
| `WHATSAPP_APPROVED_TEMPLATES` | modèles approuvés, `am_vehicle_ready_v1:fr,…` |
| `CUSTOMER_NOTIFICATIONS_MONTHLY_CAP` | plafond mensuel par garage (défaut 300) |
| `CUSTOMER_NOTIFICATIONS_SMS_FALLBACK` | `off` ; toute autre valeur est refusée au lot 2 |

`live` exige `WHATSAPP_PROVIDER=whatsapp-cloud`, au moins un modèle approuvé et un plafond explicite.

Compte WhatsApp par garage (plus tard) : `WhatsAppSenderResolver.resolve(garageId)` renvoie aujourd'hui le compte de la plateforme ; une implémentation future lira une référence de secret SSM par garage, jamais le token en base.

## Décisions

- Droit forfait : nouveau droit `whatsapp`, accordé à Pro et Business `ACTIVE` (même règle que `sms`, prix pouvant diverger).
- Lien de devis : le client peut consulter, valider ou refuser (mise à jour atomique, limite de débit, 404 / 410 / 409).
- « Véhicule prêt », rappels de RDV et relances de facture passent en WhatsApp seul ; leur chemin SMS (simulé en prod) est retiré.

## Découpage

1. Schéma et migration.
2. Messagerie : drapeau `simulated`, bouton URL WhatsApp, options de job et classification d'erreur partagées ; SMS simulé → `SIMULATED`.
3. Moteur : émetteur, file, processor, balayeur, résolution, registre de modèles, droit `whatsapp`.
4. Consentement, préférences et historique (API + écrans).
5. Événements immédiats (planning, workshop, billing).
6. Rappels de RDV et relances de facture (cron, fuseau Africa/Douala).
7. Lien sécurisé de devis.
8. Supervision, E2E, documentation d'exploitation.

## Lot 3 (esquisse)

Webhook Meta signé (`X-Hub-Signature-256`, secret dans SSM), statuts monotones par `provider_message_id`, « STOP » → retrait du consentement, synchronisation des modèles approuvés depuis l'API Graph, réconciliation des `ACCEPTED` sans accusé, comptes WhatsApp par garage, repli SMS, quotas facturés, purge des données.
