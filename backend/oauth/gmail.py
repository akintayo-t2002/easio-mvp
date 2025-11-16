"""FastAPI routes for Gmail OAuth."""

from __future__ import annotations

import base64
import logging
import secrets
from datetime import datetime, timedelta, timezone
from hashlib import sha256
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import HTMLResponse, RedirectResponse

from ..config import Settings, get_settings
from ..dependencies import get_organization_id, get_supabase_client
from ..oauth.common import (
    consume_state_nonce,
    persist_state_nonce,
    run_repo_call,
    validate_redirect,
)
from ..oauth.state import StateTokenError, generate_state_token, verify_state_token
from ..repositories.integrations_repo import IntegrationConnectionRepository
from ..repositories.oauth_state_repo import OAuthStateRepository
from ..services.gmail_oauth import (
    GmailOAuthError,
    build_authorize_url,
    exchange_code_for_tokens,
    fetch_userinfo,
)
from ..services.integration_secrets import (
    IntegrationSecretError,
    persist_access_token_secret,
    persist_refresh_token_secret,
)

DEFAULT_SCOPES = (
    "openid",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/gmail.send",
)

router = APIRouter(prefix="/oauth/gmail", tags=["Gmail OAuth"])

logger = logging.getLogger(__name__)
PROVIDER = "gmail"


def _get_repo() -> IntegrationConnectionRepository:
    client = get_supabase_client()
    return IntegrationConnectionRepository(client)


async def _get_state_repo() -> OAuthStateRepository:
    return await OAuthStateRepository.create()


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

    callback_origin = validate_redirect(redirect, settings)

    code_verifier = secrets.token_urlsafe(64)
    code_challenge = base64.urlsafe_b64encode(sha256(code_verifier.encode("utf-8")).digest()).decode("utf-8").rstrip("=")

    ttl_seconds = max(60, settings.oauth_state_ttl_seconds or 300)
    nonce = secrets.token_urlsafe(32)
    expires_at = datetime.now(timezone.utc) + timedelta(seconds=ttl_seconds)
    state_repo = await _get_state_repo()
    await persist_state_nonce(
        repo=state_repo,
        provider=PROVIDER,
        nonce=nonce,
        organization_id=resolved_org_id,
        redirect_url=redirect,
        origin=callback_origin,
        code_verifier=code_verifier,
        expires_at=expires_at,
    )

    state = generate_state_token(
        organization_id=resolved_org_id,
        secret_key=settings.oauth_state_secret,
        ttl_seconds=ttl_seconds,
        nonce_value=nonce,
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

    nonce = state_payload.get("nonce")
    if not isinstance(nonce, str) or not nonce:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing state nonce")

    state_repo = await _get_state_repo()
    state_record = await consume_state_nonce(repo=state_repo, provider=PROVIDER, nonce=nonce)
    if state_record.organization_id != organization_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Organization mismatch")

    redirect_url = state_record.redirect_url
    if redirect_url:
        validated_origin = validate_redirect(redirect_url, settings)
        if state_record.origin and validated_origin != state_record.origin:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Redirect origin mismatch")

    code_verifier = state_record.pkce_verifier
    if not isinstance(code_verifier, str) or not code_verifier:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing PKCE verifier")

    try:
        token_response = await exchange_code_for_tokens(
            code=code,
            code_verifier=code_verifier,
            settings=settings,
        )
    except GmailOAuthError as exc:
        logger.warning(
            "Gmail authorization code exchange failed",
            extra={"organization_id": str(organization_id), "error": str(exc)},
        )
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
        except GmailOAuthError as exc:
            logger.debug(
                "Failed to fetch Gmail profile email",
                extra={"organization_id": str(organization_id), "error": str(exc)},
            )
            profile_email = None

    expires_at = None
    if isinstance(expires_in, (int, float)):
        expires_at = datetime.now(timezone.utc) + timedelta(seconds=int(expires_in))

    repo = _get_repo()
    existing = await run_repo_call(repo.get_connection, organization_id, PROVIDER)

    try:
        refresh_secret_id, refresh_secret_created_at = await persist_refresh_token_secret(
            organization_id=organization_id,
            provider=PROVIDER,
            refresh_token=refresh_token,
            existing_secret_id=getattr(existing, "refresh_token_secret_id", None) if existing else None,
        )
    except IntegrationSecretError as exc:
        logger.exception(
            "Failed to persist Gmail refresh token",
            extra={"organization_id": str(organization_id)},
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to store Gmail credentials",
        ) from exc

    access_secret_id = None
    access_secret_created_at = None
    if isinstance(access_token, str) and access_token:
        try:
            access_secret_id, access_secret_created_at = await persist_access_token_secret(
                organization_id=organization_id,
                provider=PROVIDER,
                access_token=access_token,
                existing_secret_id=getattr(existing, "access_token_secret_id", None) if existing else None,
            )
        except IntegrationSecretError as exc:
            logger.exception(
                "Failed to persist Gmail access token",
                extra={"organization_id": str(organization_id)},
            )
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Unable to store Gmail credentials",
            ) from exc

    await run_repo_call(
        repo.upsert_connection,
        organization_id,
        PROVIDER,
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
