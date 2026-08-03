#!/bin/sh
# Migrations run on every start: the API 500s on its first request against a
# database without myapp_post, and a fresh container has no other chance to
# create it.
set -e

python manage.py migrate --noinput

# exec, so the server is PID 1 and Ctrl-C / `docker compose stop` reaches it
# instead of being swallowed by this script.
exec "$@"
