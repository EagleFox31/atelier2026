#!/usr/bin/env bash
# Deploie Atelier 2026 sur une VM (Oracle ou autre) via SSH + Docker Compose.
# Usage : ./deploy/scripts/remote-deploy.sh ubuntu@IP_PUBLIQUE
# Prerequis : deploy/.env.prod rempli, cle SSH, Docker installe sur la VM (cloud-init OCI)

set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Usage: $0 user@host"
  exit 1
fi

REMOTE="$1"
REMOTE_DIR="/opt/atelier2026"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

if [ ! -f "$ROOT/deploy/.env.prod" ]; then
  echo "Erreur: deploy/.env.prod manquant."
  echo "  cp deploy/.env.prod.example deploy/.env.prod"
  exit 1
fi

echo "==> Sync code vers $REMOTE:$REMOTE_DIR"
ssh "$REMOTE" "sudo mkdir -p $REMOTE_DIR && sudo chown \$(whoami):\$(whoami) $REMOTE_DIR"

rsync -avz --delete \
  --exclude node_modules \
  --exclude .next \
  --exclude dist \
  --exclude .git \
  --exclude .stryker-tmp \
  --exclude deploy/.env.prod \
  "$ROOT/" "$REMOTE:$REMOTE_DIR/"

echo "==> Copie deploy/.env.prod (secrets)"
scp "$ROOT/deploy/.env.prod" "$REMOTE:$REMOTE_DIR/deploy/.env.prod"

echo "==> Build + demarrage Docker (ARM64 natif sur Oracle Ampere)"
ssh "$REMOTE" "cd $REMOTE_DIR && docker compose -f deploy/docker/docker-compose.prod.yml --env-file deploy/.env.prod up -d --build"

echo "==> Statut des conteneurs"
ssh "$REMOTE" "cd $REMOTE_DIR && docker compose -f deploy/docker/docker-compose.prod.yml ps"

IP="${REMOTE#*@}"
echo ""
echo "Deploy termine. Ouvrir : http://${IP}"
echo "Logs API : ssh $REMOTE 'cd $REMOTE_DIR && docker compose -f deploy/docker/docker-compose.prod.yml logs -f api'"
