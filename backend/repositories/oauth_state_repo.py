"""Repository for persisting OAuth state nonces."""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from typing import Optional

from supabase import AsyncClient, create_async_client

from ..config import get_settings
from ..db.models import OAuthStateToken


class OAuthStateRepository:
    """Manage OAuth state nonce storage in Supabase."""

    TABLE_NAME = "oauth_state_tokens"
    _client_lock = asyncio.Lock()
    _client_cache: Optional[AsyncClient] = None

    def __init__(self, client: AsyncClient):
        self.client = client

    @classmethod
    async def create(cls) -> "OAuthStateRepository":
        if cls._client_cache is not None:
            return cls(cls._client_cache)

        async with cls._client_lock:
            if cls._client_cache is None:
                settings = get_settings()
                cls._client_cache = await create_async_client(settings.supabase_url, settings.supabase_key)
        return cls(cls._client_cache)

    async def create_state(
        self,
        *,
        nonce: str,
        provider: str,
        organization_id: str,
        redirect_url: Optional[str],
        origin: Optional[str],
        pkce_verifier: str,
        expires_at: datetime,
    ) -> None:
        payload = {
            "nonce": nonce,
            "provider": provider,
            "organization_id": organization_id,
            "redirect_url": redirect_url,
            "origin": origin,
            "pkce_verifier": pkce_verifier,
            "expires_at": expires_at.isoformat(),
        }
        await self.client.table(self.TABLE_NAME).insert(payload).execute()

    async def consume_state(self, *, nonce: str, provider: str) -> Optional[OAuthStateToken]:
        response = (
            await self.client.table(self.TABLE_NAME)
            .select("*")
            .eq("nonce", nonce)
            .eq("provider", provider)
            .limit(1)
            .execute()
        )
        data = response.data or []
        record = data[0] if data else None
        if not record:
            return None

        await self.client.table(self.TABLE_NAME).delete().eq("nonce", nonce).execute()
        return OAuthStateToken(**record)

    async def prune_expired(self, *, before: Optional[datetime] = None) -> None:
        cutoff = before or datetime.now(timezone.utc)
        await self.client.table(self.TABLE_NAME).delete().lt("expires_at", cutoff.isoformat()).execute()
