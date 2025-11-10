import pytest

from backend.config import Settings
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
