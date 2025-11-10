import asyncio
from uuid import uuid4

import pytest

from backend.runtime.tool_registry import (
    ToolError,
    _get_boolean_argument,
    _get_string_argument,
    _parse_email_addresses,
    _resolve_gmail_profile_email,
    _resolve_max_recipients,
)
from backend.services.gmail_oauth import GmailOAuthError


def test_resolve_max_recipients_various_inputs() -> None:
    assert _resolve_max_recipients(None) == 5
    assert _resolve_max_recipients(3) == 3
    assert _resolve_max_recipients("7") == 7
    assert _resolve_max_recipients("not-a-number") == 5
    assert _resolve_max_recipients(0) == 5
    assert _resolve_max_recipients(50) == 20


def test_parse_email_addresses_valid_string() -> None:
    addresses = _parse_email_addresses(
        "Alice <alice@example.com>, bob@example.com",
        field="to",
        required=True,
    )
    assert addresses == ["alice@example.com", "bob@example.com"]


def test_parse_email_addresses_invalid_value_raises() -> None:
    with pytest.raises(ToolError):
        _parse_email_addresses("not-an-email", field="to", required=True)


def test_get_string_argument_optional_blank_returns_none() -> None:
    arguments = {"note": "   "}
    assert _get_string_argument(arguments, field="note", required=False) is None


def test_get_boolean_argument_from_string_values() -> None:
    assert _get_boolean_argument({"html": "true"}, field="html") is True
    assert _get_boolean_argument({"html": "False"}, field="html") is False
    assert _get_boolean_argument({}, field="html") is None


def test_get_boolean_argument_invalid_type() -> None:
    with pytest.raises(ToolError):
        _get_boolean_argument({"html": 3}, field="html")


def test_resolve_gmail_profile_email_fetches_and_persists(monkeypatch) -> None:
    class DummyConnection:
        id = uuid4()
        profile_email = None

    recorded: dict[str, object] = {}

    class DummyRepo:
        def upsert_connection(self, organization_id, provider, **kwargs):
            recorded.update(
                {
                    "organization_id": organization_id,
                    "provider": provider,
                    **kwargs,
                }
            )

    async def fake_run_in_thread(func, *args, **kwargs):
        return func(*args, **kwargs)

    async def fake_fetch_userinfo(*, access_token: str):
        assert access_token == "token"
        return {"email": "agent@example.com"}

    monkeypatch.setattr("backend.runtime.tool_registry._run_in_thread", fake_run_in_thread)
    monkeypatch.setattr("backend.runtime.tool_registry.fetch_userinfo", fake_fetch_userinfo)

    repo = DummyRepo()

    org_id = uuid4()
    email, returned_token = asyncio.run(
        _resolve_gmail_profile_email(
            connection=DummyConnection(),
            repo=repo,
            organization_id=org_id,
            access_token="token",
        )
    )

    assert email == "agent@example.com"
    assert returned_token == "token"
    assert recorded["provider"] == "gmail"
    assert recorded["organization_id"] == org_id
    assert recorded["profile_email"] == "agent@example.com"


def test_resolve_gmail_profile_email_raises_on_fetch_failure(monkeypatch) -> None:
    class DummyConnection:
        profile_email = None

    async def fake_run_in_thread(func, *args, **kwargs):
        return func(*args, **kwargs)

    async def fake_fetch_userinfo(*, access_token: str):
        raise GmailOAuthError("boom")

    monkeypatch.setattr("backend.runtime.tool_registry._run_in_thread", fake_run_in_thread)
    monkeypatch.setattr("backend.runtime.tool_registry.fetch_userinfo", fake_fetch_userinfo)

    called = False

    class DummyRepo:
        def upsert_connection(self, *args, **kwargs):
            nonlocal called
            called = True

    async def run_test() -> None:
        with pytest.raises(GmailOAuthError):
            await _resolve_gmail_profile_email(
                connection=DummyConnection(),
                repo=DummyRepo(),
                organization_id=uuid4(),
                access_token="bad",
            )

    asyncio.run(run_test())

    assert called is False
