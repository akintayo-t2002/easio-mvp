"""Helpers for interacting with Supabase Vault via the Supabase async client."""

from __future__ import annotations

import asyncio
import logging
import ssl
from datetime import datetime, timezone
from typing import Any, Optional, Tuple

from postgrest.exceptions import APIError as PostgrestAPIError
from supabase import AsyncClient, create_async_client

from ..config import Settings


class VaultError(RuntimeError):
    """Raised when Vault operations fail."""


logger = logging.getLogger(__name__)

_CLIENT_CACHE: dict[tuple[str, str], AsyncClient] = {}
_CLIENT_LOCK = asyncio.Lock()


async def _get_client(settings: Settings) -> AsyncClient:
    """Return a cached Supabase async client."""
    url = (settings.supabase_url or "").strip()
    key = (settings.supabase_key or "").strip()
    if not url or not key:
        raise VaultError("Supabase credentials are not configured")

    cache_key = (url, key)
    client = _CLIENT_CACHE.get(cache_key)
    if client is not None:
        return client

    async with _CLIENT_LOCK:
        client = _CLIENT_CACHE.get(cache_key)
        if client is None:
            client = await create_async_client(url, key)
            _CLIENT_CACHE[cache_key] = client
    return client


def _extract_string(data: Any, expected_key: str) -> Optional[str]:
    """Best-effort extraction of a string payload from Supabase RPC responses."""
    if isinstance(data, str):
        return data
    if isinstance(data, dict):
        if expected_key in data and isinstance(data[expected_key], str):
            return data[expected_key]
        if len(data) == 1:
            value = next(iter(data.values()))
            if isinstance(value, str):
                return value
            if isinstance(value, (list, dict)):
                return _extract_string(value, expected_key)
    if isinstance(data, list):
        for item in data:
            value = _extract_string(item, expected_key)
            if value:
                return value
    return None


def _format_rpc_error(function_name: str, exc: Exception) -> str:
    if isinstance(exc, PostgrestAPIError):
        try:
            payload_source = exc.json  # type: ignore[attr-defined]
            payload = payload_source() if callable(payload_source) else payload_source
        except Exception:  # noqa: BLE001 - defensive
            payload = {}
        if not isinstance(payload, dict):
            payload = {}
        parts = [payload.get("message") or "PostgREST error"]
        code = payload.get("code")
        details = payload.get("details")
        hint = payload.get("hint")
        if code:
            parts.append(f"code={code}")
        if details:
            parts.append(details)
        if hint:
            parts.append(f"hint={hint}")
        return f"Vault RPC {function_name} failed: {'; '.join(parts)}"
    return f"Vault RPC {function_name} failed: {exc}"


async def _rpc(settings: Settings, function_name: str, params: Optional[dict[str, Any]] = None) -> Any:
    client = await _get_client(settings)
    last_ssl_error: Optional[ssl.SSLError] = None
    for attempt in range(1, 4):
        try:
            response = await client.rpc(function_name, params or {}).execute()
            return response.data
        except ssl.SSLError as exc:
            last_ssl_error = exc
            if attempt == 3:
                raise VaultError(_format_rpc_error(function_name, exc)) from exc
            await asyncio.sleep(0.1 * attempt)
        except Exception as exc:  # noqa: BLE001 - wrap all client errors
            raise VaultError(_format_rpc_error(function_name, exc)) from exc
    if last_ssl_error is not None:
        raise VaultError(_format_rpc_error(function_name, last_ssl_error)) from last_ssl_error
    raise VaultError(f"Vault RPC {function_name} failed for unknown reasons")


async def create_secret(
    settings: Settings,
    *,
    name: str,
    secret: str,
    description: Optional[str] = None,
) -> Tuple[str, datetime]:
    """Create a secret in Supabase Vault using the async wrapper function."""
    payload: dict[str, Any] = {"secret": secret, "name": name}
    if description:
        payload["description"] = description

    data = await _rpc(settings, "vault_create_secret", payload)
    secret_id = _extract_string(data, "vault_create_secret")
    if not secret_id:
        raise VaultError("Vault did not return a secret id")
    return secret_id, datetime.now(timezone.utc)


async def update_secret(
    settings: Settings,
    *,
    secret_id: str,
    secret: str,
    description: Optional[str] = None,
) -> Tuple[str, datetime]:
    """Update a secret in Supabase Vault using the async wrapper function."""
    payload: dict[str, Any] = {"secret_id": secret_id, "secret": secret}
    if description:
        payload["description"] = description

    await _rpc(settings, "vault_update_secret", payload)
    return secret_id, datetime.now(timezone.utc) 


async def delete_secret(settings: Settings, *, secret_id: str) -> None:
    """Delete a secret from Supabase Vault using the async wrapper function.

    This operation is intentionally idempotent: if the secret has already been
    removed or Supabase returns a non-auth error, the exception is logged and
    suppressed so cleanup flows (e.g., disconnect) can proceed. Authentication
    or permission errors still raise ``VaultError`` so callers can react.
    """
    try:
        await _rpc(settings, "vault_delete_secret", {"secret_id": secret_id})
    except VaultError as exc:
        message = str(exc).lower()
        if any(token in message for token in ("permission", "auth", "unauthor", "apikey")):
            raise
        logger.warning("Supabase Vault delete failed: %s", exc)


async def get_secret(settings: Settings, *, secret_id: str) -> str:
    """Retrieve a decrypted secret from Supabase Vault using the async wrapper function."""
    data = await _rpc(settings, "vault_get_secret", {"secret_id": secret_id})
    secret_value = _extract_string(data, "vault_get_secret")
    if not isinstance(secret_value, str) or not secret_value:
        raise VaultError("Vault did not return a valid secret value")
    return secret_value
