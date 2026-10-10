#!/usr/bin/env bash
set -Eeuo pipefail

APP_ROOT="${APP_ROOT:-/opt/atelier-maitre/repo}"
ENV_PARAMETER="${ENV_PARAMETER:-/atelier-maitre/prod/env}"
GHCR_TOKEN_PARAMETER="${GHCR_TOKEN_PARAMETER:-/atelier-maitre/prod/ghcr-token}"
GHCR_USERNAME="${GHCR_USERNAME:-EagleFox31}"
COMPOSE_FILE="deploy/docker/docker-compose.aws.yml"
ENV_FILE="deploy/.env.aws"
# Posés par deploy.yml : tag immuable des images (sha-<commit>) et commit attendu
# dans /api/health. Absents (lancement à la main) : images latest, pas de contrôle.
export IMAGE_TAG="${IMAGE_TAG:-latest}"
EXPECTED_COMMIT="${EXPECTED_COMMIT:-}"

cd "$APP_ROOT"

umask 077
aws ssm get-parameter \
  --name "$ENV_PARAMETER" \
  --with-decryption \
  --query 'Parameter.Value' \
  --output text > "$ENV_FILE.tmp"
mv "$ENV_FILE.tmp" "$ENV_FILE"

if grep -Eq '@postgres([:/?]|$)' "$ENV_FILE"; then
  echo "DATABASE_URL still targets the local 'postgres' service, which is not started on AWS." >&2
  echo "Use the Supabase pooler URL in the Parameter Store environment value." >&2
  exit 1
fi

ghcr_token=$(aws ssm get-parameter \
  --name "$GHCR_TOKEN_PARAMETER" \
  --with-decryption \
  --query 'Parameter.Value' \
  --output text)
printf '%s' "$ghcr_token" | docker login ghcr.io -u "$GHCR_USERNAME" --password-stdin
unset ghcr_token

compose() {
  docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" "$@"
}

# Attend /api/health ; avec un commit en argument, exige aussi ce commit servi.
# Laisse la dernière réponse dans $health.
health=""
wait_healthy() {
  local expected="${1:-}"
  for attempt in $(seq 1 30); do
    if health=$(curl --fail --silent --show-error http://127.0.0.1/api/health); then
      if [ -z "$expected" ] || printf '%s' "$health" | grep -q "\"commit\":\"$expected\""; then
        return 0
      fi
      echo "API healthy but serving another commit ($attempt/30): $health"
    else
      echo "Waiting for the API health check ($attempt/30)..."
    fi
    sleep 10
  done
  return 1
}

# Images en service avant le déploiement, épinglées par leur identifiant : en cas
# d'échec, on y revient (tag local « rollback »). Aucune si l'instance est neuve.
PREVIOUS_IMAGES=()
for service in api web; do
  container=$(compose ps -q "$service" 2>/dev/null || true)
  if [ -n "$container" ]; then
    PREVIOUS_IMAGES+=("$service=$(docker inspect --format '{{.Image}}' "$container")")
  fi
done

# Retour arrière vers les images précédentes, puis échec du déploiement. Les
# migrations déjà appliquées restent (elles sont additives : l'ancien code les tolère).
rollback_and_fail() {
  echo "Deployment failed: $1" >&2
  compose logs --no-log-prefix --tail=150 api >&2 || true
  if [ "${#PREVIOUS_IMAGES[@]}" -ne 2 ]; then
    echo "No previous api/web images to roll back to: new containers left running." >&2
    exit 1
  fi
  for entry in "${PREVIOUS_IMAGES[@]}"; do
    docker tag "${entry#*=}" "ghcr.io/eaglefox31/atelier2026-${entry%%=*}:rollback"
  done
  if IMAGE_TAG=rollback compose up -d --remove-orphans && wait_healthy; then
    echo "ROLLED_BACK=$health" >&2
    echo "Rolled back to the previous images (healthy)." >&2
  else
    echo "Rollback did not become healthy: manual intervention required." >&2
  fi
  exit 1
}

compose config --quiet
compose pull
compose up -d --remove-orphans
# Le Caddyfile est monté en bind : un changement de contenu ne recrée pas le
# conteneur. Rechargement à chaud, sans coupure, pour appliquer la config du commit.
# Quelques essais : si Caddy vient d'être recréé, son API d'admin démarre à peine.
caddy_reloaded=false
for attempt in 1 2 3 4 5; do
  if compose exec -T caddy caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile; then
    caddy_reloaded=true
    break
  fi
  echo "Caddy reload failed ($attempt/5), retrying..."
  sleep 2
done
if [ "$caddy_reloaded" != true ]; then
  rollback_and_fail "Caddy reload failed (previous Caddy config still active)"
fi

if ! wait_healthy "$EXPECTED_COMMIT"; then
  rollback_and_fail "expected commit ${EXPECTED_COMMIT:-any}, last health: ${health:-none}"
fi

# Nettoyage seulement après vérification : avant, il effacerait les images du
# retour arrière. -a : les images sha-<commit> précédentes restent taguées et
# s'accumuleraient. Sortie écartée : SSM tronque la sortie standard.
docker image prune -af >/dev/null

compose ps
echo "Atelier Maitre deployment is healthy."
# Ligne lue par deploy.yml pour le résumé du run (version effectivement servie).
echo "DEPLOYED_HEALTH=$health"
