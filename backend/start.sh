#!/usr/bin/env bash
set -e

python manage.py migrate --noinput
python manage.py collectstatic --noinput

if [ -n "${BOOTSTRAP_ADMIN_USERNAME:-}" ] && [ -n "${BOOTSTRAP_ADMIN_PASSWORD:-}" ]; then
  echo "Ensuring bootstrap admin user exists..."
  bootstrap_args=(
    --username "$BOOTSTRAP_ADMIN_USERNAME"
    --password "$BOOTSTRAP_ADMIN_PASSWORD"
    --role admin
    --superuser
  )

  [ -n "${BOOTSTRAP_ADMIN_EMAIL:-}" ] && bootstrap_args+=(--email "$BOOTSTRAP_ADMIN_EMAIL")
  [ -n "${BOOTSTRAP_ADMIN_FIRST_NAME:-}" ] && bootstrap_args+=(--first-name "$BOOTSTRAP_ADMIN_FIRST_NAME")
  [ -n "${BOOTSTRAP_ADMIN_LAST_NAME:-}" ] && bootstrap_args+=(--last-name "$BOOTSTRAP_ADMIN_LAST_NAME")
  [ -n "${BOOTSTRAP_ADMIN_PHONE:-}" ] && bootstrap_args+=(--phone "$BOOTSTRAP_ADMIN_PHONE")
  [ -n "${BOOTSTRAP_ADMIN_JOB_TITLE:-}" ] && bootstrap_args+=(--job-title "$BOOTSTRAP_ADMIN_JOB_TITLE")
  [ -n "${BOOTSTRAP_ADMIN_MAILBOX_PASSWORD:-}" ] && bootstrap_args+=(--mailbox-password "$BOOTSTRAP_ADMIN_MAILBOX_PASSWORD")

  python manage.py ensure_staff_user "${bootstrap_args[@]}"
fi

gunicorn config.wsgi:application --bind "0.0.0.0:${PORT:-8000}"
