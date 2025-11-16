"""Shared helpers for persisting integration credentials."""

from __future__ import annotations

from datetime import datetime
from typing import Optional, Tuple
from uuid import UUID, uuid4

from ..config import get_settings
from ..services.vault import VaultError, create_secret, update_secret


class IntegrationSecretError(RuntimeError):
    """Raised when integration secrets cannot be persisted."""


async def persist_secret_value(
    *,
    organization_id: UUID,
    provider: str,
    secret_kind: str,
    secret_value: str,
    existing_secret_id: Optional[str | UUID],
    description: Optional[str] = None,
) -> Tuple[str, datetime]:
    if not isinstance(secret_value, str) or not secret_value:
        raise IntegrationSecretError(f"Missing {provider} {secret_kind} value")

    settings = get_settings()
    secret_id: Optional[str]
    if isinstance(existing_secret_id, UUID):
        secret_id = str(existing_secret_id)
    else:
        secret_id = existing_secret_id

    if secret_id:
        try:
            _, updated_at = await update_secret(
                settings,
                secret_id=secret_id,
                secret=secret_value,
                description=description,
            )
            return secret_id, updated_at
        except VaultError as exc:
            raise IntegrationSecretError(
                f"Unable to update {provider} {secret_kind} secret"
            ) from exc

    slug = provider.replace(".", "-")
    secret_name = f"{slug}-{secret_kind}-{organization_id}-{uuid4()}"
    secret_description = description or f"{provider.capitalize()} {secret_kind} token for org {organization_id}"
    try:
        return await create_secret(
            settings,
            name=secret_name,
            secret=secret_value,
            description=secret_description,
        )
    except VaultError as exc:
        raise IntegrationSecretError(
            f"Unable to store {provider} {secret_kind} secret"
        ) from exc


async def persist_access_token_secret(
    *,
    organization_id: UUID,
    provider: str,
    access_token: str,
    existing_secret_id: Optional[str | UUID],
) -> Tuple[str, datetime]:
    description = f"{provider.capitalize()} access token for org {organization_id}"
    return await persist_secret_value(
        organization_id=organization_id,
        provider=provider,
        secret_kind="access",
        secret_value=access_token,
        existing_secret_id=existing_secret_id,
        description=description,
    )


async def persist_refresh_token_secret(
    *,
    organization_id: UUID,
    provider: str,
    refresh_token: str,
    existing_secret_id: Optional[str | UUID],
) -> Tuple[str, datetime]:
    description = f"{provider.capitalize()} refresh token for org {organization_id}"
    return await persist_secret_value(
        organization_id=organization_id,
        provider=provider,
        secret_kind="refresh",
        secret_value=refresh_token,
        existing_secret_id=existing_secret_id,
        description=description,
    )
