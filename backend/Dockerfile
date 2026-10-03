FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Drop root. Render, Fly, Railway and Cloud Run all ignore this, but a
# container that gets a shell shouldn't get root in it.
RUN useradd --create-home --uid 10001 appuser && chown -R appuser:appuser /app
USER appuser

EXPOSE 8080

# Railway only restarts a container on its own probe, and a container that
# hangs without exiting keeps the port open and looks alive. /health answers
# from the process itself, so a wedged process fails the check rather than
# serving stale data until someone notices. Defaults to 8000 to match the CMD
# below, since a bare os.environ["PORT"] raises here if the host sets none.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD python -c "import os,urllib.request,sys; \
sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:'+os.environ.get('PORT','8000')+'/health', timeout=4).status==200 else 1)"

# exec so uvicorn becomes PID 1 and receives SIGTERM directly. Without it
# uvicorn is a child of the shell, the signal goes to the shell, and the
# lifespan shutdown never runs -- so the APScheduler job is never stopped and
# a scrape mid-flight is killed rather than finished.
CMD ["sh", "-c", "exec uvicorn api:app --host 0.0.0.0 --port ${PORT:-8000}"]
