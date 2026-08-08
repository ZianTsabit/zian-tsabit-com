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

# The database is Postgres now, reached over the network rather than a
# bind-mounted file, so nothing here needs write access to the host's copy of
# the source tree -- this is just standard non-root hygiene.
RUN useradd --uid 1000 --create-home --shell /bin/bash app \
    && chown -R app:app /app
USER app

EXPOSE 8000

# Applies migrations, then runs whatever CMD asks for.
ENTRYPOINT ["entrypoint.sh"]
CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]
