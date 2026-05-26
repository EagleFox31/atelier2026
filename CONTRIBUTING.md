# Guide de contribution — Atelier 2026

Ce projet est propriétaire. Les contributions sont réservées aux collaborateurs autorisés.

## Prérequis

- Node.js 20+
- PostgreSQL via Supabase
- Redis (pour BullMQ)
- Accès aux variables d'environnement (voir `.env.example`)

## Démarrage

```bash
npm install
cp .env.example .env   # remplir les valeurs
npm run migrate        # appliquer les migrations
npx prisma db seed     # données initiales
npm run dev            # lance NestJS (3001) + Next.js (3005)
```

## Workflow

1. Créer une branche depuis `main` : `git checkout -b feat/ma-fonctionnalite`
2. Coder + tester
3. `npm run type:check` — zéro erreur TypeScript obligatoire avant PR
4. Ouvrir une Pull Request vers `main`
5. Review requise avant merge

## Conventions

- **Commits** : `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`
- **Branches** : `feat/`, `fix/`, `chore/`
- Ne jamais commiter `.env` ou tout fichier contenant des secrets
- Croiser les DTOs avec `prisma/schema.prisma` avant tout ajout de champ

## Architecture

Voir [`docs/comprendre-l-app-101.md`](docs/comprendre-l-app-101.md) pour les leçons apprises et les pièges à éviter.
