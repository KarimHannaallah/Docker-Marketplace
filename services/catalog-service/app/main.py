"""Point d'entrée FastAPI : uvicorn app.main:app"""

import logging
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI
from sqlalchemy import text

from app.database import get_session_factory
from app.routers import categories, products
from app.seed import seed_if_empty

logger = logging.getLogger("catalog-service")


def init_data(attempts: int = 15) -> None:
    """Attend la base (elle peut démarrer après nous) puis insère les données de démo."""
    for i in range(1, attempts + 1):
        try:
            with get_session_factory()() as db:
                db.execute(text("SELECT 1"))
                if seed_if_empty(db):
                    logger.warning("Données de démonstration insérées")
            return
        except Exception:
            if i == attempts:
                raise
            logger.warning("Base indisponible, nouvel essai (%d/%d)...", i, attempts)
            time.sleep(2)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    init_data()
    yield


def create_app(run_startup: bool = True) -> FastAPI:
    app = FastAPI(title="catalog-service", lifespan=lifespan if run_startup else None)

    @app.get("/health")
    def health():
        return {"status": "ok", "service": "catalog-service"}

    app.include_router(categories.router)
    app.include_router(products.router)
    return app


app = create_app()
