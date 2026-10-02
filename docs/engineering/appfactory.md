# Briques AppFactory adoptées

Atelier Maître réutilise des capacités partagées de
[EagleFox31/appfactory-project-automation](https://github.com/EagleFox31/appfactory-project-automation)
au lieu de les reconstruire (RAIDER — Reuse-first).

| Besoin | Décision | Fichiers | Runtime épinglé |
|--------|----------|----------|-----------------|
| Versioning / releases | **Adopt** (déjà en place) | `.github/workflows/release.yml` | `reusable-release.yml@v1` (= v1.3.0, `247ee8c`), comme le recommande AppFactory pour les releases |
| CI proportionnelle au changement | **Adopt** | `.github/appfactory-impact.json`, `ci.yml`, `ux-guardrails.yml` | `reusable-impact-analysis.yml@20c6b99` (main, **pas encore de tag**) |
| Board GitHub Project | **Adopt** | `.github/project-config.json`, `project-automation.yml` | `reusable-project-automation.yml@b1deb7b` (main, hors release) |
| Check agrégé « CI result » | **Build** (petit) | `ci.yml` | AppFactory ne fournit pas de check agrégé pour les jobs sautés |
| Lint des workflows | **Adopt** (actionlint 1.7.12, somme SHA-256 vérifiée) | `ci.yml` | — |
| Déploiement AWS | **Exception** : détection explicite conservée | `deploy.yml` | voir plus bas |

Mettre à jour un épinglage : relire le diff AppFactory entre l'ancien et le nouveau SHA, puis changer **les deux** valeurs (`uses: …@SHA` et `appfactory_ref: SHA`). Quand l'Impact-Aware CI sera publiée dans une release, remplacer `20c6b99` par le SHA de ce tag.

## Impact-Aware CI

`fichiers modifiés → surfaces (.github/appfactory-impact.json) → gates → jobs`

- `ci.yml` : job `Analyse d'impact`, puis `Type-check & Tests` (gates `typecheck` / `unit-tests`), `Lint des workflows` (gate `workflow-lint`) et **`CI result`**.
- `ux-guardrails.yml` : même analyse, Playwright seulement si gate `ux-guardrails`.
- Fallback `all` : chemin non classé, nouveau push de branche ou plage introuvable ⇒ tous les gates.
- Lancement manuel de CI ou UX guardrails ⇒ mode `all` (validation complète). Un lancement manuel de CI sur `main` **ne redéploie pas** (garde dans `deploy.yml`).

Résultats vérifiés localement avec l'analyseur AppFactory (`scripts/impact/analyze.mjs` @ `20c6b99`) sur de vrais commits :

| Commit | Type | Gates |
|--------|------|-------|
| `7ba0f86` | merge PR #25 (front + e2e-qa) | `typecheck`, `ux-guardrails` |
| `2439703` | merge PR #24 (front, `.dockerignore`, docs, legacy) | `typecheck`, `ux-guardrails` |
| `a61fb06` | squash (api + web + `package.json` + `qa-ux.yml`) | `workflow-lint`, `typecheck`, `unit-tests`, `ux-guardrails` |
| `d63094f` | docs seules | aucun (no-op) |

### Checks obligatoires

`main` n'a pas de protection de branche aujourd'hui. Si on en ajoute une, rendre obligatoire **`CI result`** (et, si voulu, `Playwright UX guardrails`). Un job sauté parce que hors périmètre compte comme réussi ; un filtre `paths:` au niveau du workflow, lui, laisserait le check en attente — c'est pourquoi `ux-guardrails.yml` n'en a plus.

### Exception RAIDER : `deploy.yml` garde sa propre détection

`deploy.yml` tourne sur `workflow_run` (après CI sur `main`). L'analyseur AppFactory (`resolveRange`) ne connaît que les événements `pull_request` (base/head) et `push` (`before`/`after`). Un payload `workflow_run` n'a ni l'un ni l'autre, et l'analyseur répond `event-without-comparable-range`, donc **fallback all**. Testé localement avec un payload `workflow_run` simulé : chaque succès de CI, même pour un commit de docs, reconstruirait les deux images et redéploierait (30 à 60 s de coupure).

On pourrait passer `base_sha: <sha>^1` : l'analyseur ferait alors le même `git diff` qu'aujourd'hui, avec les mêmes fichiers sur les quatre commits ci-dessus. Mais cela détourne une entrée documentée comme « SHA », sur un workflow pas encore publié et sans consommateur validé. LESSON-2026-001 (déploiement vert qui ne déployait rien) justifie de ne pas changer le chemin de production sur cette base. La détection explicite `git diff HEAD^1 HEAD` reste donc en place, et ses ensembles de chemins doivent rester alignés avec la carte d'impact.

À reprendre quand AppFactory gérera `workflow_run` (ou une plage explicite documentée) et qu'une release le contiendra.

## Project automation (zéro PAT)

Le workflow ne s'active qu'après les étapes ci-dessous. Avant elles, un événement Issue/PR après le merge échoue côté broker (fail-closed) sans rien modifier.

**Mise en service unique (propriétaire `EagleFox31`) :**

1. Merger la PR qui ajoute `project-automation.yml` et `project-config.json`.
2. Autoriser l'OAuth App AppFactory **une fois pour le compte** : <https://appfactory-project-token-broker.lawrynnjennifer.workers.dev/authorize>. L'autorisation est valable pour tous les dépôts publics du compte : si elle a déjà été faite pour AgenStart ou AgenFetch, il n'y a rien à refaire.
3. Ne créer **aucun** secret `PROJECT_TOKEN`. La variable `APPFACTORY_PROJECT_BROKER_URL` est facultative : sans elle, le workflow utilise l'URL du broker hébergé.
4. Bootstrap : *Actions → Project automation → Run workflow*, `issue_number` vide. Cela crée ou réconcilie le Project « Atelier Maître Product Development », le lie au dépôt, crée les champs (Status, Priority, Work type, Phase, Size) et la vue « AppFactory Board », puis importe les Issues ouvertes dans `Backlog`.
5. Vérifier l'idempotence : relancer le même bootstrap, qui ne doit créer ni doublon ni nouveau Project. Puis modifier une Issue et vérifier que sa carte est mise à jour.
6. Facultatif : renseigner Priority/Size sur le board, dans `issueOverrides`, ou par un bloc `<!-- appfactory-project … -->` dans le corps de l'Issue.

**Limites connues** :
- seuls les événements déclenchés par le propriétaire sont pris en charge par le broker. Ceux d'un contributeur ou d'un bot échouent : resynchroniser l'Issue avec `issue_number` ;
- le runtime `b1deb7b` figure dans la liste blanche du broker (`ALLOWED_JOB_WORKFLOW_REFS`), alors que la doc AppFactory cite encore `14d5116`. Si le broker le refuse, revenir à `14d5116` (seule différence : la clé de concurrence).

Phases (`bootstrap.phases`) : Fondations, Pilote SaaS, Monétisation, Messagerie client, Espaces multi-garages, Qualité, Exploitation. Le type de travail est déduit du préfixe Conventional Commits du titre (`feat(` → Feature, `fix(` → Bug, `test(` → Quality, `ops(`/`ci(`/`chore(` → Engineering…).

## Limites amont relevées (AppFactory @ `20c6b99`)

Ces limites font toutes déclencher plus de gates que nécessaire, jamais moins :
- `git diff` sans `core.quotepath=off` : un chemin non ASCII (ex. `public/landing/gérant_garage.jpg`) sort entre guillemets, n'est pas reconnu et déclenche le fallback `all` ;
- `**` ne couvre pas les fichiers commençant par un point (`matchesGlob`) : il faut un motif explicite (`deploy/legacy/**/.*`) ;
- sur une PR, le diff est `base.sha..head.sha` (deux points) : si `main` a avancé, ses changements comptent aussi ;
- l'étape « Publish impact summary » met des backticks dans des guillemets doubles. Les valeurs sont exécutées comme commandes, et le résumé s'affiche vide (les sorties du job restent correctes).
