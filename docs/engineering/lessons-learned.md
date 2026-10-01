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

**Principe dérivé / changement de standard**
—

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
