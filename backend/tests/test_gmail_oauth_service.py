import pytest
from fastapi import HTTPException
from uuid import uuid4

from backend.config import Settings
from backend.oauth.gmail import DEFAULT_SCOPES
from backend.oauth.common import validate_redirect
from backend.oauth.state import generate_state_token, verify_state_token
from backend.services.gmail_oauth import GmailOAuthError, build_authorize_url


def test_build_authorize_url_includes_required_parameters() -> None:
    settings = Settings(
        gmail_client_id="client-id",
        gmail_client_secret="secret",
        gmail_redirect_uri="https://example.com/callback",
    )

    url = build_authorize_url(settings=settings, state="abc", scopes=["scope1", "scope2"])
    assert "client_id=client-id" in url
    assert "redirect_uri=https%3A%2F%2Fexample.com%2Fcallback" in url
    assert "scope=scope1+scope2" in url
    assert "access_type=offline" in url
    assert "prompt=consent" in url
    assert "state=abc" in url


def test_build_authorize_url_requires_configuration() -> None:
    settings = Settings(gmail_client_id="", gmail_redirect_uri="")
    with pytest.raises(GmailOAuthError):
        build_authorize_url(settings=settings, state="abc", scopes=["scope"])


def test_default_gmail_scopes_include_userinfo_email() -> None:
    assert "openid" in DEFAULT_SCOPES
    assert "https://www.googleapis.com/auth/userinfo.email" in DEFAULT_SCOPES
    assert "https://www.googleapis.com/auth/gmail.send" in DEFAULT_SCOPES


def test_validate_redirect_allows_configured_origin_and_path() -> None:
    settings = Settings(
        frontend_base_url="https://app.example.com",
        frontend_redirect_path_prefixes=["/integrations"],
    )

    origin = validate_redirect("https://app.example.com/integrations/setup", settings)
    assert origin == "https://app.example.com"


def test_validate_redirect_rejects_unknown_origin() -> None:
    settings = Settings(frontend_base_url="https://app.example.com")

    with pytest.raises(HTTPException):
        validate_redirect("https://malicious.example.com/handoff", settings)


def test_generate_state_token_uses_explicit_nonce() -> None:
    org_id = uuid4()
    nonce = "custom-nonce"

    token = generate_state_token(org_id, "secret", nonce_value=nonce)
    payload = verify_state_token(token, "secret")

    assert payload["nonce"] == nonce
