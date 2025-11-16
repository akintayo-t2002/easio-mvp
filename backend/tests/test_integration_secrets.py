import asyncio
from datetime import datetime, timezone
from uuid import uuid4

import pytest

from backend.config import Settings
from backend.services.integration_secrets import (
    IntegrationSecretError,
    persist_access_token_secret,
    persist_refresh_token_secret,
)


def test_persist_access_token_secret_updates_existing(monkeypatch) -> None:
    settings = Settings()
    monkeypatch.setattr("backend.services.integration_secrets.get_settings", lambda: settings)

    async def fake_update_secret(settings, *, secret_id, secret, description=None):
        assert secret_id == "existing"
        assert secret == "new-token"
        return secret_id, datetime(2024, 1, 1, tzinfo=timezone.utc)

    async def _fail_create(*args, **kwargs):  # pragma: no cover - should not be called
        raise AssertionError("create_secret should not be invoked when updating")

    monkeypatch.setattr("backend.services.integration_secrets.update_secret", fake_update_secret)
    monkeypatch.setattr("backend.services.integration_secrets.create_secret", _fail_create)

    async def _run_test() -> tuple[str, datetime]:
        return await persist_access_token_secret(
            organization_id=uuid4(),
            provider="gmail",
            access_token="new-token",
            existing_secret_id="existing",
        )

    secret_id, created_at = asyncio.run(_run_test())

    assert secret_id == "existing"
    assert created_at == datetime(2024, 1, 1, tzinfo=timezone.utc)


def test_persist_refresh_token_secret_creates_new_secret(monkeypatch) -> None:
    settings = Settings()
    monkeypatch.setattr("backend.services.integration_secrets.get_settings", lambda: settings)

    async def fake_create_secret(settings, *, name, secret, description=None):
        assert secret == "refresh-token"
        return "new-id", datetime(2024, 2, 2, tzinfo=timezone.utc)

    async def fake_update_secret(*args, **kwargs):  # pragma: no cover - should not run
        raise AssertionError("update_secret should not be invoked for new secrets")

    monkeypatch.setattr("backend.services.integration_secrets.create_secret", fake_create_secret)
    monkeypatch.setattr("backend.services.integration_secrets.update_secret", fake_update_secret)

    async def _run_test() -> tuple[str, datetime]:
        return await persist_refresh_token_secret(
            organization_id=uuid4(),
            provider="gmail",
            refresh_token="refresh-token",
            existing_secret_id=None,
        )

    secret_id, created_at = asyncio.run(_run_test())

    assert secret_id == "new-id"
    assert created_at == datetime(2024, 2, 2, tzinfo=timezone.utc)


def test_persist_secret_value_requires_token(monkeypatch) -> None:
    settings = Settings()
    monkeypatch.setattr("backend.services.integration_secrets.get_settings", lambda: settings)

    async def fake_update_secret(*args, **kwargs):  # pragma: no cover - should not run
        raise AssertionError("update_secret should not be invoked")

    async def fake_create_secret(*args, **kwargs):  # pragma: no cover - should not run
        raise AssertionError("create_secret should not be invoked")

    monkeypatch.setattr("backend.services.integration_secrets.create_secret", fake_create_secret)
    monkeypatch.setattr("backend.services.integration_secrets.update_secret", fake_update_secret)

    async def _run_test() -> None:
        await persist_access_token_secret(
            organization_id=uuid4(),
            provider="gmail",
            access_token="",
            existing_secret_id=None,
        )

    with pytest.raises(IntegrationSecretError):
        asyncio.run(_run_test())
