from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import routes
from .oauth.routes import router as airtable_oauth_router
from .oauth.gmail import router as gmail_oauth_router


def create_app() -> FastAPI:
    app = FastAPI(title="Voice Agent Platform API")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "http://localhost:5173",
            "http://localhost:5174",
            "http://localhost:5175",
        ],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(routes.router, prefix="/api")
    app.include_router(airtable_oauth_router, prefix="/api")
    app.include_router(gmail_oauth_router, prefix="/api")

    return app
