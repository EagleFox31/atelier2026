# Leçons d'ingénierie (mémoire RAIDER)

Ce fichier est l'emplacement par défaut de la mémoire des échecs RAIDER pour Atelier Maître.

On n'y consigne pas chaque coquille : seulement les leçons qui révèlent un angle mort, qui ont causé du travail à refaire ou un risque réel, et qui ont des chances de se reproduire.

**Avant un travail risqué qui ressemble à un incident connu, chercher dans ce fichier.**

Standard de référence : [RAIDER](https://github.com/EagleFox31/project-registry/blob/main/RAIDER.md).

## Classification

`architecture` · `security` · `ci-cd` · `data` · `dependency` · `infrastructure` · `release-deployment` · `automation` · `ux` · `performance` · `testing` · `process`

## Modèle d'entrée

```markdown
### LESSON-YYYY-NNN — Titre court

- **Date** : YYYY-MM-DD
- **Catégorie** : <classification>
- **Statut** : captured | prevention-added | generalized
- **Lié à** : PR, issue, incident, commit

**Contexte**
...

**Échec / near miss**
...

**Cause racine**
...

**Résolution**
...

**Prévention**
...

**Leçon généralisée**
...

**Principe dérivé / changement de standard**
...
```

## Règles

- Décrire la **cause racine**, pas les symptômes.
- Préférer une **prévention vérifiable** (test, contrôle CI, lint, garde-fou) à un simple rappel.
- Les **near misses** comptent autant que les incidents.
- Ne jamais inclure de secrets, tokens ou données de production.
- Lier les PR plutôt que recopier de longs historiques.
- Un échec qui se répète ⇒ **renforcer la prévention** de l'entrée existante, pas créer une entrée en double.
- Une leçon valable pour plusieurs dépôts ⇒ la **promouvoir dans RAIDER**.

## Leçons

### LESSON-2026-001 — Un déploiement « vert » qui ne déploie rien (merge commits)

- **Date** : 2026-10-01
- **Catégorie** : `ci-cd` · `release-deployment`
- **Statut** : prevention-added
- **Lié à** : [PR #26](https://github.com/EagleFox31/atelier2026/pull/26), [PR #24](https://github.com/EagleFox31/atelier2026/pull/24), [PR #25](https://github.com/EagleFox31/atelier2026/pull/25)

**Contexte**
`deploy.yml` (déclenché par la CI via `workflow_run` sur `main`) utilisait `dorny/paths-filter@v3` avec `fetch-depth: 2` pour décider quelles images construire. Jusqu'au 23/09, les PR étaient fusionnées en squash.

**Échec / near miss**
Les PR #24 et #25 ont été fusionnées avec un merge commit. paths-filter (événement `workflow_run`, pas de `before` dans le payload → « changes will be detected from last commit ») a renvoyé api/web/runtime/infra = false : jobs de build et de déploiement sautés, workflow vert. La production est restée sur `a61fb06` pendant plusieurs jours ; le workflow QA quotidien continuait d'échouer sur des bugs déjà corrigés, et c'est ainsi que le problème a été repéré.

**Cause racine**
La détection des changements reposait sur la base implicite d'une action tierce, pour un type d'événement qu'elle ne traite pas comme push/PR ; avec cette méthode, un merge commit ne montre aucun fichier. Un déploiement sauté était impossible à distinguer d'un déploiement réussi (tous deux verts).

**Résolution**
paths-filter remplacé par une étape explicite `git diff --name-only HEAD^1 HEAD` (le premier parent couvre les commits simples, squash et merge) ; redéploiement manuel de `main` via `workflow_dispatch`.

**Prévention**
L'étape affiche les fichiers détectés dans le log ; le script de détection a été testé sur de vrais commits (merge #25, merge #24, squash `a61fb06`, docs seules `d63094f`) avant la fusion ; un commit de docs seules ne déclenche correctement aucun déploiement.

**Leçon généralisée**
Pour un déploiement, « sauté » ne doit jamais ressembler à « réussi » ; les règles de détection des changements sont du code et doivent être testées sur chaque stratégie de fusion utilisée par l'équipe (RAIDER — Change-scoped execution : tester les règles de déclenchement elles-mêmes).

**Principe dérivé / changement de standard**
Sous-point candidat pour RAIDER : un pipeline de déploiement doit signaler explicitement quand il ne déploie rien (summary/annotation), et la détection des changements doit être validée sur des commits merge, squash et push direct.

### LESSON-2026-002 — Versioning bloqué en silence par un tag hors historique

- **Date** : 2026-10-01
- **Catégorie** : `release-deployment` · `ci-cd`
- **Statut** : generalized
- **Lié à** : [PR #28](https://github.com/EagleFox31/atelier2026/pull/28), release v1.9.0 ([PR #29](https://github.com/EagleFox31/atelier2026/pull/29))

**Contexte**
semantic-release tournait dans la CI sur push vers `main`. L'historique de `main` avait été réécrit en septembre ; les anciens tags (v1.7.x, v1.8.0, v1.8.1) pointaient vers des commits présents uniquement sur les anciennes branches `codex/*`.

**Échec / near miss**
Du 15/09 au 01/10, chaque exécution de la CI a sauté semantic-release avec un simple avertissement jaune (« latest tag v1.8.1 is on divergent history »). 11 changements feat/fix n'ont jamais été versionnés ; l'application affichait toujours v1.8.1.

**Cause racine**
La réécriture de l'historique de `main` a rendu les tags de release inaccessibles ; le garde-fou de la CI, conçu pour éviter une CI rouge, a transformé un échec de release en avertissement que personne ne lisait.

**Résolution**
Tag v1.8.1 déplacé sur `e02d3a9` (son équivalent octet pour octet sur `main`, vérifié avec `git diff c5cd58c e02d3a9` vide) ; migration vers le workflow AppFactory partagé `EagleFox31/appfactory-project-automation/.github/workflows/reusable-release.yml@v1` (Release Please, PR de release, `version.txt` comme source de vérité unique, lu par `deploy.yml`) ; v1.9.0 publiée.

**Prévention**
La version vit désormais dans `version.txt` (relue dans une PR de release) au lieu d'être déduite des tags ; l'outillage de release est partagé et maintenu centralement (RAIDER Reuse-first : Adopt).

**Leçon généralisée**
Ne jamais réécrire une branche qui porte des tags de release sans les ré-ancrer ; une étape de release qui peut être sautée doit échouer bruyamment ou alerter, pas se contenter d'un avertissement.

**Principe dérivé / changement de standard**
Adoption du workflow de release partagé AppFactory (Reuse-first : Adopt).

### LESSON-2026-003 — Comparer des Decimal Prisma avec `<=` compare des chaînes

- **Date** : 2026-10-01
- **Catégorie** : `data` · `testing`
- **Statut** : prevention-added
- **Lié à** : [PR #31](https://github.com/EagleFox31/atelier2026/pull/31)

**Contexte**
`StockService` mettait en file une alerte de stock bas quand `part.qtyInStock <= part.minThreshold` (deux `Decimal` Prisma).

**Échec / near miss**
Les opérateurs relationnels JS appellent `valueOf()`, qui renvoie une chaîne pour un `Decimal` : `"9" <= "10"` est faux (alerte manquée), `"2" <= "10"` faux (manquée), `"10" <= "9"` vrai (fausse alerte). De plus, aucun worker ne consommait la file `stock-alerts` : les alertes n'atteignaient jamais personne et s'accumulaient dans Redis.

**Cause racine**
TypeScript autorise `<=` entre objets ; les tests unitaires simulaient les quantités avec de simples `number`, ce qui masquait le bug.

**Résolution**
Utilisation de `.lte()` ; ajout de `StockAlertsProcessor` (dédoublonnage : un job par pièce et par jour, backlog de plus de 24 h ignoré).

**Prévention**
Les tests utilisent désormais de vrais `Prisma.Decimal` ; vérification par mutation effectuée — réintroduire `<=` fait échouer 4 tests.

**Leçon généralisée**
Les tests doivent utiliser les vrais types de valeurs à la frontière (`Decimal`, `Date`, `BigInt`), pas des primitives pratiques ; une file sans consommateur est un échec silencieux.

**Principe dérivé / changement de standard**
Convention candidate : interdire les opérateurs relationnels sur les `Decimal` Prisma (règle de lint ou checklist de revue de code).

### LESSON-2026-004 — Des étiquettes de formulaire non reliées cassent l'accessibilité et le QA

- **Date** : 2026-10-01
- **Catégorie** : `ux` · `testing`
- **Statut** : prevention-added
- **Lié à** : [PR #25](https://github.com/EagleFox31/atelier2026/pull/25)

**Contexte**
Le composant `Field` de l'assistant d'inscription rendait un `<label>` sans `htmlFor` ; le QA Playwright quotidien (`qa-ux.yml`) utilise `getByLabel`.

**Échec / near miss**
Le QA a échoué chaque jour à partir du 24/09 (timeout sur `getByLabel('Prénom')`). Impact réel pour les utilisateurs : les lecteurs d'écran n'annonçaient pas le nom des champs, et cliquer sur une étiquette ne donnait pas le focus au champ. Un second test utilisait `.nth(1)` sur les liens « Réserver une démo » et visait le mauvais lien. Un workflow planifié rouge est passé inaperçu pendant une semaine.

**Cause racine**
Étiquettes non associées programmatiquement aux champs ; tests reposant sur des sélecteurs positionnels.

**Résolution**
`Field` exige `htmlFor`, chaque champ a un `id` (y compris `CityCombobox`) ; le test QA cible `a[href*="plan=pro"]` et utilise `exact: true` pour « Nom » (qui sinon correspond aussi à « Prénom »).

**Prévention**
La suite QA passe désormais ; les sélecteurs par nom accessible (`getByLabel` / `getByRole`) servent de garde-fou d'accessibilité.

**Leçon généralisée**
Un workflow planifié rouge doit notifier quelqu'un ; préférer les sélecteurs par nom accessible aux sélecteurs positionnels.

**Récidive (2026-10-01, lot 0B)**
Même piège dans la suite `e2e-ux/` portée depuis la #11 : `getByPlaceholder('Nom')` résolvait aussi « Prénom » (strict mode violation). La première prévention (corriger le test concerné) était donc insuffisante.

**Principe dérivé / changement de standard**
Convention de test renforcée : pour `getByLabel` / `getByPlaceholder` / `getByText` sur un libellé court ou contenu dans un autre (« Nom », « Email », « Ville »…), **toujours `{ exact: true }`** ou un rôle accessible (`getByRole(..., { name, exact: true })`). La suite `e2e-ux/` tourne désormais sur chaque PR front (`ux-guardrails.yml`), ce qui détecte ces régressions avant merge.

**Récidive 2 (2026-10-02)**
`/login` et `/forgot-password` avaient eux aussi des `<label>` sans `htmlFor` : la correction de 2026-10-01 ne visait que `Field` de l'inscription. Repéré par un script Playwright contre la prod (`getByLabel` en timeout). **Contrôle renforcé** (erreur répétée) : test générique `chaque champ de <page> a un nom accessible` dans `e2e-ux/` (`/login`, `/forgot-password`, `/inscription`) qui échoue pour tout champ visible sans `label` relié, `aria-label` ni `aria-labelledby`. Il a trouvé `/forgot-password` tout seul (contre-épreuve). Ajouter toute nouvelle page publique à formulaire à cette liste.

### LESSON-2026-005 — Réactiver un atelier réactivait des employés suspendus

- **Date** : 2026-10-01
- **Catégorie** : `data` · `architecture`
- **Statut** : prevention-added
- **Lié à** : [PR #30](https://github.com/EagleFox31/atelier2026/pull/30)

**Contexte**
La suspension d'un tenant par le SUPER_ADMIN basculait le statut de tous les utilisateurs (tous `SUSPENDED`, puis tous `ACTIVE`) au lieu du statut d'abonnement du tenant.

**Échec / near miss**
Near miss en production : réactiver un tenant réactivait en silence les utilisateurs qu'un ADMIN avait suspendus individuellement (par ex. un employé licencié) ; les utilisateurs d'un tenant suspendu recevaient un 401 au lieu de l'écran de suspension dédié.

**Cause racine**
Deux concepts indépendants (suspension du tenant vs suspension individuelle d'un utilisateur) étaient stockés dans le même champ, si bien que l'opération inverse ne pouvait pas connaître l'état précédent.

**Résolution**
La suspension est portée par `Tenant.subscriptionStatus = SUSPENDED` (+ `status_before_suspension` pour restaurer) ; les statuts utilisateurs ne sont jamais touchés ; les suspensions héritées sont réactivées une seule fois à l'ancienne, donc aucune correction manuelle en prod.

**Prévention**
Des tests unitaires vérifient que la réactivation n'appelle jamais `user.updateMany`, plus des tests du guard pour `SUBSCRIPTION_SUSPENDED`.

**Leçon généralisée**
Une opération censée être réversible ne doit pas écraser un état qu'elle ne possède pas ; stocker l'état scopé sur l'entité qui porte ce scope.

**Principe dérivé / changement de standard**
—

### LESSON-2026-006 — Les codes d'erreur métier n'atteignaient jamais le client

- **Date** : 2026-10-01
- **Catégorie** : `architecture` · `testing`
- **Statut** : prevention-added
- **Lié à** : branche `fix/lot0-sms-entitlements` (commit « fix(api): keep business errorCode in HTTP error responses »)

**Contexte**
Les gardes et services lèvent des `ForbiddenException({ errorCode, … })` documentées comme contrat front : `TRIAL_READ_ONLY`, `TRIAL_EXPIRED`, `SUBSCRIPTION_SUSPENDED`, `PAID_FEATURE_REQUIRED`, `SMS_SUBSCRIPTION_REQUIRED`.

**Échec / near miss**
Le filtre global `AllExceptionsFilter` ne lisait que `res.error` : toute exception HTTP ressortait avec `errorCode: "HTTP_ERROR"`, sans ses détails (`subscriptionStatus`, `plan`…). Le contrat documenté dans `CLAUDE.md` ne fonctionnait pas en production. Découvert par un test d'intégration HTTP écrit pour le droit SMS.

**Cause racine**
Les tests des gardes vérifiaient l'exception levée, jamais le corps HTTP réellement renvoyé ; le filtre global, transverse, n'avait pas de test sur ce cas.

**Résolution**
Le filtre privilégie `res.errorCode` et conserve les détails métier, sans qu'ils puissent écraser `statusCode`, `errorCode`, `message`, `path` ou `timestamp`. Comportement inchangé sans `errorCode`.

**Prévention**
Tests du filtre : code métier + détails conservés, réponse inchangée sans code, champs protégés. Le test d'intégration HTTP du SMS vérifie `SMS_SUBSCRIPTION_REQUIRED` de bout en bout.

**Leçon généralisée**
Un contrat d'API se teste au niveau où le client le consomme (le corps HTTP), pas seulement au niveau de l'objet qui le produit : un composant transverse (filtre, intercepteur, sérialiseur) peut l'effacer en silence.

**Principe dérivé / changement de standard**
Tout nouveau `errorCode` documenté pour le front doit avoir au moins un test d'intégration HTTP qui l'assert.

### LESSON-2026-007 — Un formulaire imbriqué fermait la fenêtre « Nouvel OT »

- **Date** : 2026-10-01
- **Catégorie** : `ux` · `architecture`
- **Statut** : prevention-added
- **Lié à** : branche `fix/lot0b-signup-ux-guardrails` (commit « fix(workshop): keep the New OT dialog open… »)

**Contexte**
La création inline d'un client ou d'un véhicule (`InlineCustomerCreate`, `InlineVehicleCreate`) est utilisée seule (réception express) et **dans** le formulaire « Nouvel OT ».

**Échec / near miss**
Bug en production : cliquer « Créer et sélectionner » dans « Nouvel OT » fermait toute la fenêtre ; la réceptionniste perdait l'OT en cours de saisie. Révélé en portant la suite Playwright de la #11.

**Cause racine**
Les composants inline étaient des `<form>` : imbriqués dans le `<form>` de l'OT (HTML invalide), leur événement submit remontait au formulaire parent via le système d'événements de React. Composant réutilisable conçu pour un seul contexte d'usage.

**Résolution**
Conteneur `role="group"` + bouton `type="button"` ; utilitaire partagé `lib/inline-form.ts` (`submitOnEnter`) qui garde « Entrée crée » sans soumettre le formulaire parent.

**Prévention**
Test e2e « Créer et sélectionner garde immédiatement le nouveau client sans rechargement » (modale toujours ouverte, pas de rechargement) dans `e2e-ux/`, exécuté sur chaque PR front ; contre-épreuve faite : avec l'ancien `<form>`, le test échoue.

**Leçon généralisée**
Un composant réutilisable doit être sûr dans tous ses contextes d'insertion : un sous-formulaire ne doit jamais être un `<form>`.

**Principe dérivé / changement de standard**
Règle de travail CLAUDE.md n° 22 : jamais de `<form>` imbriqué ; les mini-formulaires utilisent `submitOnEnter`.

### LESSON-2026-008 — Mots de passe stockés en clair, faibles et jamais renouvelés

- **Date** : 2026-10-01
- **Catégorie** : `security` · `data`
- **Statut** : prevention-added
- **Lié à** : branche `fix/password-security` ; issue #15 (invitations sécurisées)

**Contexte**
Découvert en codant l'e-mail de bienvenue (#37), qui devait initialement envoyer les mots de passe de l'équipe.

**Échec / near miss**
`User.tempPassword` contenait des mots de passe **en clair**, y compris le **vrai mot de passe choisi par l'admin à l'inscription** ; la page Équipe les renvoyait en clair à tout ADMIN. Les mots de passe temporaires étaient devinables (`Prénom` + 4 chiffres + `!`, 9 000 combinaisons, `Math.random`, aussi générés côté navigateur) et aucun changement n'était imposé.

**Cause racine**
Une commodité produit (« revoir le mot de passe d'un employé ») a été implémentée en conservant le secret au lieu de permettre d'en régénérer un ; aucune règle ne l'interdisait.

**Résolution**
Plus aucune écriture de `temp_password` ; migration qui l'efface et impose un changement aux comptes concernés ; générateur `crypto.randomInt` (`src/shared/security/temp-password.ts`, ≈ 69 bits) côté serveur uniquement ; affichage unique (`OneTimeCredentials`) ; `must_change_password` + `POST /auth/change-password` ; `JwtAuthGuard` renvoie 403 `PASSWORD_CHANGE_REQUIRED` hors routes `@AllowPendingPasswordChange()` ; garde d'abonnement ouverte au changement (sinon blocage en période de grâce).

**Prévention**
Tests : aucun `tempPassword` dans les écritures Prisma (création, réinitialisation), format et unicité du générateur, politique serveur du nouveau mot de passe, blocage par la garde, migration jouée deux fois sur PostgreSQL ; test e2e du changement imposé. Règle CLAUDE.md n° 23.

**Leçon généralisée**
Un secret ne se stocke jamais réversiblement « pour le revoir plus tard » : on le régénère. Toute génération de secret passe par un générateur cryptographique côté serveur.

**Principe dérivé / changement de standard**
Règle n° 23 (CLAUDE.md). Suite logique : invitations par lien à usage unique (issue #15), qui supprimeront aussi l'affichage du mot de passe temporaire.

### LESSON-2026-009 — `@Throttle` sans `ThrottlerGuard` : aucune limitation de débit

- **Date** : 2026-10-02
- **Catégorie** : `security` · `testing`
- **Statut** : prevention-added
- **Lié à** : issue #15 (branche `feat/issue-15-team-invitations`)

**Contexte**
`ThrottlerModule.forRoot` est configuré dans `AppModule` et l'inscription publique porte `@Throttle({ limit: 5 })` ; on pensait le throttler « global ».

**Échec / near miss**
En ajoutant les routes publiques d'invitation, constat qu'aucun `ThrottlerGuard` n'est enregistré (ni `APP_GUARD`, ni `@UseGuards`) : les `@Throttle` ne font rien. L'inscription publique n'a donc jamais été limitée. Un test HTTP (6 tentatives → 429) échoue bien sans le garde (contre-épreuve faite).

**Cause racine**
Le décorateur ne fait que poser des métadonnées ; c'est le garde qui applique la limite. Aucun test ne vérifiait un 429.

**Résolution**
`ClientIpThrottlerGuard` (`src/shared/security/`), appliqué par `@UseGuards` sur `/public/invitations`. Il suit l'IP client transmise par Caddy (`X-Forwarded-For`, entrée la plus à droite) : sans cela, derrière le proxy, tous les utilisateurs partageraient le même compteur.

**Prévention**
Test de contrat `invitations.contract.spec.ts` : la 6e tentative par IP reçoit 429, une autre IP non. Note dans CLAUDE.md (multi-tenant & abonnement).

**Suite (2026-10-02, branche `fix/rate-limiting`)** : `ClientIpThrottlerGuard` est désormais la **première garde globale** (`APP_GUARD`) ; limites centralisées dans `src/shared/security/rate-limits.ts` (globale 600/min/IP — un garage partage souvent une IP — ; connexion 10/min, mot de passe oublié 5/15 min, inscription 5/min, démo 6/min, invitations 20 et 5/min) ; `/api/health` et le webhook NotchPay exclus (`@SkipThrottle`) ; 429 métier `RATE_LIMITED` + `Retry-After`. **Garde-fou anti-récidive** : `rate-limit.contract.spec.ts` lit les providers du vrai `AppModule` et échoue si la garde n'y est plus la première `APP_GUARD` (contre-épreuve faite).

**Leçon généralisée**
Un mécanisme de sécurité déclaratif (décorateur, annotation) se prouve par un test de son effet observable, pas par sa présence dans le code.

**Principe dérivé / changement de standard**
Toute route publique sensible porte `@UseGuards(ClientIpThrottlerGuard)` + `@Throttle`, avec un test 429. À faire hors #15 : appliquer le garde à `/public/signup` (et `/auth/login`, `/auth/forgot-password`) après vérification de l'impact sur la QA.

### LESSON-2026-010 — Un analyseur d'impact partagé ne voit pas l'événement `workflow_run` (near miss)

- **Date** : 2026-10-02
- **Catégorie** : `ci-cd` · `release-deployment`
- **Statut** : prevention-added
- **Lié à** : branche `ci/adopt-appfactory-impact-and-project`, [docs/engineering/appfactory.md](appfactory.md), LESSON-2026-001

**Contexte**
Adoption de l'Impact-Aware CI AppFactory. Il paraissait naturel de brancher aussi `deploy.yml` sur la même analyse pour n'avoir qu'une politique de chemins.

**Échec / near miss**
Le code de l'analyseur (`resolveRange`) ne lit que les payloads `pull_request` et `push`. Sur `workflow_run`, qui déclenche `deploy.yml`, il ne trouve pas de plage et applique le fallback `all`. Un payload simulé l'a confirmé avant tout changement. Branché tel quel, chaque succès de CI, même pour un commit de docs, aurait reconstruit les deux images et redéployé la prod (30 à 60 s de coupure).

**Cause racine**
Une brique partagée était supposée correcte pour notre type d'événement sans que son contrat d'entrée ait été vérifié. C'est le même angle mort que LESSON-2026-001, avec la conséquence inverse (tout déployer au lieu de ne rien déployer).

**Résolution**
`deploy.yml` garde sa détection explicite (`git diff HEAD^1 HEAD`), et l'exception est documentée. L'Impact-Aware CI ne pilote que `ci.yml` et `ux-guardrails.yml` (événements `push` et `pull_request`, que l'analyseur gère).

**Prévention**
Avant de brancher une analyse de changements sur un workflow, l'exécuter localement avec un payload de l'événement réel et sur des commits merge, squash et docs seules (tableau dans `appfactory.md`). Le commentaire dans `deploy.yml` rappelle l'exception.

**Leçon généralisée**
Une brique partagée de détection de changements doit être validée pour **chaque type d'événement** qui l'appelle, pas seulement pour la stratégie de fusion.

**Principe dérivé / changement de standard**
Proposition pour AppFactory : prendre en charge `workflow_run` (ou une plage explicite documentée), et échouer au lieu de tout déclencher quand l'appelant exige une plage.

### LESSON-2026-011 — Un déploiement en file d'attente peut être évincé et ne jamais partir (near miss)

- **Date** : 2026-10-02
- **Catégorie** : `ci-cd` · `release-deployment`
- **Statut** : prevention-added
- **Lié à** : `.github/workflows/deploy.yml`, LESSON-2026-001, LESSON-2026-010

**Contexte**
`deploy.yml` se déclenchait après chaque CI verte sur `main`, avec `concurrency: atelier-maitre-production` (`cancel-in-progress: false`) et une détection des images à reconstruire limitée au dernier commit (`git diff HEAD^1 HEAD`). Trois PR mergées en quelques minutes = deux coupures de prod.

**Échec / near miss**
En analysant la contrainte « une coupure par merge », constat que GitHub ne garde **qu'un seul run en attente** par groupe de concurrence : un run plus récent remplace le run en attente. Si un merge touchant l'API attend pendant un déploiement et qu'un merge de docs arrive, le run de l'API est évincé ; celui des docs ne voit que son propre commit et ne déploie rien. Workflow vert, prod en retard — le symptôme de LESSON-2026-001. Aucun cas observé en prod.

**Cause racine**
Décision « quoi déployer » prise sur un commit isolé, alors que la file d'attente ne garantit pas que chaque commit aura son run.

**Résolution**
Déploiement à la release : le job `Release gate` ne laisse passer que le commit de release (`version.txt` modifié) ou un Run workflow, et le déploiement reconstruit **tout** (plus de regex de chemins, donc plus de fichiers oubliés). Les runs ordinaires prennent un groupe de concurrence à eux : ils ne peuvent pas évincer un déploiement de release en attente.

**Prévention**
Le groupe de concurrence de `deploy.yml` est dynamique (commentaire en tête du fichier) ; gate rejoué sur des commits réels (release 1.9.0 → déploie ; merges #45 et #47 → ne déploient pas). Résumé « Release gate » explicite dans chaque run, pour qu'un « rien déployé » ne passe jamais pour un succès silencieux.

**Leçon généralisée**
Avec une file de concurrence GitHub, un run en attente n'est pas garanti : ne jamais faire dépendre ce qui est livré du seul commit du run. Soit on livre l'état complet de la cible, soit on compare au dernier état réellement livré.

**Principe dérivé / changement de standard**
Les déploiements de prod sont déclenchés par une release (version explicite), pas par chaque merge.

### LESSON-2026-012 — Deux paiements confirmés en même temps : un mois payé perdu (near miss)

- **Date** : 2026-10-02
- **Catégorie** : `concurrency` · `billing`
- **Statut** : prevention-added
- **Lié à** : `src/modules/subscription/payments/subscription-payments.service.ts` (#41)

**Contexte**
Le webhook NotchPay prolonge l'abonnement : il lit `tenants.subscriptionEndsAt`, ajoute une période, puis écrit. L'idempotence couvrait le **même** événement reçu deux fois (empreinte unique + mise à jour conditionnelle).

**Échec / near miss**
Relu avant la mise en service : deux paiements **différents** du même atelier (double clic, deux onglets, mensuel puis annuel) confirmés en même temps lisent la même échéance dans deux transactions (READ COMMITTED) ; chacune écrit « échéance + 1 mois ». Le client paie deux fois et reçoit un mois. Aucun cas en prod (paiements encore en sandbox).

**Cause racine**
Lecture-modification-écriture sur une ligne partagée sans verrou : l'idempotence par événement ne protège pas des écritures concurrentes d'événements distincts.

**Résolution**
`SELECT … FROM tenants WHERE id = $1 FOR UPDATE` dans la transaction, avant de lire l'échéance : la seconde transaction attend la première et part de la nouvelle échéance.

**Prévention**
Test de concurrence simulée (`adds up two different payments confirmed at the same time`) : deux webhooks en parallèle sur une ligne partagée avec verrou exclusif ; contre-épreuve faite (sans verrou : 2026-12-01 au lieu de 2027-01-01). Test d'ordre : le verrou précède la lecture.

**Leçon généralisée**
L'idempotence (même message deux fois) et la sérialisation (messages différents sur la même ressource) sont deux problèmes distincts : toute écriture « lire puis cumuler » sur une ligne partagée prend un verrou de ligne ou se fait en une seule instruction SQL atomique.

**Principe dérivé / changement de standard**
Revue des handlers de webhook / jobs : pour chaque ressource modifiée, vérifier « que se passe-t-il si deux événements différents arrivent en même temps ? ».

