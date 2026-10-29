FROM python:3.12-slim

# Pas de fichiers .pyc, logs affichés immédiatement, pas de cache pip dans l'image.
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# Dépendances d'abord (couche mise en cache tant que requirements.txt ne change pas).
# On installe requirements.txt (production), pas requirements-dev.txt (pytest, ruff).
COPY requirements.txt ./
RUN pip install -r requirements.txt

COPY app ./app

# Utilisateur sans privilèges : on évite de tourner en root.
RUN useradd --system --uid 10001 --no-create-home appuser
USER 10001

EXPOSE 8000
HEALTHCHECK --interval=10s --timeout=3s --start-period=15s --retries=5 \
  CMD ["python", "-c", "import urllib.request; urllib.request.urlopen('http://localhost:8000/health', timeout=2)"]
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
