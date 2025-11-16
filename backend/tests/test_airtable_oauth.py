import asyncio
from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest
from fastapi import HTTPException, status

from backend.config import Settings
from backend.oauth import routes as airtable_routes
from backend.oauth.common import validate_redirect
from backend.oauth.state import generate_state_token


def test_airtable_validate_redirect_allows_origin_and_path() -> None:
    settings = Settings(
        frontend_base_url="https://app.example.com",
        frontend_allowed_origins=["https://portal.example.com"],
        frontend_redirect_path_prefixes=["/integrations"],
    )

    origin = validate_redirect("https://app.example.com/integrations/done", settings)
    assert origin == "https://app.example.com"


def test_airtable_validate_redirect_blocks_path() -> None:
    settings = Settings(
        frontend_base_url="https://app.example.com",
        frontend_redirect_path_prefixes=["/integrations"],
    )

    with pytest.raises(HTTPException):
        validate_redirect("https://app.example.com/other", settings)


def test_airtable_callback_persists_secrets(monkeypatch) -> None:
    org_id = uuid4()
    settings = Settings(
        frontend_base_url="https://app.example.com",
        frontend_redirect_path_prefixes=["/integrations"],
        airtable_client_id="client",
        airtable_client_secret="secret",
        airtable_redirect_uri="https://api.example.com/callback",
        oauth_state_secret="state-secret",
    )

    redirect_url = "https://app.example.com/integrations/success"

    class DummyState:
        def __init__(self) -> None:
            self.organization_id = org_id
            self.redirect_url = redirect_url
            self.origin = "https://app.example.com"
            self.pkce_verifier = "verifier"
            self.expires_at = datetime.now(timezone.utc) + timedelta(minutes=5)

    async def fake_consume_state_nonce(*, repo, provider, nonce):
        assert nonce == "nonce"
        return DummyState()

    monkeypatch.setattr(airtable_routes, "consume_state_nonce", fake_consume_state_nonce)

    async def fake_run_repo_call(func, *args, **kwargs):
        return func(*args, **kwargs)

    monkeypatch.setattr(airtable_routes, "run_repo_call", fake_run_repo_call)

    recorded = {}

    async def fake_persist_refresh_token_secret(**kwargs):
        recorded["refresh"] = kwargs
        return "refresh-id", datetime(2024, 1, 1, tzinfo=timezone.utc)

    async def fake_persist_access_token_secret(**kwargs):
        recorded["access"] = kwargs
        return "access-id", datetime(2024, 1, 2, tzinfo=timezone.utc)

    monkeypatch.setattr(airtable_routes, "persist_refresh_token_secret", fake_persist_refresh_token_secret)
    monkeypatch.setattr(airtable_routes, "persist_access_token_secret", fake_persist_access_token_secret)

    async def fake_exchange_code_for_tokens(*, code, code_verifier, settings):
        assert code == "auth-code"
        assert code_verifier == "verifier"
        return {
            "refresh_token": "refresh-token",
            "access_token": "access-token",
            "expires_in": 3600,
            "scope": "all",
        }

    monkeypatch.setattr(airtable_routes, "exchange_code_for_tokens", fake_exchange_code_for_tokens)

    class DummyRepo:
        def __init__(self) -> None:
            self.upserts = []

        def get_connection(self, organization_id, provider):  # noqa: D401 - simple stub
            assert organization_id == org_id
            assert provider == airtable_routes.PROVIDER

            class Conn:
                refresh_token_secret_id = None
                access_token_secret_id = None

            return Conn()

        def upsert_connection(self, *args, **kwargs):
            self.upserts.append((args, kwargs))

    dummy_repo = DummyRepo()
    monkeypatch.setattr(airtable_routes, "_get_repo", lambda: dummy_repo)

    state_token = generate_state_token(
        organization_id=org_id,
        secret_key=settings.oauth_state_secret,
        nonce_value="nonce",
        ttl_seconds=300,
    )

    response = asyncio.run(
        airtable_routes.airtable_callback(
            code="auth-code",
            state=state_token,
            settings=settings,
        )
    )

    assert response.status_code == status.HTTP_302_FOUND
    assert response.headers["location"] == redirect_url

    assert recorded["refresh"]["refresh_token"] == "refresh-token"
    assert recorded["access"]["access_token"] == "access-token"
    assert dummy_repo.upserts, "Upsert should be invoked"
