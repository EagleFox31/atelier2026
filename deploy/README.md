# Déploiement — Atelier Maître

Le déploiement de production cible AWS EC2 et reste piloté depuis ce dépôt.

## Flux CI/CD

Un push sur `main` déclenche la CI. Après succès, le workflow `Deploy AWS` :

1. applique `infra/aws/atelier-maitre.yml` avec CloudFormation ;
2. construit uniquement les images API/Web modifiées et les pousse dans GHCR ;
3. déploie le commit exact sur EC2 avec AWS Systems Manager ;
4. valide la santé de l'API.

Il n'y a ni IP codée en dur, ni clé SSH, ni identifiant AWS permanent dans GitHub. Les secrets applicatifs restent chiffrés dans AWS Systems Manager Parameter Store.

Le guide de première installation est dans [`infra/aws/README.md`](../infra/aws/README.md).

## Fichiers de production

- `infra/aws/bootstrap-github-oidc.yml` : bootstrap manuel unique de la confiance GitHub/AWS ;
- `infra/aws/atelier-maitre.yml` : VPC, EC2, réseau, IAM, stockage et Session Manager ;
- `.github/workflows/deploy.yml` : provisionnement, build GHCR et déploiement ;
- `deploy/docker/docker-compose.aws.yml` : Caddy, Web, API et Redis ;
- `deploy/scripts/aws-ssm-deploy.sh` : récupération sécurisée des paramètres et redémarrage.

L'ancien `docker-compose.prod.yml` reste disponible pour un serveur autonome avec PostgreSQL local. Sur la petite instance AWS, la variante `docker-compose.aws.yml` utilise Supabase afin d'économiser la mémoire.
