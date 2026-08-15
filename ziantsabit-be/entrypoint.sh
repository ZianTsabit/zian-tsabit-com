#!/bin/sh
# Migrations run on every start: the API 500s on its first request against a
# database without myapp_post, and a fresh container has no other chance to
# create it.
set -e

python manage.py migrate --noinput

# WhiteNoise's manifest storage cannot resolve a {% static %} tag until this has
# run, so it runs on every start rather than only in production -- an unstyled
# /admin/ is the mild failure, a ValueError on the missing manifest is the loud
# one. It is idempotent and takes about a second.
python manage.py collectstatic --noinput --clear

# exec, so the server is PID 1 and Ctrl-C / `docker compose stop` reaches it
# instead of being swallowed by this script.
exec "$@"
