"""Helpers for Gmail OAuth authorization code flow."""

from __future__ import annotations

from typing import Iterable, Optional
from urllib.parse import urlencode

import aiohttp

from ..config import Settings

AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
TOKEN_URL = "https://oauth2.googleapis.com/token"
USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo"


class GmailOAuthError(RuntimeError):
    """Raised when a Gmail OAuth interaction fails."""


def _require_config(settings: Settings) -> None:
    if not settings.gmail_client_id or not settings.gmail_redirect_uri:
        raise GmailOAuthError("Gmail OAuth client configuration is missing")


def build_authorize_url(
    *,
    settings: Settings,
    state: str,
    scopes: Iterable[str],
    code_challenge: Optional[str] = None,
    code_challenge_method: Optional[str] = None,
    include_granted_scopes: bool = True,
) -> str:
    """Construct the Gmail authorization URL."""

    _require_config(settings)
    scope_param = " ".join(scopes)
    query = {
        "client_id": settings.gmail_client_id,
        "redirect_uri": settings.gmail_redirect_uri,
        "response_type": "code",
        "scope": scope_param,
        "state": state,
        "access_type": "offline",
        "prompt": "consent",
    }
    if include_granted_scopes:
        query["include_granted_scopes"] = "true"
    if code_challenge:
        query["code_challenge"] = code_challenge
    if code_challenge_method:
        query["code_challenge_method"] = code_challenge_method
    return f"{AUTH_URL}?{urlencode(query)}"


async def exchange_code_for_tokens(
    *,
    code: str,
    code_verifier: Optional[str],
    settings: Settings,
) -> dict[str, object]:
    """Exchange an authorization code for tokens."""

    _require_config(settings)
    if not settings.gmail_client_secret:
        raise GmailOAuthError("Gmail client secret is not configured")

    payload = {
        "grant_type": "authorization_code",
        "code": code,
        "redirect_uri": settings.gmail_redirect_uri,
        "client_id": settings.gmail_client_id,
        "client_secret": settings.gmail_client_secret,
    }
    if code_verifier:
        payload["code_verifier"] = code_verifier

    timeout = aiohttp.ClientTimeout(total=10.0)
    async with aiohttp.ClientSession(timeout=timeout) as session:
        async with session.post(TOKEN_URL, data=payload) as response:
            body_text = await response.text()
            if response.status != 200:
                raise GmailOAuthError(
                    f"Failed to exchange authorization code (status {response.status}): {body_text}"
                )
            return await response.json()


async def fetch_userinfo(*, access_token: str) -> dict[str, object]:
    """Fetch the authenticated user's profile information."""

    timeout = aiohttp.ClientTimeout(total=10.0)
    headers = {"Authorization": f"Bearer {access_token}"}
    async with aiohttp.ClientSession(timeout=timeout) as session:
        async with session.get(USERINFO_URL, headers=headers) as response:
            body_text = await response.text()
            if response.status != 200:
                raise GmailOAuthError(
                    f"Failed to fetch Gmail user info (status {response.status}): {body_text}"
                )
            return await response.json()
