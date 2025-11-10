"""FastAPI routes for Gmail OAuth."""

from __future__ import annotations

import base64
import secrets
from datetime import datetime, timedelta, timezone
from hashlib import sha256
from typing import Optional
from urllib.parse import urlparse
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import HTMLResponse, RedirectResponse

from ..config import Settings, get_settings
from ..dependencies import get_organization_id, get_supabase_client
from ..oauth.state import StateTokenError, generate_state_token, verify_state_token
from ..repositories.integrations_repo import IntegrationConnectionRepository
from ..services.gmail_oauth import (
    GmailOAuthError,
    build_authorize_url,
    exchange_code_for_tokens,
    fetch_userinfo,
)
from ..services.vault import create_secret, delete_secret

DEFAULT_SCOPES = ("https://www.googleapis.com/auth/gmail.send",)

router = APIRouter(prefix="/oauth/gmail", tags=["Gmail OAuth"])


def _get_repo() -> IntegrationConnectionRepository:
    client = get_supabase_client()
    return IntegrationConnectionRepository(client)


def _validate_redirect(redirect: str, settings: Settings) -> None:
    parsed_redirect = urlparse(redirect)
    if not parsed_redirect.scheme or not parsed_redirect.netloc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Redirect must be absolute")

    allowed_origin = settings.frontend_base_url.rstrip("/")
    parsed_allowed = urlparse(allowed_origin)
    if (parsed_redirect.scheme, parsed_redirect.netloc) != (parsed_allowed.scheme, parsed_allowed.netloc):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Redirect origin not allowed")


@router.get("/authorize", status_code=status.HTTP_307_TEMPORARY_REDIRECT)
async def authorize_gmail(
    redirect: Optional[str] = Query(default=None, description="Optional redirect after success"),
    org_id: Optional[str] = Query(default=None, alias="org_id"),
    organization_id: UUID = Depends(get_organization_id),
    settings: Settings = Depends(get_settings),
) -> RedirectResponse:
    """Redirect the user to Google's consent screen for Gmail."""

    resolved_org_id = organization_id
    provided_org_param = org_id is not None
    zero_uuid = UUID("00000000-0000-0000-0000-000000000000")
    if org_id:
        try:
            org_uuid = UUID(org_id)
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid org_id") from exc
        if resolved_org_id != zero_uuid and resolved_org_id != org_uuid:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Organization mismatch")
        resolved_org_id = org_uuid

    if resolved_org_id == zero_uuid and not provided_org_param:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing organization context")

    if not redirect:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing redirect parameter")

    _validate_redirect(redirect, settings)
    parsed_redirect = urlparse(redirect)
    callback_origin = f"{parsed_redirect.scheme}://{parsed_redirect.netloc}"

    code_verifier = secrets.token_urlsafe(64)
    code_challenge = base64.urlsafe_b64encode(sha256(code_verifier.encode("utf-8")).digest()).decode("utf-8").rstrip("=")

    state = generate_state_token(
        organization_id=resolved_org_id,
        secret_key=settings.oauth_state_secret,
        redirect_url=redirect,
        extra={"pkce_v": code_verifier, "origin": callback_origin},
    )

    authorize_url = build_authorize_url(
        settings=settings,
        state=state,
        scopes=DEFAULT_SCOPES,
        code_challenge=code_challenge,
        code_challenge_method="S256",
    )

    return RedirectResponse(authorize_url, status_code=status.HTTP_307_TEMPORARY_REDIRECT)


@router.get("/callback")
async def gmail_callback(
    code: Optional[str] = None,
    state: Optional[str] = None,
    error: Optional[str] = None,
    error_description: Optional[str] = None,
    settings: Settings = Depends(get_settings),
):
    """Handle the OAuth callback from Google."""

    if error:
        content = f"<h1>Gmail connection failed</h1><p>{error}: {error_description or ''}</p>"
        return HTMLResponse(content=content, status_code=status.HTTP_400_BAD_REQUEST)

    if not code or not state:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing authorization code or state",
        )

    try:
        state_payload = verify_state_token(state, settings.oauth_state_secret)
    except StateTokenError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    try:
        organization_id = UUID(state_payload["org"])
    except (KeyError, ValueError) as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid organization in state") from exc

    redirect_url = state_payload.get("redirect")
    if redirect_url:
        _validate_redirect(redirect_url, settings)

    origin_from_state = state_payload.get("origin")
    if isinstance(origin_from_state, str):
        _validate_redirect(origin_from_state, settings)

    code_verifier = state_payload.get("pkce_v")
    if not isinstance(code_verifier, str):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing PKCE verifier")

    try:
        token_response = await exchange_code_for_tokens(
            code=code,
            code_verifier=code_verifier,
            settings=settings,
        )
    except GmailOAuthError as exc:
        content = f"<h1>Gmail connection failed</h1><p>{exc}</p>"
        return HTMLResponse(content=content, status_code=status.HTTP_400_BAD_REQUEST)

    refresh_token = token_response.get("refresh_token")
    if not isinstance(refresh_token, str) or not refresh_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Gmail did not return a refresh token",
        )

    access_token = token_response.get("access_token")
    expires_in = token_response.get("expires_in")
    scope = token_response.get("scope")

    profile_email: Optional[str] = None
    if isinstance(access_token, str) and access_token:
        try:
            userinfo = await fetch_userinfo(access_token=access_token)
            email = userinfo.get("email")
            if isinstance(email, str):
                profile_email = email
        except GmailOAuthError:
            # Non-fatal; continue without profile details.
            profile_email = None

    expires_at = None
    if isinstance(expires_in, (int, float)):
        expires_at = datetime.now(timezone.utc) + timedelta(seconds=int(expires_in))

    repo = _get_repo()
    existing = repo.get_connection(organization_id=organization_id, provider="gmail")

    # Remove previous secrets if present
    if existing and existing.refresh_token_secret_id:
        await delete_secret(settings, secret_id=str(existing.refresh_token_secret_id))
    if existing and existing.access_token_secret_id:
        await delete_secret(settings, secret_id=str(existing.access_token_secret_id))

    refresh_secret_name = f"gmail-refresh-{organization_id}-{uuid4()}"
    refresh_secret_description = f"Gmail refresh token for org {organization_id}"
    refresh_secret_id, refresh_secret_created_at = await create_secret(
        settings,
        name=refresh_secret_name,
        secret=refresh_token,
        description=refresh_secret_description,
    )

    access_secret_id = None
    access_secret_created_at = None
    if isinstance(access_token, str) and access_token:
        access_secret_name = f"gmail-access-{organization_id}-{uuid4()}"
        access_secret_description = f"Gmail access token for org {organization_id}"
        access_secret_id, access_secret_created_at = await create_secret(
            settings,
            name=access_secret_name,
            secret=access_token,
            description=access_secret_description,
        )

    repo.upsert_connection(
        organization_id=organization_id,
        provider="gmail",
        refresh_token=None,
        access_token=None,
        refresh_token_secret_id=refresh_secret_id,
        refresh_token_secret_created_at=refresh_secret_created_at,
        access_token_secret_id=access_secret_id,
        access_token_secret_created_at=access_secret_created_at,
        expires_at=expires_at,
        scope=scope,
        profile_email=profile_email,
    )

    if redirect_url:
        params = ""
        if profile_email:
            params = f"?connectedEmail={profile_email}"
        return RedirectResponse(f"{redirect_url}{params}", status_code=status.HTTP_302_FOUND)

    email_fragment = f"<p>Connected Gmail account: {profile_email}</p>" if profile_email else ""
    content = f"<h1>Gmail connected</h1>{email_fragment}<p>You may close this window.</p>"
    return HTMLResponse(content=content, status_code=status.HTTP_200_OK)
