#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="tiimeliines"
DEPLOY_ACCOUNT="timelineswebapp@gmail.com"
REGION="us-central1"
RUNTIME_SA="timelines-runtime@${PROJECT_ID}.iam.gserviceaccount.com"
TASKS_SA="timelines-tasks-invoker@${PROJECT_ID}.iam.gserviceaccount.com"
SCHEDULER_SA="timelines-scheduler@${PROJECT_ID}.iam.gserviceaccount.com"
ARCHIVE_BUCKET="${PROJECT_ID}-institutional-archive"
ACTIVE_CORPUS_ID="${ACTIVE_CORPUS_ID:-}"
PUBLIC_ID_BASE="${PUBLIC_ID_BASE:-}"

if [[ ! "${ACTIVE_CORPUS_ID}" =~ ^[a-z0-9][a-z0-9-]{2,62}$ ]]; then
  echo "Refusing deployment: set ACTIVE_CORPUS_ID to the activated clean corpus identifier." >&2
  exit 1
fi
if [[ ! "${PUBLIC_ID_BASE}" =~ ^[0-9]+$ ]] || (( PUBLIC_ID_BASE < 1000000000 )); then
  echo "Refusing deployment: set PUBLIC_ID_BASE to the reserved clean-corpus numeric ID base." >&2
  exit 1
fi

active_project="$(gcloud config get-value project 2>/dev/null)"
if [[ "${active_project}" != "${PROJECT_ID}" ]]; then
  echo "Refusing deployment: active project is ${active_project}, expected ${PROJECT_ID}." >&2
  exit 1
fi
active_account="$(gcloud auth list --filter=status:ACTIVE --format='value(account)')"
if [[ "${active_account}" != "${DEPLOY_ACCOUNT}" ]]; then
  echo "Refusing deployment: active account is ${active_account}, expected ${DEPLOY_ACCOUNT}." >&2
  exit 1
fi

npm --prefix functions ci
npm --prefix functions test
npm --prefix functions run typecheck
npm --prefix functions run build

ensure_service_account() {
  local account_id="$1"
  local display_name="$2"
  if ! gcloud iam service-accounts describe "${account_id}@${PROJECT_ID}.iam.gserviceaccount.com" --project="${PROJECT_ID}" >/dev/null 2>&1; then
    gcloud iam service-accounts create "${account_id}" --display-name="${display_name}" --project="${PROJECT_ID}"
  fi
}

ensure_project_role() {
  local member="$1"
  local role="$2"
  gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
    --member="${member}" \
    --role="${role}" \
    --condition=None \
    --quiet >/dev/null
}

ensure_secret() {
  local secret_name="$1"
  if ! gcloud secrets describe "${secret_name}" --project="${PROJECT_ID}" >/dev/null 2>&1; then
    gcloud secrets create "${secret_name}" --replication-policy=automatic --project="${PROJECT_ID}"
  fi
  if [[ -n "$(gcloud secrets versions list "${secret_name}" --project="${PROJECT_ID}" --filter='state:ENABLED' --limit=1 --format='value(name)')" ]]; then
    return
  fi
  local secret_file
  secret_file="$(mktemp)"
  chmod 600 "${secret_file}"
  openssl rand -base64 48 >"${secret_file}"
  gcloud secrets versions add "${secret_name}" --data-file="${secret_file}" --project="${PROJECT_ID}" >/dev/null
  rm -f "${secret_file}"
}

ensure_queue() {
  local queue="$1"
  local rate="$2"
  local concurrency="$3"
  if gcloud tasks queues describe "${queue}" --location="${REGION}" --project="${PROJECT_ID}" >/dev/null 2>&1; then
    gcloud tasks queues update "${queue}" --location="${REGION}" --project="${PROJECT_ID}" \
      --max-dispatches-per-second="${rate}" --max-concurrent-dispatches="${concurrency}" \
      --max-attempts=5 --min-backoff=30s --max-backoff=900s --max-doublings=5 >/dev/null
  else
    gcloud tasks queues create "${queue}" --location="${REGION}" --project="${PROJECT_ID}" \
      --max-dispatches-per-second="${rate}" --max-concurrent-dispatches="${concurrency}" \
      --max-attempts=5 --min-backoff=30s --max-backoff=900s --max-doublings=5 >/dev/null
  fi
}

deploy_function() {
  local name="$1"
  local entry_point="$2"
  local timeout="$3"
  local memory="$4"
  local concurrency="$5"
  local max_instances="$6"
  shift 6
  gcloud functions deploy "${name}" \
    --gen2 \
    --runtime=nodejs22 \
    --region="${REGION}" \
    --project="${PROJECT_ID}" \
    --source=functions \
    --entry-point="${entry_point}" \
    --trigger-http \
    --service-account="${RUNTIME_SA}" \
    --timeout="${timeout}" \
    --memory="${memory}" \
    --cpu=1 \
    --concurrency="${concurrency}" \
    --max-instances="${max_instances}" \
    --set-env-vars="GOOGLE_CLOUD_PROJECT=${PROJECT_ID},FUNCTION_REGION=${REGION},VERTEX_LOCATION=global,VERTEX_MODEL=gemini-2.5-flash,TASK_INVOKER_EMAIL=${TASKS_SA},ACTIVE_CORPUS_ID=${ACTIVE_CORPUS_ID},PUBLIC_ID_BASE=${PUBLIC_ID_BASE}" \
    "$@" \
    --quiet
}

ensure_service_account "timelines-runtime" "TiMELiNES serverless runtime"
ensure_service_account "timelines-tasks-invoker" "TiMELiNES Cloud Tasks invoker"
ensure_service_account "timelines-scheduler" "TiMELiNES Cloud Scheduler invoker"

for role in roles/datastore.user roles/aiplatform.user roles/cloudtasks.enqueuer roles/logging.logWriter roles/secretmanager.secretAccessor; do
  ensure_project_role "serviceAccount:${RUNTIME_SA}" "${role}"
done
gcloud iam service-accounts add-iam-policy-binding "${TASKS_SA}" --project="${PROJECT_ID}" \
  --member="serviceAccount:${RUNTIME_SA}" --role=roles/iam.serviceAccountUser --quiet >/dev/null

ensure_secret IP_HASH_SALT
ensure_secret BACKEND_SHARED_SECRET

ensure_queue priority-topic-generation 5 5
ensure_queue autonomous-topic-generation 1 2
ensure_queue institutional-transitions 10 10

if ! gcloud storage buckets describe "gs://${ARCHIVE_BUCKET}" --project="${PROJECT_ID}" >/dev/null 2>&1; then
  gcloud storage buckets create "gs://${ARCHIVE_BUCKET}" --project="${PROJECT_ID}" --location=us \
    --uniform-bucket-level-access --public-access-prevention
fi
gcloud storage buckets update "gs://${ARCHIVE_BUCKET}" --versioning --retention-period=1y --quiet >/dev/null

firebase deploy --only firestore:rules,firestore:indexes --project "${PROJECT_ID}" --account "${DEPLOY_ACCOUNT}" --non-interactive
gcloud firestore databases update --database='(default)' --project="${PROJECT_ID}" --enable-pitr --delete-protection --quiet >/dev/null

deploy_function timelines-public-api publicApi 60s 512Mi 80 20 \
  --set-secrets="IP_HASH_SALT=IP_HASH_SALT:latest,BACKEND_SHARED_SECRET=BACKEND_SHARED_SECRET:latest" \
  --allow-unauthenticated
deploy_function priority-topic-generation priorityTopicGeneration 1800s 1Gi 1 5 --no-allow-unauthenticated
deploy_function autonomous-topic-generation autonomousTopicGeneration 1800s 1Gi 1 2 --no-allow-unauthenticated
deploy_function institutional-transitions institutionalTransitions 900s 1Gi 10 10 --no-allow-unauthenticated
deploy_function topic-discovery topicDiscovery 900s 1Gi 1 1 --no-allow-unauthenticated

for service in priority-topic-generation autonomous-topic-generation institutional-transitions; do
  gcloud run services add-iam-policy-binding "${service}" --region="${REGION}" --project="${PROJECT_ID}" \
    --member="serviceAccount:${TASKS_SA}" --role=roles/run.invoker --quiet >/dev/null
done
gcloud run services add-iam-policy-binding topic-discovery --region="${REGION}" --project="${PROJECT_ID}" \
  --member="serviceAccount:${SCHEDULER_SA}" --role=roles/run.invoker --quiet >/dev/null

DISCOVERY_URL="https://${REGION}-${PROJECT_ID}.cloudfunctions.net/topic-discovery"
if gcloud scheduler jobs describe topic-discovery-daily --location="${REGION}" --project="${PROJECT_ID}" >/dev/null 2>&1; then
  gcloud scheduler jobs update http topic-discovery-daily --location="${REGION}" --project="${PROJECT_ID}" \
    --schedule="0 3 * * *" --time-zone=UTC --uri="${DISCOVERY_URL}" --http-method=POST \
    --oidc-service-account-email="${SCHEDULER_SA}" --oidc-token-audience="${DISCOVERY_URL}" \
    --headers="X-CloudScheduler=true,Content-Type=application/json" --message-body='{}' --quiet
else
  gcloud scheduler jobs create http topic-discovery-daily --location="${REGION}" --project="${PROJECT_ID}" \
    --schedule="0 3 * * *" --time-zone=UTC --uri="${DISCOVERY_URL}" --http-method=POST \
    --oidc-service-account-email="${SCHEDULER_SA}" --oidc-token-audience="${DISCOVERY_URL}" \
    --headers="X-CloudScheduler=true,Content-Type=application/json" --message-body='{}' --quiet
fi

echo "TiMELiNES serverless infrastructure deployed to ${PROJECT_ID}/${REGION}."
