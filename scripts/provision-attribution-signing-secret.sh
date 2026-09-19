#!/usr/bin/env bash
set -euo pipefail

KEY="AGENTRESOLVER_ATTRIBUTION_SIGNING_SECRET"
TARGET="production"

if [ "${ALLOW_ATTRIBUTION_SECRET_PROVISION:-}" != "1" ]; then
  echo "Refusing attribution signer provisioning: set ALLOW_ATTRIBUTION_SECRET_PROVISION=1 for an explicitly authorized release."
  exit 2
fi

for name in VERCEL_TOKEN VERCEL_ORG_ID VERCEL_PROJECT_ID; do
  if [ -z "${!name:-}" ]; then
    echo "Missing required environment variable: $name"
    exit 2
  fi
done

command -v vercel >/dev/null 2>&1 || {
  echo "Vercel CLI is required."
  exit 2
}
command -v openssl >/dev/null 2>&1 || {
  echo "OpenSSL is required."
  exit 2
}

tmp="$(mktemp -d)"
cleanup() {
  rm -rf "$tmp"
}
trap cleanup EXIT

mkdir -p "$tmp/.vercel"
printf '{"orgId":"%s","projectId":"%s"}\n'   "$VERCEL_ORG_ID" "$VERCEL_PROJECT_ID" > "$tmp/.vercel/project.json"

env_list="$(
  cd "$tmp"
  vercel env ls "$TARGET" --token="$VERCEL_TOKEN" --no-color 2>&1
)"

if printf '%s\n' "$env_list" | awk '{print $1}' | grep -Fx "$KEY" >/dev/null; then
  echo "$KEY already exists for $TARGET; leaving it unchanged."
  exit 0
fi

secret="$(openssl rand -hex 32)"
if [ "${#secret}" -lt 64 ]; then
  echo "Failed to generate a sufficiently strong attribution signing secret."
  secret=""
  unset secret
  exit 1
fi

(
  cd "$tmp"
  printf '%s' "$secret" |
    vercel env add "$KEY" "$TARGET" --sensitive --token="$VERCEL_TOKEN" --no-color >/tmp/agentresolver-vercel-env-add.out
)

secret=""
unset secret

if ! grep -Eqi 'added|created|success' /tmp/agentresolver-vercel-env-add.out; then
  echo "Vercel CLI did not confirm attribution signer provisioning."
  cat /tmp/agentresolver-vercel-env-add.out
  rm -f /tmp/agentresolver-vercel-env-add.out
  exit 1
fi

rm -f /tmp/agentresolver-vercel-env-add.out
echo "$KEY provisioned as a fresh sensitive $TARGET variable. Redeploy is required before runtime signing becomes active."
