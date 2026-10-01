# Plan de correction — septembre 2026

Rédigé le 2026-09-23 et mis à jour le même jour après le merge de `a61fb06` sur `main` (squash de `fix/trial-onboarding-ux-qa`). Branche restante : `fix/ux-onboarding-and-qa` @ `b3a9bba`.

Chaque lot correspond à une PR, dans l'ordre d'exécution.

| Lot | Sujet | Priorité | Effort | État |
|-----|-------|----------|--------|------|
| 0 | Porter ce qui manque de `fix/ux-onboarding-and-qa` sur `main` | Bloquant | ½ j | À faire |
| 1 | Suspension de tenant sans toucher au statut des utilisateurs | Haute (bug) | ½ j | Règle validée |
| 2 | Droits par forfait (logo, SMS) centralisés + guard sans requête supplémentaire | Haute | 1 j | Règles validées |
| 3 | Redis : worker `stock-alerts` manquant + SSE multi-instance | Moyenne / différé | ½ j + ½ j | À faire |
| 4 | Nettoyage : dépendances, code mort, `.env.example` | Basse | 1 h | Anciens déploiements ✅ |
| 5 | Déploiements sans gêne pour les ateliers | Moyenne | ½ j | Points 1-2 ✅ |

## Règles produit

| Sujet | Règle | Statut |
|-------|-------|--------|
| Logo personnalisé | Forfait payant `ACTIVE` uniquement. Sinon, **logo Atelier Maître** partout (app, devis, factures, PDF) | ✅ Validé |
| Suspension | La suspension d'un tenant bloque tout son atelier. La réactivation débloque tout l'atelier, **sauf** les utilisateurs suspendus individuellement par leur ADMIN | ✅ Validé |
| SMS | **Pro** et **Business** `ACTIVE`. Pas pour Essentiel, ni pendant le pilote, ni pendant la grâce (conforme à la page tarifs) | ✅ Validé |
| Ancien logo après expiration | Si un tenant payant repasse `EXPIRED`/`SUSPENDED`, son logo est **conservé en base mais masqué**, et réapparaît au renouvellement | ✅ Validé |

---

## Lot 0 — Porter `fix/ux-onboarding-and-qa` sur `main`

**Constat.** `fix/trial-onboarding-ux-qa` est dans `main`. L'autre branche traite le même périmètre (30 fichiers modifiés, dont la plupart ont aussi changé sur `main`) : un merge direct produirait des conflits presque partout. Elle contient pourtant des choses absentes de `main` :

| À reprendre | Commits |
|-------------|---------|
| Blocage SMS côté serveur (controller + worker) | `bc23817`, `e53c456`, `33bb92a`, `ddff609`, `3b94a4d` |
| E-mail de confirmation d'inscription (`SignupEmailService`) + doc env | `2a9666a`, `7dc92cf` |
| Onboarding : cibles cachées sautées sur mobile, test du tour obligatoire | `b3a9bba`, `8e3326c` |
| Textes : exclusion SMS pendant le pilote, « identifiant » | `33fecd7`, `91020a2`, `3719c59` |
| `sw.js` : erreurs hors ligne (à comparer avec la version de `main`) | `76c821f` |

À **ne pas** reprendre, car `main` le fait déjà : ville, libellés d'audit, cartes tarifs, body parser, logo côté API.

**Actions.**
1. Créer une nouvelle branche depuis `main` et y cherry-pick les commits ci-dessus, dans l'ordre.
2. Réécrire `assertSmsEntitled` dans le format du lot 2. Il peut aussi être porté tel quel, puis remplacé au lot 2.
3. Garder **une seule** suite Playwright UX :
   - `main` a `e2e-qa/` + `test:qa` + `qa-ux.yml` (planifié) ;
   - la branche a `e2e/ux/` + `test:ux` dans le job CI.
   - Proposition : fusionner les deux dans `e2e-qa/`, lancée sur chaque PR **et** chaque nuit contre la prod.
4. Supprimer `fix/ux-onboarding-and-qa` une fois le portage mergé.

---

## Lot 1 — Suspension de tenant

**Constat.** `AdminService.toggleTenantStatus` ([admin.service.ts:64](../src/modules/admin/admin.service.ts#L64)) :
- bascule `Tenant.status` (texte), qui n'est lu par aucun guard ;
- passe **tous** les utilisateurs du tenant en `SUSPENDED` (c'est ce qui bloque réellement l'accès), puis **tous** en `ACTIVE` à la réactivation. Un utilisateur désactivé par son ADMIN (`TeamService.toggleStatus`) est donc réactivé à tort ;
- n'utilise pas de transaction ;
- ne pose jamais `Tenant.subscriptionStatus = SUSPENDED`, alors que le guard et le front (`SUBSCRIPTION_SUSPENDED`) l'attendent.

**Principe retenu.** La suspension se fait **au niveau du tenant**. Le statut d'un utilisateur ne reflète que ce que son ADMIN a décidé. La règle validée en découle naturellement : réactiver le tenant ne touche à personne, donc ceux que l'ADMIN avait suspendus le restent.

**Actions.**
1. `toggleTenantStatus` :
   - **Suspendre** : `subscriptionStatus = SUSPENDED`, en gardant le statut précédent dans une nouvelle colonne `statusBeforeSuspension`.
   - **Réactiver** : restaurer ce statut, puis appeler `reconcileTenant` pour recalculer TRIAL/GRACE/EXPIRED si la date est passée entre-temps.
   - Plus aucun `user.updateMany`.
2. `SubscriptionGuard` bloque déjà `SUSPENDED` avec le code `SUBSCRIPTION_SUSPENDED` : l'écran dédié s'affichera au lieu d'un 401.
3. Supprimer la notion `Tenant.status` : l'UI `/admin/tenants` lit `subscriptionStatus`. Colonne supprimée par une migration ultérieure.
4. **Migration des données (manuelle, à valider en prod).**
   - Pour chaque tenant avec `status = 'suspended'` : passer `subscription_status = 'SUSPENDED'`.
   - Pour les tenants **actifs**, les utilisateurs `SUSPENDED` ont forcément été suspendus par leur ADMIN, car la réactivation remettait tout le monde à `ACTIVE` : ne pas y toucher.
   - Pour les tenants **actuellement suspendus**, on ne peut pas distinguer les deux cas. Lister ces utilisateurs, décider à la main, puis passer à `ACTIVE` ceux qui ne l'ont été que par la suspension du tenant.
5. Tests :
   - Suspendre puis réactiver le tenant laisse un utilisateur suspendu par son ADMIN en `SUSPENDED`, et les autres en `ACTIVE` (sans jamais les modifier).
   - Un utilisateur d'un tenant suspendu reçoit un 403 `SUBSCRIPTION_SUSPENDED`.
   - Le SUPER_ADMIN n'est jamais bloqué.

---

## Lot 2 — Droits par forfait + guard sans requête supplémentaire

**Constats.**
- Chaque règle d'accès est codée en ligne : logo dans `settings.controller` (`status !== 'ACTIVE'`) ; SMS dans la branche du lot 0 (`ACTIVE` + `pro`/`business`).
- Les identifiants de forfait ne sont pas cohérents : `starter` (valeur par défaut en base, anciens tenants), `essential` (page tarifs), `pro` (pilote).
- `SubscriptionGuard` relit le tenant à chaque requête alors que `JwtAuthGuard` vient de le charger ([auth.guard.ts:40](../src/guards/auth.guard.ts#L40)).
- Un logo déjà enregistré reste affiché si l'abonnement expire.

**Actions.**
1. **Forfaits normalisés.** Créer un type `PlanId = 'essential' | 'pro' | 'business'` et une fonction `normalizePlan()` qui traduit `starter` en `essential`. La migration réécrit `starter` en `essential` et change la valeur par défaut de la colonne.
2. **Table des droits d'accès unique** (`src/modules/subscription/entitlements.ts`) :
   ```ts
   export type Feature = 'sms' | 'branding';
   export const ENTITLEMENTS: Record<Feature, (s: { status: SubscriptionStatus; plan: PlanId }) => boolean> = {
     branding: (s) => s.status === 'ACTIVE',
     sms:      (s) => s.status === 'ACTIVE' && (s.plan === 'pro' || s.plan === 'business'),
   };
   ```
   - Ajouter un décorateur `@RequireFeature('sms' | 'branding')`, vérifié dans `SubscriptionGuard`.
   - Le worker SMS appelle `assertFeature(tenantId, 'sms')`, car il ne passe pas par les guards.
   - `/subscription/status` renvoie `features: { sms, branding }`, et le front n'a plus de règle en dur (`isFreePilot`).
3. **Logo Atelier Maître par défaut.**
   - `GET /settings/workshop` renvoie `logoUrl: null` si `branding` est faux. Le logo reste en base : il réapparaît au renouvellement.
   - Générer un PNG statique de la marque, `public/brand/atelier-maitre.png`, à partir de `AppIconShell` ([lib/app-icon.tsx](../lib/app-icon.tsx)), pour qu'il soit utilisable par jsPDF.
   - Remplacer les solutions de repli actuelles par ce logo :
     - [BillingDocument.tsx:84](../components/billing/BillingDocument.tsx#L84) : première lettre du nom de l'atelier ;
     - [generate-billing-pdf.ts:51](../lib/generate-billing-pdf.ts#L51) : nom de l'atelier en texte ;
     - l'en-tête et la barre latérale de l'app.
   - Page Paramètres pendant le pilote : aperçu du logo Atelier Maître + bouton « Disponible avec un forfait payant ».
4. **Guard sans requête supplémentaire.**
   - `JwtAuthGuard` charge aussi les champs d'abonnement du tenant.
   - `SubscriptionGuard` appelle `resolveStatus(request.user.tenant, now)`, rendue publique et pure : aucune requête Prisma.
   - La persistance des transitions reste assurée par le cron horaire et par `GET /subscription/status`.
5. Tests :
   - Tableau de cas statut × forfait × fonctionnalité.
   - Le guard ne fait aucun appel Prisma.
   - Le logo est masqué en `EXPIRED` et revient en `ACTIVE`.
   - Le PDF d'un tenant en pilote contient le logo Atelier Maître.
   - Le worker SMS refuse Essentiel et le pilote.

**Hors code — fournisseur SMS.** L'envoi est aujourd'hui simulé (`mockSmsGateway` dans [sms.processor.ts](../src/workers/sms.processor.ts)). Avant de vendre le forfait Pro :
- ajouter une interface `SmsProvider` (`send(phone, text) → { providerId, status }`), avec le simulateur comme implémentation par défaut ;
- choisir **un agrégateur local** qui couvre Orange **et** MTN avec une seule API, un nom d'expéditeur personnalisé et une facturation en XAF. C'est plus simple à intégrer que deux API d'opérateur, et moins cher que Twilio sur le Cameroun ;
- comparer 2 ou 3 offres (prix unitaire, délai d'activation du nom d'expéditeur, rapports de remise, paiement Mobile Money), et prévoir un quota mensuel de SMS par forfait pour maîtriser le coût.

---

## Lot 3 — Redis

**Rôle actuel de Redis.** Il sert uniquement de support aux files **BullMQ**, c'est-à-dire aux traitements en arrière-plan qui doivent survivre à un redémarrage et être réessayés en cas d'échec :

| File | Produit par | Traité par |
|------|-------------|------------|
| `sms-notifications` | `NotificationsService`, `WorkshopService`, `SchedulerService` (rappels J+7, J+15, veille de RDV) | `SmsProcessor` ✅ |
| `stock-alerts` | `StockService` (seuil bas atteint) | **Aucun worker** ❌ |

### 3a — Worker `stock-alerts` manquant (à faire)
Les jobs `low-stock` sont ajoutés à la file mais personne ne les consomme. Ils s'accumulent dans Redis, et aucune alerte n'est envoyée.

**Actions.**
- Créer un `StockAlertsProcessor` qui envoie une notification in-app (et un événement SSE) au CHEF_ATELIER et à l'ADMIN du garage.
- Ajouter une option de SMS si la fonctionnalité `sms` est active.
- Ajouter à tous les `queue.add` : `jobId` pour la déduplication (un seul job par pièce et par jour), `removeOnComplete` et `removeOnFail` pour que Redis ne grossisse pas.
- Vider une fois la file existante en prod.

### 3b — Événements temps réel sur plusieurs instances (différé)
`EventsService` garde les connexions SSE en mémoire du process. Avec une seule instance (l'EC2 actuelle), cela fonctionne. **À faire seulement le jour où l'API tourne sur deux instances ou plus** : chaque instance publie les événements sur un canal Redis `atelier:events` et diffuse ceux qu'elle reçoit à ses clients locaux, avec le filtrage existant par utilisateur, garage et rôle.

Redis **n'est pas** nécessaire pour le lot 2 : le guard y lit l'abonnement dans la requête que `JwtAuthGuard` fait déjà, donc aucun cache n'est utile.

---

## Lot 4 — Nettoyage

| Élément | Action | État |
|---------|--------|------|
| Anciens déploiements (Oracle, Fly, Railway) | Déplacés dans `deploy/legacy/` (+ README), `.gitignore`/`.dockerignore` et docs mis à jour | ✅ Fait |
| `@google/genai` | Aucun import → `npm uninstall @google/genai` | À faire |
| `lib/mock-data.ts` | Plus importé → supprimer | À faire |
| `app/api/dashboard/stats/route.ts` | Stub non appelé (JSON avec statut 301 sans `Location`) → supprimer | À faire |
| `.env.example` | `ALLOWED_ORIGINS=http://localhost:3005` → port 3000 ; retirer les commentaires Railway ; ajouter `APP_DOMAIN`, `ACME_EMAIL` et les variables d'e-mail du lot 0 | À faire |
| `main.ts` — Helmet | CSP désactivée « pour l'iframe AI Studio » → la réactiver, d'abord en `reportOnly` | À faire |
| `scripts/` | Scripts `db-*` ponctuels (audit de juin) → `scripts/archive/` ; retirer du suivi git les sorties `*.json`/`*.txt` | À faire |

Critère de sortie : `npm run type:check`, `npm test` et `npm run build` passent.

---

## Lot 5 — Déploiements sans gêne pour les ateliers

**Constat.** Un seul serveur, donc chaque déploiement coupe l'API et le site pendant 30 à 60 s. Un utilisateur voyait « Erreur 502 », pouvait perdre sa saisie en rechargeant la page, et risquait un doublon si une écriture était coupée en plein vol.

| Point | Contenu | État |
|-------|---------|------|
| 1. Application | `lib/api.ts` reconnaît une indisponibilité temporaire (502/504, 503 `MAINTENANCE` de Caddy, réseau coupé). Les consultations sont réessayées automatiquement pendant environ 1 min. Les écritures ne sont **jamais** réessayées (risque de doublon) : le formulaire reste rempli et un message clair s'affiche. Bandeau `ServiceStatusBanner` « Mise à jour en cours », puis « Connexion rétablie ». | ✅ |
| 2. Serveur | Page de maintenance Atelier Maître servie par Caddy (`deploy/docker/maintenance/`), avec rechargement automatique au retour. `enableShutdownHooks` + `stop_grace_period: 30s` : l'API finit les requêtes en cours avant de s'arrêter. `caddy reload` à chaque déploiement. | ✅ |
| 3. Organisation | Fenêtre de déploiement : un merge sur `main` déploie automatiquement le soir (après 19 h, heure de Douala) ou le dimanche, et un `workflow_dispatch` « déployer maintenant » reste disponible pour les correctifs urgents. | À faire |

**Plus tard (si besoin).** Zéro coupure avec un déploiement blue-green : deux versions côte à côte derrière Caddy. Ça demande probablement une instance plus grosse que la `t3.micro` (1 Go de mémoire).
