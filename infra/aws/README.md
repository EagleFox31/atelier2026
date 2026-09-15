# Déploiement AWS — Atelier Maître

Cette configuration déploie Atelier Maître dans `eu-west-3` (Paris) avec :

- une instance EC2 `t3.micro` sous Ubuntu 24.04 ;
- une IP publique fixe, 20 Gio de stockage gp3 chiffré et 2 Gio de swap ;
- Caddy, Next.js, NestJS et Redis avec Docker Compose ;
- PostgreSQL hébergé sur Supabase ;
- AWS Systems Manager à la place de SSH ;
- GitHub Actions authentifié par OIDC, sans clé AWS permanente.

## Pourquoi deux templates ?

`bootstrap-github-oidc.yml` crée la relation de confiance entre AWS et le dépôt GitHub. Il doit être lancé manuellement une seule fois. Ensuite, `.github/workflows/deploy.yml` utilise `atelier-maitre.yml` pour créer ou mettre à jour toute l'infrastructure.

## 1. Déployer le bootstrap une fois

Dans AWS, garder la région **Europe (Paris) — `eu-west-3`**, puis ouvrir **CloudFormation → Créer une pile → Avec de nouvelles ressources**.

1. Charger `infra/aws/bootstrap-github-oidc.yml`.
2. Nommer la pile `atelier-maitre-bootstrap`.
3. Garder les paramètres par défaut : dépôt `EagleFox31/atelier2026`, identité immuable du même dépôt, branche `main`, pile applicative `atelier-maitre-prod`.
4. Cocher l'accusé de réception autorisant CloudFormation à créer des ressources IAM nommées.
5. Créer la pile et attendre l'état `CREATE_COMPLETE`.

Le bootstrap est volontairement séparé : une identité GitHub ne peut pas créer sa propre autorisation initiale.

> Le fournisseur OIDC GitHub est unique par compte AWS. Si un autre projet l'a déjà créé, retirer la ressource `GitHubOidcProvider` du template et remplacer la référence du rôle par l'ARN du fournisseur existant.

## 2. Ajouter les deux variables GitHub

Dans les **Sorties** de la pile `atelier-maitre-bootstrap`, copier les deux ARN. Dans le dépôt GitHub : **Settings → Secrets and variables → Actions → Variables**, créer :

- `AWS_DEPLOY_ROLE_ARN` avec la sortie `GitHubActionsRoleArn` ;
- `AWS_CLOUDFORMATION_ROLE_ARN` avec la sortie `CloudFormationExecutionRoleArn`.

Ce sont des identifiants de rôles, pas des mots de passe. Aucun `AWS_ACCESS_KEY_ID` ni `AWS_SECRET_ACCESS_KEY` n'est nécessaire.

## 3. Stocker les secrets applicatifs dans Parameter Store

Dans **AWS Systems Manager → Parameter Store**, région `eu-west-3`, créer deux paramètres **SecureString** :

### `/atelier-maitre/prod/env`

Valeur multiligne à adapter :

```dotenv
DATABASE_URL=postgresql://postgres.PROJECT:PASSWORD@POOLER_HOST:5432/postgres?sslmode=require
DIRECT_URL=postgresql://postgres.PROJECT:PASSWORD@POOLER_HOST:5432/postgres?sslmode=require
JWT_SECRET=UNE_LONGUE_VALEUR_ALEATOIRE
ALLOWED_ORIGINS=http://IP_PUBLIQUE
APP_DOMAIN=
ACME_EMAIL=VOTRE_EMAIL
PUBLIC_SIGNUP_ENABLED=true
SIGNUP_ALLOW_IF_ADMIN_EXISTS=false
```

Dans Supabase, ouvrir **Connect → Session pooler** et copier exactement l'hôte et le nom d'utilisateur proposés. EC2 est un backend persistant sur un réseau IPv4 ; le pooler de session sur le port `5432` est donc adapté au runtime et aux commandes d'initialisation. Ne pas reconstruire le nom d'hôte depuis la région.

Au premier passage, `ALLOWED_ORIGINS` peut utiliser l'IP affichée dans les sorties de la pile applicative. Après branchement du domaine, remplacer cette valeur par `https://votre-domaine` et renseigner `APP_DOMAIN`.

### `/atelier-maitre/prod/ghcr-token`

Valeur : un token GitHub classique limité au droit `read:packages`, utilisé seulement par EC2 pour télécharger les images privées GHCR.

L'instance peut lire uniquement les paramètres sous `/atelier-maitre/prod/`. Leur valeur n'est jamais envoyée dans GitHub Actions ou dans une commande SSM.

## 4. Lancer le déploiement

Une fois le bootstrap et les paramètres prêts, fusionner la PR dans `main`. Le workflow :

1. attend que la CI réussisse ;
2. crée ou met à jour la pile `atelier-maitre-prod` ;
3. construit les images modifiées et les publie dans GHCR ;
4. demande à Systems Manager de déployer le commit exact ;
5. vérifie `http://127.0.0.1/api/health` sur le serveur.

Le workflow peut aussi être relancé avec **Actions → Deploy AWS → Run workflow**.

## Exploitation

- Terminal : **Systems Manager → Session Manager → Démarrer une session**. Aucun port SSH n'est exposé.
- Logs du bootstrap EC2 : `/var/log/cloud-init-output.log`.
- État des conteneurs : `cd /opt/atelier-maitre/repo && docker compose -f deploy/docker/docker-compose.aws.yml --env-file deploy/.env.aws ps`.
- Logs API : même commande avec `logs --tail=150 api`.
- Montée en capacité : changer `InstanceType=t3.micro` en `t3.small` dans le workflow puis relancer. Cela augmente le coût.

## Coûts à surveiller

Le crédit AWS couvre la consommation, mais il ne bloque pas les dépenses. EC2, le volume gp3 et l'IPv4 publique sont facturés. Garder le budget et les alertes actifs, et supprimer la pile `atelier-maitre-prod` quand le serveur n'est plus nécessaire.
