#!/usr/bin/env bash
set -Eeuo pipefail

APP_ROOT="${APP_ROOT:-/opt/atelier-maitre/repo}"
ENV_PARAMETER="${ENV_PARAMETER:-/atelier-maitre/prod/env}"
GHCR_TOKEN_PARAMETER="${GHCR_TOKEN_PARAMETER:-/atelier-maitre/prod/ghcr-token}"
GHCR_USERNAME="${GHCR_USERNAME:-EagleFox31}"
COMPOSE_FILE="deploy/docker/docker-compose.aws.yml"
ENV_FILE="deploy/.env.aws"

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

docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" config --quiet
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" pull
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d --remove-orphans
# Le Caddyfile est monté en bind : un changement de contenu ne recrée pas le
# conteneur. Rechargement à chaud, sans coupure, pour appliquer la config du commit.
# Quelques essais : si Caddy vient d'être recréé, son API d'admin démarre à peine.
caddy_reloaded=false
for attempt in 1 2 3 4 5; do
  if docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T caddy \
    caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile; then
    caddy_reloaded=true
    break
  fi
  echo "Caddy reload failed ($attempt/5), retrying..."
  sleep 2
done
if [ "$caddy_reloaded" != true ]; then
  echo "Caddy reload failed: the previous Caddy config is still active." >&2
  exit 1
fi
docker image prune -f

healthy=false
for attempt in $(seq 1 30); do
  if curl --fail --silent --show-error http://127.0.0.1/api/health >/dev/null; then
    healthy=true
    break
  fi
  echo "Waiting for the API health check ($attempt/30)..."
  sleep 10
done

if [ "$healthy" != true ]; then
  docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" logs --no-log-prefix --tail=150 api
  exit 1
fi

docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" ps
echo "Atelier Maitre deployment is healthy."
