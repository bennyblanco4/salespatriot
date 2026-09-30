#!/usr/bin/env bash
# Create a Heroku build from the current git commit and wait until it releases.
# Requires HEROKU_API_KEY and HEROKU_APP_NAME. Prints no credentials.
set -euo pipefail

if [[ -z "${HEROKU_API_KEY:-}" ]]; then
  echo "::error::Add the HEROKU_API_KEY repository secret (Heroku account API key). Do not commit it."
  exit 1
fi

if [[ -z "${HEROKU_APP_NAME:-}" ]]; then
  echo "::error::Add the HEROKU_APP_NAME repository variable, or a secret of the same name, with the existing Heroku app name."
  exit 1
fi

if ! [[ "$HEROKU_APP_NAME" =~ ^[a-z][a-z0-9-]{1,28}[a-z0-9]$ ]]; then
  echo "::error::HEROKU_APP_NAME must be a Heroku app name: 3–30 characters, starting with a letter, using only lowercase letters, numbers, and hyphens."
  exit 1
fi

if [[ -z "${GITHUB_SHA:-}" ]]; then
  GITHUB_SHA="$(git rev-parse HEAD)"
fi

api() {
  local method="$1"
  local path="$2"
  local data="${3:-}"
  local body
  local code
  body="$(mktemp)"
  if [[ -n "$data" ]]; then
    code="$(
      curl -sS -o "$body" -w '%{http_code}' -X "$method" \
        "https://api.heroku.com${path}" \
        -H 'Accept: application/vnd.heroku+json; version=3' \
        -H "Authorization: Bearer ${HEROKU_API_KEY}" \
        -H 'Content-Type: application/json' \
        --data "$data"
    )"
  else
    code="$(
      curl -sS -o "$body" -w '%{http_code}' -X "$method" \
        "https://api.heroku.com${path}" \
        -H 'Accept: application/vnd.heroku+json; version=3' \
        -H "Authorization: Bearer ${HEROKU_API_KEY}"
    )"
  fi

  if [[ "$code" -lt 200 || "$code" -ge 300 ]]; then
    local message
    message="$(jq -r '.message // empty' "$body" 2>/dev/null || true)"
    echo "::error::Heroku API ${method} ${path} returned HTTP ${code}.${message:+ ${message}}" >&2
    if [[ "$code" == "401" || "$code" == "403" ]]; then
      echo "Check that HEROKU_API_KEY is a current account API key with access to ${HEROKU_APP_NAME}." >&2
    elif [[ "$code" == "404" ]]; then
      echo "Check that HEROKU_APP_NAME is an existing app this API key can deploy." >&2
    fi
    rm -f "$body"
    exit 1
  fi

  cat "$body"
  rm -f "$body"
}

archive="$(mktemp --suffix=.tar.gz)"
trap 'rm -f "$archive"' EXIT

git archive --format=tar.gz --output "$archive" HEAD

source_json="$(api POST "/apps/${HEROKU_APP_NAME}/sources")"
put_url="$(jq -r '.source_blob.put_url // empty' <<<"$source_json")"
get_url="$(jq -r '.source_blob.get_url // empty' <<<"$source_json")"
if [[ "$put_url" != https://* || "$get_url" != https://* ]]; then
  echo "::error::Heroku did not return source upload URLs for ${HEROKU_APP_NAME}."
  exit 1
fi

curl -fsS -X PUT -H 'Content-Type:' --data-binary @"$archive" "$put_url" >/dev/null

payload="$(jq -n --arg url "$get_url" --arg version "$GITHUB_SHA" '{source_blob:{url:$url, version:$version}}')"
build_json="$(api POST "/apps/${HEROKU_APP_NAME}/builds" "$payload")"
build_id="$(jq -r '.id // empty' <<<"$build_json")"
output_url="$(jq -r '.output_stream_url // empty' <<<"$build_json")"

if ! [[ "$build_id" =~ ^[0-9a-fA-F-]{36}$ ]]; then
  echo "::error::Heroku did not return a build id."
  exit 1
fi

echo "Heroku build ${build_id} started for ${GITHUB_SHA}."

if [[ -n "$output_url" ]]; then
  # Heartbeat chunks are NUL bytes and are not build output.
  curl -fsS -N --max-time 1800 "$output_url" | tr -d '\000' || true
fi

for _ in $(seq 1 60); do
  status="$(api GET "/apps/${HEROKU_APP_NAME}/builds/${build_id}" | jq -r '.status')"
  case "$status" in
    successful | succeeded)
      echo "Heroku build ${build_id} released ${GITHUB_SHA}."
      exit 0
      ;;
    failed)
      echo "::error::Heroku build ${build_id} failed."
      exit 1
      ;;
    pending)
      sleep 10
      ;;
    *)
      echo "::error::Unexpected Heroku build status: ${status}"
      exit 1
      ;;
  esac
done

echo "::error::Timed out waiting for Heroku build ${build_id}."
exit 1
