# Anciennes cibles de déploiement (archivées)

Ces configurations ne sont **plus utilisées**. La production tourne sur AWS : voir [`infra/aws/README.md`](../../infra/aws/README.md).

| Dossier | Cible | Contenu |
|---------|-------|---------|
| `oracle/` | Oracle Cloud Always Free (MVP, 2026-06) | Terraform OCI, `docker-compose.prod.yml`, scripts rsync/SSH, guide |
| `fly/` | Fly.io | `fly.api.toml`, `fly.web.toml` (anciennement à la racine), notes |
| `railway/` | Railway | `railway.toml` |

Ces fichiers n'ont pas été modifiés lors de l'archivage. Leurs chemins relatifs internes (ex. `./Caddyfile`, `../docker/Dockerfile.api`) pointent encore vers leur ancien emplacement : il faut les corriger avant toute réutilisation.

Les fichiers partagés avec la prod AWS sont restés dans `deploy/docker/` : `Caddyfile`, `Dockerfile.api`, `Dockerfile.web` et `api-entrypoint.sh`.
