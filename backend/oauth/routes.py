"""FastAPI routes for Airtable OAuth."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from hashlib import sha256
from typing import Optional
from urllib.parse import urlparse
import secrets
import base64
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import HTMLResponse, RedirectResponse

from ..config import Settings, get_settings
from ..dependencies import get_organization_id, get_supabase_client
from ..oauth.state import StateTokenError, generate_state_token, verify_state_token
from ..repositories.integrations_repo import IntegrationConnectionRepository
from ..services.airtable_oauth import (
    AirtableOAuthError,
    build_authorize_url,
    exchange_code_for_tokens,
)
from ..services.vault import create_secret, delete_secret, get_secret

DEFAULT_SCOPES = (
    "schema.bases:read",
    "data.records:read",
    "data.records:write",
)

router = APIRouter(prefix="/oauth/airtable", tags=["Airtable OAuth"])


def _get_repo() -> IntegrationConnectionRepository:
    client = get_supabase_client()
    return IntegrationConnectionRepository(client)


@router.get("/authorize", status_code=status.HTTP_307_TEMPORARY_REDIRECT)
async def authorize_airtable(
    redirect: Optional[str] = Query(default=None, description="Optional redirect after success"),
    org_id: Optional[str] = Query(default=None, alias="org_id"),
    organization_id: UUID = Depends(get_organization_id),
    settings: Settings = Depends(get_settings),
) -> RedirectResponse:
    """Redirect the user to Airtable's authorization screen."""

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

    parsed_redirect = urlparse(redirect)
    if not parsed_redirect.scheme or not parsed_redirect.netloc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Redirect must be absolute")

    allowed_origin = settings.frontend_base_url.rstrip("/")
    parsed_allowed = urlparse(allowed_origin)
    if (parsed_redirect.scheme, parsed_redirect.netloc) != (parsed_allowed.scheme, parsed_allowed.netloc):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Redirect origin not allowed")

    callback_origin = f"{parsed_redirect.scheme}://{parsed_redirect.netloc}"

    code_verifier = secrets.token_urlsafe(64)
    code_challenge = base64.urlsafe_b64encode(
        sha256(code_verifier.encode("utf-8")).digest()
    ).decode("utf-8").rstrip("=")

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
async def airtable_callback(
    code: Optional[str] = None,
    state: Optional[str] = None,
    error: Optional[str] = None,
    error_description: Optional[str] = None,
    settings: Settings = Depends(get_settings),
):
    """Handle the OAuth callback from Airtable."""

    if error:
        content = f"<h1>Airtable connection failed</h1><p>{error}: {error_description or ''}</p>"
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

    origin_from_state = state_payload.get("origin")
    if isinstance(origin_from_state, str):
        allowed_origin = settings.frontend_base_url.rstrip("/")
        parsed_allowed = urlparse(allowed_origin)
        parsed_origin = urlparse(origin_from_state)
        if (parsed_origin.scheme, parsed_origin.netloc) != (parsed_allowed.scheme, parsed_allowed.netloc):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Origin mismatch")

    if redirect_url:
        parsed_redirect = urlparse(redirect_url)
        allowed_origin = settings.frontend_base_url.rstrip("/")
        parsed_allowed = urlparse(allowed_origin)
        if (parsed_redirect.scheme, parsed_redirect.netloc) != (parsed_allowed.scheme, parsed_allowed.netloc):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Redirect origin not allowed")

    code_verifier = state_payload.get("pkce_v")
    if not isinstance(code_verifier, str):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing PKCE verifier")

    try:
        token_response = await exchange_code_for_tokens(code=code, code_verifier=code_verifier, settings=settings)
    except AirtableOAuthError as exc:
        content = f"<h1>Airtable connection failed</h1><p>{exc}</p>"
        return HTMLResponse(content=content, status_code=status.HTTP_400_BAD_REQUEST)

    refresh_token = token_response.get("refresh_token")
    if not refresh_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Airtable did not return a refresh token",
        )

    access_token = token_response.get("access_token")
    expires_in = token_response.get("expires_in")
    scope = token_response.get("scope")

    expires_at = None
    if isinstance(expires_in, (int, float)):
        expires_at = datetime.now(timezone.utc) + timedelta(seconds=int(expires_in))

    repo = _get_repo()
    existing = repo.get_connection(organization_id=organization_id, provider="airtable")

    # Replace existing secrets with new values
    if existing and existing.refresh_token_secret_id:
        await delete_secret(settings, secret_id=str(existing.refresh_token_secret_id))
    if existing and existing.access_token_secret_id:
        await delete_secret(settings, secret_id=str(existing.access_token_secret_id))

    refresh_secret_name = f"airtable-refresh-{organization_id}-{uuid4()}"
    refresh_secret_description = f"Airtable refresh token for org {organization_id}"
    refresh_secret_id, refresh_secret_created_at = await create_secret(
        settings,
        name=refresh_secret_name,
        secret=refresh_token,
        description=refresh_secret_description,
    )

    access_secret_id = None
    access_secret_created_at = None
    if isinstance(access_token, str) and access_token:
        access_secret_name = f"airtable-access-{organization_id}-{uuid4()}"
        access_secret_description = f"Airtable access token for org {organization_id}"
        access_secret_id, access_secret_created_at = await create_secret(
            settings,
            name=access_secret_name,
            secret=access_token,
            description=access_secret_description,
        )

    repo.upsert_connection(
        organization_id=organization_id,
        provider="airtable",
        refresh_token=None,
        access_token=None,
        refresh_token_secret_id=refresh_secret_id,
        refresh_token_secret_created_at=refresh_secret_created_at,
        access_token_secret_id=access_secret_id,
        access_token_secret_created_at=access_secret_created_at,
        expires_at=expires_at,
        scope=scope,
    )

    if redirect_url:
        return RedirectResponse(redirect_url, status_code=status.HTTP_302_FOUND)

    content = "<h1>Airtable connected</h1><p>You may close this window.</p>"
    return HTMLResponse(content=content, status_code=status.HTTP_200_OK)
