# Notifications client multicanal (WhatsApp d'abord)

Statut : lot 2 terminé (2026-10-09). Lot 3 = webhooks Meta, statuts de remise, réconciliation.

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
- Variables communes : `customerName` (raison sociale ou prénom + nom) et `garageName` (nom de l'atelier, sinon du garage) sont lues par l'émetteur ; les dates sont à l'heure de Douala et les montants écrits `119 250 FCFA` (`notification-format.ts`).
- Bouton URL du lien de devis : le processor crée le jeton juste avant l'envoi (`issueQuoteAccessToken`, `src/shared/billing/quote-access-token.ts`) et le passe en suffixe du bouton (index 0) ; l'URL du modèle Meta est `https://<domaine>/devis/{{1}}`. Devis introuvable = `FAILED` / `MISSING_VARIABLE`.

### Points d'émission (`emitInBackground`, après l'écriture métier, sans retarder la réponse)

| Événement | Service | Moment |
|---|---|---|
| `APPOINTMENT_CONFIRMED` | `PlanningService` | création d'un RDV `SCHEDULED`/`CONFIRMED` ; modification de l'horaire ou passage en `CONFIRMED` (même horaire = même clé, pas de second message) |
| `SERVICE_ORDER_RECEIVED` | `WorkshopService` | OT créé en `RECEIVED` ou transition vers `RECEIVED` (une fois par OT) |
| `VEHICLE_READY` | `WorkshopService` | transition vers `READY` (remplace l'ancien SMS `vehicle_ready`) |
| `INVOICE_AVAILABLE` | `BillingService` | facture émise depuis un devis approuvé |
| `PAYMENT_CONFIRMED` | `BillingService` | paiement enregistré (`CONFIRMED`) ; un doublon d'idempotence n'émet rien |
| `QUOTE_APPROVAL_REQUESTED` | `BillingService` | devis envoyé (`sendQuote`, `DRAFT → SENT`) ; une révision renvoyée = nouvelle clé |

### Rappels planifiés (`reminder-scheduler.service.ts`, fuseau Africa/Douala)

| Événement | Cron | Règle |
|---|---|---|
| `APPOINTMENT_REMINDER` | toutes les heures, envois entre 7 h et 21 h | RDV `SCHEDULED`/`CONFIRMED` dans ]+2 h, +24 h] ; pas de rappel pour un RDV pris moins de 24 h à l'avance (la confirmation vient de partir) |
| `INVOICE_PAYMENT_REMINDER` | 8 h | facture `ISSUED`/`PARTIAL`, solde > 0 ; étape = dernier palier atteint (défaut J+7, J+15 après l'échéance), rattrapée 7 jours au plus ; montant = solde restant dû |

- Politique de relance par garage : `garage_notification_settings.params.reminderDaysAfterDue` (1 à 3 jours distincts dans [1, 90]) ; absente = défaut, invalide = défaut + avertissement.
- Les colonnes `invoices.reminder_1_sent_at` / `reminder_2_sent_at` ne sont plus écrites (conservées pour l'historique) : la clé d'idempotence remplace ces drapeaux. Les anciens crons SMS de `SchedulerService` sont retirés.

## API et écrans (consentement, préférences, historique)

| Route | Droit | Rôle |
|---|---|---|
| `GET /customers/:customerId/notification-consents` | `VEH_VIEW` | état par canal + 20 derniers événements de preuve + texte de consentement en vigueur |
| `PUT /customers/:customerId/notification-consents/WHATSAPP` | `VEH_CREATE` | accord ou retrait (`status`, `source`, `phone?`, `note?`) |
| `GET /customers/:customerId/notifications?limit=` | `VEH_VIEW` | historique du client (1-100, défaut 50), sans variables ni id fournisseur |
| `GET /settings/notifications` | connecté | valeur effective de chaque événement du catalogue |
| `PATCH /settings/notifications` | ADMIN | `{ settings: [{ eventType, enabled }] }` |

- Consentement : numéro normalisé en E.164 (absent = numéro principal ; retrait = numéro du consentement), sinon 400 `CONSENT_PHONE_INVALID`. Même statut et même numéro = aucune écriture (`changed: false`). Sinon état et événement de preuve dans une seule écriture imbriquée, avec la version du texte (`consent-text.ts` : tout changement de texte = nouvelle version).
- Préférences : seules les valeurs effectives qui changent sont écrites ; un second appel identique n'écrit rien.
- Client d'un autre garage : 404.
- Écrans : carte « Notifications WhatsApp » de la fiche client (`CustomerWhatsAppCard`), onglet Paramètres → Notifications (`CustomerNotificationSettings`, verrou piloté par `features.whatsapp`). Garde-fous dans `e2e-ux/`.

## Lien public de devis

| Route (publique, limite par IP) | Rôle |
|---|---|
| `GET /public/quotes/:token` (30/min) | vue du devis sans identifiant interne ni coordonnée ; `canDecide` |
| `POST /public/quotes/:token/approve` (5/min) | `SENT → APPROVED` (`clientApprovalMethod: DIGITAL`), mêmes effets que l'approbation au comptoir |
| `POST /public/quotes/:token/reject` (5/min) | `SENT → REJECTED`, motif facultatif (500 car.) notifié en in-app à la réception, au chef et à l'admin |

- Jeton : 32 octets aléatoires base64url (`opaque-token.ts`), seule l'empreinte SHA-256 est stockée. Validité 30 jours, bornée par la fin du jour `validUntil` du devis (Douala). Un nouvel envoi révoque les liens non utilisés du devis.
- Erreurs : `QUOTE_LINK_INVALID` 404 (jeton mal formé ou inconnu, garage bloqué), `QUOTE_LINK_EXPIRED` 410 (révoqué, expiré, validité dépassée, ou garage en lecture seule pour une décision ; le message donne le motif), `QUOTE_ALREADY_DECIDED` 409.
- Décision atomique sans transaction interactive : prise du jeton (`decidedAt IS NULL`) puis `updateMany` conditionnel sur `status: SENT` ; deux clics ou une approbation au comptoir simultanée ne décident qu'une fois.
- Un devis déjà tranché reste consultable. Après un refus, l'OT reste en `QUOTE_PENDING` (l'atelier révise ou annule).
- Écran : `app/devis/[token]/page.tsx` (page publique, sans compte).

## Supervision (SUPER_ADMIN)

`GET /admin/customer-notifications/health` (`CustomerNotificationsHealthService`), écran `/admin/notifications`. Lecture seule, sans donnée client : ni numéro (les numéros de test ne sont que comptés), ni variable, ni nom de client.

| Bloc | Contenu |
|---|---|
| `config` | mode, fournisseur WhatsApp (et s'il est simulé), plafond, nombre de numéros de test |
| `templates` | chaque modèle du catalogue en `fr`, approuvé ou non |
| `queue` | compteurs BullMQ (attente, en cours, différés, échecs) ; Redis muet 2 s = `available: false`, jamais une 500 |
| `outbox` | sur 24 h : nombre par statut, `SKIPPED` par raison, `FAILED` par code ; PENDING de plus de 5 min ; plus ancien PENDING |
| `quota` | 10 garages les plus consommateurs depuis le 1er du mois (Douala), statuts facturables seulement |

Alertes (`status` = pire niveau) :

| Code | Niveau | Condition |
|---|---|---|
| `QUEUE_UNAVAILABLE` | critique | Redis injoignable |
| `OUTBOX_BACKLOG` | critique | PENDING de plus de 5 min (le balayeur tourne chaque minute : la file ne consomme plus) |
| `SANDBOX_NO_RECIPIENTS` | avertissement | mode `sandbox` sans `WHATSAPP_TEST_RECIPIENTS` |
| `TEMPLATES_NOT_APPROVED` | avertissement | mode ≠ `off` et modèle actif par défaut absent de `WHATSAPP_APPROVED_TEMPLATES` |
| `RECENT_FAILURES` | avertissement | au moins un `FAILED` sur 24 h |
| `QUOTA_NEAR_LIMIT` | avertissement | garage à 80 % ou plus du plafond |

En mode `off`, seules les alertes de file comptent (les autres sont attendues).

## Exploitation

Passage en service, une étape à la fois, en vérifiant `/admin/notifications` entre chaque :

1. **`off`** (défaut) : les événements sont enregistrés en `SKIPPED` / `MODE_OFF`. Vérifier qu'aucune alerte de file n'apparaît.
2. **`sandbox`** : `CUSTOMER_NOTIFICATIONS_MODE=sandbox`, `WHATSAPP_TEST_RECIPIENTS=<numéros de l'équipe>`, `WHATSAPP_PROVIDER=whatsapp-cloud` + secrets Meta, `WHATSAPP_APPROVED_TEMPLATES` = modèles approuvés dans le WhatsApp Manager. Sur le garage de test : consentement d'un numéro de l'équipe, puis un OT passé à « Prêt » → `ACCEPTED` attendu ; tout autre client → `SANDBOX_RECIPIENT_NOT_ALLOWED`.
3. **`live`** : ajouter `CUSTOMER_NOTIFICATIONS_MONTHLY_CAP` (obligatoire), passer le mode à `live`. Surveiller `RECENT_FAILURES` et `QUOTA_NEAR_LIMIT` la première semaine.

Les variables vivent dans SSM (`/atelier-maitre/prod/env`) ; une modification demande un redémarrage de l'API (Run workflow du déploiement, ou redémarrage du conteneur). Configuration invalide = l'API refuse de démarrer : le check `/api/health` du déploiement échoue avant toute mise en ligne.

Retour arrière : `CUSTOMER_NOTIFICATIONS_MODE=off` puis redémarrage. Les PENDING restants passent en `SKIPPED` / `MODE_OFF` ; l'historique est conservé.

Incidents :

- `QUEUE_UNAVAILABLE` / `OUTBOX_BACKLOG` : vérifier le conteneur Redis (`docker ps`, `docker logs`). Les notifications restent en base et le balayeur les réenfile au retour de Redis ; celles prises en charge depuis plus de 10 min passent en `FAILED` / `UNKNOWN_OUTCOME` sans renvoi.
- `FAILED` avec un code Meta : modèle refusé ou désactivé, jeton expiré (renouveler `WHATSAPP_ACCESS_TOKEN` dans SSM), numéro invalide.
- Ajout ou nouvelle version de modèle : l'approuver chez Meta d'abord, puis l'ajouter à `WHATSAPP_APPROVED_TEMPLATES` ; jamais l'inverse (sinon `FAILED` côté Meta au lieu de `SKIPPED`).

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
8. Supervision SUPER_ADMIN, garde-fou UX, documentation d'exploitation.

## Lot 3 (esquisse)

Webhook Meta signé (`X-Hub-Signature-256`, secret dans SSM), statuts monotones par `provider_message_id`, « STOP » → retrait du consentement, synchronisation des modèles approuvés depuis l'API Graph, réconciliation des `ACCEPTED` sans accusé, comptes WhatsApp par garage, repli SMS, quotas facturés, purge des données.
