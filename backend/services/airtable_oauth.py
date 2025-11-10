"""Helpers for Airtable OAuth flows."""

from __future__ import annotations

from typing import Dict, Iterable, Optional
from urllib.parse import urlencode

import aiohttp

from ..config import Settings


AUTH_URL = "https://airtable.com/oauth2/v1/authorize"
TOKEN_URL = "https://airtable.com/oauth2/v1/token"


class AirtableOAuthError(RuntimeError):
    """Raised when an Airtable OAuth interaction fails."""


def _require_config(settings: Settings) -> None:
    if not settings.airtable_client_id or not settings.airtable_redirect_uri:
        raise AirtableOAuthError("Airtable OAuth client configuration is missing")


def build_authorize_url(
    *,
    settings: Settings,
    state: str,
    scopes: Iterable[str],
    prompt: Optional[str] = None,
    code_challenge: Optional[str] = None,
    code_challenge_method: Optional[str] = None,
) -> str:
    """Construct the Airtable authorization URL."""

    _require_config(settings)
    scope_param = " ".join(scopes)
    query = {
        "client_id": settings.airtable_client_id,
        "redirect_uri": settings.airtable_redirect_uri,
        "response_type": "code",
        "state": state,
        "scope": scope_param,
    }
    if prompt:
        query["prompt"] = prompt
    if code_challenge:
        query["code_challenge"] = code_challenge
    if code_challenge_method:
        query["code_challenge_method"] = code_challenge_method
    return f"{AUTH_URL}?{urlencode(query)}"


async def exchange_code_for_tokens(
    *, code: str, code_verifier: str, settings: Settings
) -> Dict[str, object]:
    """Exchange an authorization code for access and refresh tokens."""

    _require_config(settings)
    if not settings.airtable_client_secret:
        raise AirtableOAuthError("Airtable client secret is not configured")

    payload = {
        "grant_type": "authorization_code",
        "code": code,
        "redirect_uri": settings.airtable_redirect_uri,
        "client_id": settings.airtable_client_id,
        "code_verifier": code_verifier,
    }

    timeout = aiohttp.ClientTimeout(total=10.0)
    async with aiohttp.ClientSession(timeout=timeout) as session:
        auth = aiohttp.BasicAuth(settings.airtable_client_id, settings.airtable_client_secret)
        async with session.post(TOKEN_URL, data=payload, auth=auth) as response:
            text = await response.text()
            if response.status != 200:
                raise AirtableOAuthError(
                    f"Failed to exchange authorization code (status {response.status}): {text}"
                )
            return await response.json()


async def refresh_access_token(*, refresh_token: str, settings: Settings) -> Dict[str, object]:
    """Refresh an Airtable access token using a stored refresh token."""

    _require_config(settings)
    if not settings.airtable_client_secret:
        raise AirtableOAuthError("Airtable client secret is not configured")

    payload = {
        "grant_type": "refresh_token",
        "refresh_token": refresh_token,
        "client_id": settings.airtable_client_id,
    }

    timeout = aiohttp.ClientTimeout(total=10.0)
    async with aiohttp.ClientSession(timeout=timeout) as session:
        auth = aiohttp.BasicAuth(settings.airtable_client_id, settings.airtable_client_secret)
        async with session.post(TOKEN_URL, data=payload, auth=auth) as response:
            text = await response.text()
            if response.status != 200:
                raise AirtableOAuthError(
                    f"Failed to refresh Airtable token (status {response.status}): {text}"
                )
            return await response.json()
