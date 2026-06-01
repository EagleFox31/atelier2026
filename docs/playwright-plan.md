# Plan Playwright — Atelier Maître

> Intégration E2E navigateur **sans modifier** Newman (`test:e2e`) ni Jest (`npm test`).
>
> Références : [Next.js — Playwright](https://nextjs.org/docs/app/guides/testing/playwright), [Playwright — webServer](https://playwright.dev/docs/test-webserver), [Playwright — auth setup](https://playwright.dev/docs/auth).

---

## 1. Objectif

Prouver automatiquement que l’**UI Next.js** fonctionne en conditions réelles :

- formulaire login → token → redirect dashboard ;
- routes protégées (redirect `/login` si non auth) ;
- smoke des pages branchées sur l’API.

Newman continue de couvrir **100 % de l’API** (122 assertions). Playwright ne remplace pas Newman : il complète la couche browser.

---

## 2. Pyramide de tests (état cible)

| Couche | Outil | Commande | Port / cible |
|--------|-------|----------|--------------|
| Unit / intégration backend | Jest | `npm test` | `src/**/*.spec.ts` |
| E2E API | Newman | `npm run test:e2e` | `http://localhost:3001/api` |
| E2E UI | Playwright | `npm run test:e2e:ui` | `http://localhost:3000` (+ proxy `/api` → 3001) |

**Règle d’or** : ne jamais renommer `test:e2e` (alias historique Newman).

---

## 3. Contraintes projet

| Élément | Valeur | Note |
|---------|--------|------|
| Next.js | `:3005` | `npm run dev:next` — Playwright `baseURL` |
| NestJS | `:3001` | requis pour login UI (rewrite `next.config.ts`) |
| Auth front | `localStorage` | clés `atelier_token`, `atelier_user` |
| Comptes test | seed Prisma | `admin@atelier.cm` / `Atelier2026!` |
| DB | Supabase | même `.env` que le dev |

Playwright **doit** lancer (ou réutiliser) **deux serveurs** : API puis Next.

---

## 4. Fichiers à ajouter (additive only)

```text
e2e/
  auth.setup.ts          # login admin → storageState
  login.spec.ts            # smoke login / erreur / redirect
  protected-routes.spec.ts # /workshop sans token → /login
  fixtures/
    users.ts               # identifiants seed (pas de secrets prod)

playwright/
  .auth/                   # sessions JSON (gitignored)

playwright.config.ts       # config centrale
docs/playwright-plan.md    # ce document
```

**Modifications limitées** :

- `package.json` — devDependency `@playwright/test` + scripts `test:e2e:ui*`
- `.gitignore` — `test-results/`, `playwright-report/`, `playwright/.auth/`
- `tsconfig.json` — optionnel : `"exclude": [..., "e2e"]` si conflit type-check

**Aucun changement** aux modules Nest, collection Postman, Jest config.

---

## 5. Configuration Playwright (esquisse)

### 5.1 Scripts npm (nouveaux)

```json
{
  "test:e2e:ui": "playwright test",
  "test:e2e:ui:headed": "playwright test --headed",
  "test:e2e:ui:debug": "playwright test --debug",
  "test:e2e:ui:report": "playwright show-report",
  "test:e2e:ui:install": "playwright install chromium"
}
```

### 5.2 Deux `webServer`

```typescript
webServer: [
  {
    name: 'API',
    command: 'npm run dev:api',
    url: 'http://localhost:3001/api/docs',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  {
    name: 'NEXT',
    command: 'npx next dev --port 3000',
    url: 'http://localhost:3000/login',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: { BACKEND_URL: 'http://localhost:3001' },
  },
],
use: {
  baseURL: 'http://localhost:3000',
  trace: 'on-first-retry',
  screenshot: 'only-on-failure',
},
```

- **Local** : si `npm run dev` tourne déjà → `reuseExistingServer: true` (pas de double démarrage).
- **CI** : les deux serveurs démarrent automatiquement.

### 5.3 Projets Playwright

| Project | Rôle |
|---------|------|
| `setup` | `auth.setup.ts` → `playwright/.auth/admin.json` |
| `chromium` | specs UI, `storageState` admin, `dependencies: ['setup']` |

Un seul navigateur en phase 1 (Chromium). Firefox/WebKit plus tard.

### 5.4 Locators (sans toucher l’app en phase 1)

Priorité Playwright :

1. `getByRole('button', { name: 'Se connecter' })`
2. `getByPlaceholder('admin@atelier.cm ou EMP-001')`
3. `getByRole('heading', …)`

Ajouter `data-testid` **uniquement** si un écran est instable — pas par défaut.

---

## 6. Phases d’implémentation

### Phase 0 — Bootstrap (~30 min)

- [ ] Installer `@playwright/test` + `playwright install chromium`
- [ ] Créer `playwright.config.ts`
- [ ] Mettre à jour `.gitignore`
- [ ] Ajouter scripts npm
- [ ] Vérifier régression : `npm test` et `npm run test:e2e` inchangés

**DoD** : config valide, zéro spec ou spec vide qui skip.

---

### Phase 1 — Smoke login (~1 h)

Fichier : `e2e/login.spec.ts`

| # | Scénario | Assertion |
|---|----------|-----------|
| 1.1 | Login admin valide | URL `/`, contenu dashboard visible |
| 1.2 | Mot de passe invalide | reste sur `/login`, message d’erreur |
| 1.3 | Accès `/workshop` sans auth | redirect `/login` |

**DoD** : `npm run test:e2e:ui` → 3 tests verts (serveurs auto ou déjà lancés).

---

### Phase 2 — Auth setup + pages protégées (~1 h)

- [ ] `e2e/auth.setup.ts` + project `setup`
- [ ] `e2e/protected-routes.spec.ts` : `/`, `/customers`, `/workshop`, `/billing` chargent sans crash (titre ou nav visible)

**DoD** : login une seule fois par run grâce à `storageState`.

---

### Phase 3 — Parcours métier UI (itérations)

Ordre suggéré (1 PR par parcours) :

1. Logout → retour `/login`
2. Clients : liste → fiche
3. Véhicules : liste → fiche
4. Atelier : liste OT → détail OT
5. Facturation : liste devis/factures (lecture seule)

Assertions **UI** légères ; logique métier / RBAC / transitions → Newman.

---

### Phase 4 — CI (quand pipeline GitHub existe)

- [ ] `CI=true npm run test:e2e:ui`
- [ ] `npx playwright install --with-deps chromium`
- [ ] Artefact `playwright-report` en cas d’échec
- [ ] Option prod : `next build && next start` au lieu de `next dev` (plus lent, plus fidèle)

---

## 7. Ce qu’on évite

| ❌ | ✅ |
|----|-----|
| Renommer `test:e2e` | `test:e2e:ui` pour Playwright |
| Specs Playwright dans `src/` | Dossier `e2e/` à la racine |
| `npm run dev` dans webServer (type-check + kill ports) | `dev:api` + `next dev --port 3000` |
| Reset DB avant chaque spec UI | Seed stable ; reset manuel si besoin |
| Dupliquer les 122 tests Postman en UI | Smokes + parcours critiques seulement |
| Mock `/api` dans Playwright | Vraie stack (comme Newman) |

---

## 8. Risques & mitigations

| Risque | Mitigation |
|--------|------------|
| Latence Supabase (2–23 s) | `timeout` test 60 s, webServer 120 s |
| Port doc obsolète (3005 vs 3000) | Config sur **3000** (`dev.mjs`) |
| Redis absent | Login OK ; sections dashboard optionnelles en assert |
| Flaky redirect auth | `waitForURL`, attendre fin chargement auth |
| Windows spawn | commandes npm séparées, pas de shell composite fragile |

---

## 9. Critères de succès (fin phase 2)

```bash
npm test                 # Jest — OK
npm run test:e2e         # Newman — 122/122
npm run test:e2e:ui      # Playwright — ≥ 5 specs vertes
```

---

## 10. Prochaine étape

Implémenter **Phase 0 + Phase 1** dans une PR isolée :

1. Install + config + gitignore + scripts  
2. `e2e/login.spec.ts` (3 scénarios)  
3. Aucune modification React sauf blocage locator

Estimation totale phases 0–2 : **~2–3 h**.
