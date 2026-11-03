#!/usr/bin/env bash
# Rebuild and redeploy REM Content Studio (backend -> Cloud Run, frontend -> Cloudflare Pages).
# Usage: deploy/redeploy.sh [backend|frontend|all]   (default: all)
# Needs: docker (running), gcloud (logged in), npx wrangler (logged in). See DEPLOYMENT.md.
set -euo pipefail
cd "$(dirname "$0")/.."

PROJECT=rem-content-studio-11035946
REGION=australia-southeast1
SERVICE=rem-api
REPO=$REGION-docker.pkg.dev/$PROJECT/rem
PAGES_PROJECT=rem-content-studio
API_URL=https://rem-api-154218404779.australia-southeast1.run.app
TARGET=${1:-all}

if [[ $TARGET == backend || $TARGET == all ]]; then
  IMG=$REPO/rem-api:$(git rev-parse --short HEAD)-$(date +%Y%m%d%H%M)
  echo "==> Building $IMG (linux/amd64 for Cloud Run)"
  docker build --platform linux/amd64 -t "$IMG" backend
  # Pushes from Docker Desktop sometimes drop mid-upload; retry a few times.
  for i in 1 2 3 4; do docker push "$IMG" && break; echo "push failed (try $i), retrying"; sleep 5; done
  echo "==> Deploying $SERVICE"
  gcloud run deploy "$SERVICE" --image="$IMG" --region="$REGION" --project="$PROJECT" \
    --service-account="rem-api@$PROJECT.iam.gserviceaccount.com" \
    --allow-unauthenticated --port=8000 --cpu=1 --memory=512Mi \
    --min-instances=0 --max-instances=1 --concurrency=40 --timeout=300 \
    --env-vars-file=deploy/cloudrun.env.yaml \
    --set-secrets=CF_API_TOKEN=cf-api-token:latest,DEMO_PASSWORD=demo-password:latest
fi

if [[ $TARGET == frontend || $TARGET == all ]]; then
  echo "==> Building frontend against $API_URL"
  VITE_API_URL=$API_URL npm run build
  VITE_API_URL=$API_URL node scripts/write-headers.mjs
  echo "==> Deploying to Cloudflare Pages ($PAGES_PROJECT)"
  npx wrangler pages deploy dist --project-name="$PAGES_PROJECT" --branch=main --commit-dirty=true
fi

echo "==> Health: $(curl -s $API_URL/api/health)"
