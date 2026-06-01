#!/bin/sh
set -e
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"
exec docker compose \
  -f deploy/docker/docker-compose.prod.yml \
  --env-file deploy/.env.prod \
  "$@"
