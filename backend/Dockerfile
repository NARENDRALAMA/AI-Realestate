FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    # SQLite lives in /tmp: on Cloud Run it is in-memory and is lost on every
    # container restart (acceptable for this prototype; see DEPLOYMENT.md).
    DB_PATH=/tmp/propcopy.db \
    PORT=8000

WORKDIR /app

COPY requirements.txt .
RUN pip install --upgrade "pip==26.3" "setuptools>=83" && pip install -r requirements.txt

# Run as an unprivileged user; only uploads/ needs to be writable.
RUN useradd --create-home --uid 10001 app && mkdir -p /app/uploads && chown app:app /app/uploads
COPY --chown=root:root . .
USER app

EXPOSE 8000

# Cloud Run tells the container which port to listen on through $PORT.
CMD ["sh", "-c", "exec uvicorn main:app --host 0.0.0.0 --port ${PORT} --no-server-header"]
