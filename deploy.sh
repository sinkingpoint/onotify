#!/bin/env bash

set -euox pipefail

d1_database=$(npx wrangler d1 list --json | jq -r '.[] | select(.name=="onotify") | .uuid' || echo "")
if [ -z "$d1_database" ]; then
  echo "Creating D1 database..."
  npx wrangler d1 create onotify
  d1_database=$(npx wrangler d1 list --json | jq -r '.[] | select(.name=="onotify") | .uuid' || echo "")
fi

# Update wrangler.toml with the database ID
if ! grep -q "database_id = \"$d1_database\"" wrangler.toml; then
  echo "Updating wrangler.toml with database ID $d1_database"
  sed -i.bak "s/database_id = \".*\"/database_id = \"$d1_database\"/" wrangler.toml
fi

echo "What Cloudflare Zone should we deploy the backend to?"
read -r zone_name

if ! grep -q "zone_name = \"$zone_name\"" wrangler.toml; then
  echo "Updating wrangler.toml with zone name $zone_name"
  sed -i.bak "s/zone_name = \".*\"/zone_name = \"$zone_name\"/" wrangler.toml
fi

echo "What route should we deploy the backend to? (e.g. api.example.com or example.com/api/)"
read -r pattern

if ! grep -q "pattern = \"$pattern/*\"" wrangler.toml; then
  echo "Updating wrangler.toml with route pattern $pattern"
  sed -i.bak "s;pattern = \".*\";pattern = \"$pattern\/*\";" wrangler.toml
fi

Deploy the database
for script in sql/*; do
  echo "Running DB script $script"
  npx wrangler d1 execute onotify --remote --file $script
done

echo "Deploying the backend..."
npm run deploy

echo "What route should we deploy the frontend to? (e.g. example.com)"
read -r pattern

echo "Deploying the frontend..."
cd ui/ && npm run deploy --env BASE_URL="$pattern" --env MODE="production" --route "$pattern/*"

