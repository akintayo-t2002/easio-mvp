"""Shared helpers for OAuth providers."""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone
from typing import Optional, Sequence
from urllib.parse import urlparse
from uuid import UUID

from fastapi import HTTPException, status

from ..config import Settings
from ..repositories.oauth_state_repo import OAuthStateRepository

logger = logging.getLogger(__name__)


async def run_repo_call(func, *args, **kwargs):
    return await asyncio.to_thread(func, *args, **kwargs)


def normalize_origin(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    parsed = urlparse(value)
    if not parsed.scheme or not parsed.netloc:
        return None
    return f"{parsed.scheme.lower()}://{parsed.netloc.lower()}"


def allowed_origins(settings: Settings) -> set[str]:
    configured: Sequence[Optional[str]] = [settings.frontend_base_url, *settings.frontend_allowed_origins]
    origins = {
        normalize_origin(value.rstrip("/"))
        for value in configured
        if isinstance(value, str) and value.strip()
    }
    return {origin for origin in origins if origin}


def normalize_path_prefix(prefix: str) -> str:
    cleaned = prefix.strip()
    if not cleaned.startswith("/"):
        cleaned = f"/{cleaned}"
    if cleaned.endswith("/"):
        cleaned = cleaned.rstrip("/") or "/"
    return cleaned


def validate_redirect(redirect: str, settings: Settings) -> str:
    parsed_redirect = urlparse(redirect)
    if not parsed_redirect.scheme or not parsed_redirect.netloc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Redirect must be absolute")

    normalized_origin = f"{parsed_redirect.scheme.lower()}://{parsed_redirect.netloc.lower()}"
    if normalized_origin not in allowed_origins(settings):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Redirect origin not allowed")

    prefixes = [
        normalize_path_prefix(prefix)
        for prefix in settings.frontend_redirect_path_prefixes
        if isinstance(prefix, str) and prefix.strip()
    ]
    if prefixes:
        path = parsed_redirect.path or "/"
        if not any(path.startswith(prefix) for prefix in prefixes):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Redirect path not allowed")

    return normalized_origin


async def persist_state_nonce(
    *,
    repo: OAuthStateRepository,
    provider: str,
    nonce: str,
    organization_id: UUID,
    redirect_url: str,
    origin: str,
    code_verifier: str,
    expires_at: datetime,
) -> None:
    try:
        await repo.prune_expired()
        await repo.create_state(
            nonce=nonce,
            provider=provider,
            organization_id=str(organization_id),
            redirect_url=redirect_url,
            origin=origin,
            pkce_verifier=code_verifier,
            expires_at=expires_at,
        )
    except Exception as exc:  # pragma: no cover - defensive
        logger.exception(
            "Failed to persist OAuth state",
            extra={
                "provider": provider,
                "organization_id": str(organization_id),
                "nonce": nonce,
            },
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to initialize authorization",
        ) from exc


async def consume_state_nonce(
    *,
    repo: OAuthStateRepository,
    provider: str,
    nonce: str,
):
    try:
        record = await repo.consume_state(nonce=nonce, provider=provider)
    except Exception as exc:  # pragma: no cover - defensive
        logger.exception(
            "Failed to load OAuth state",
            extra={"provider": provider, "nonce": nonce},
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to validate authorization state",
        ) from exc

    if record is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="State has expired or been consumed")

    if record.expires_at <= datetime.now(timezone.utc):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="State token has expired")

    return record
