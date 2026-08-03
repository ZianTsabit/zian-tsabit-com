FROM python:3.12-slim

# Nothing here should write .pyc into a bind-mounted source tree, and unbuffered
# output means `docker compose logs` shows tracebacks as they happen.
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# Its own layer, so a source edit does not reinstall Django.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY --chmod=755 entrypoint.sh /usr/local/bin/entrypoint.sh
COPY . .

# UID 1000 matches the first user account on a typical Linux host, so the
# bind-mounted db.sqlite3 stays writable. Override with `user:` in compose if
# `id -u` on your machine says otherwise, or migrate will fail on a read-only
# database.
RUN useradd --uid 1000 --create-home --shell /bin/bash app \
    && chown -R app:app /app
USER app

EXPOSE 8000

# Applies migrations, then runs whatever CMD asks for.
ENTRYPOINT ["entrypoint.sh"]
CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]
