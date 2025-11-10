"""Repository for managing third-party integration connections."""

from __future__ import annotations

from datetime import datetime
from typing import Optional
from uuid import UUID, uuid4

from supabase import Client

from ..db import IntegrationConnection


UNSET = object()


class IntegrationConnectionRepository:
    """Persist and retrieve integration OAuth connections using Supabase."""

    TABLE_NAME = "integration_connections"

    def __init__(self, client: Client):
        self.client = client

    def get_connection(self, organization_id: UUID, provider: str) -> Optional[IntegrationConnection]:
        response = (
            self.client.table(self.TABLE_NAME)
            .select("*")
            .eq("organization_id", str(organization_id))
            .eq("provider", provider)
            .limit(1)
            .execute()
        )
        data = response.data or []
        if not data:
            return None
        return IntegrationConnection(**data[0])

    def upsert_connection(
        self,
        organization_id: UUID,
        provider: str,
        *,
        refresh_token: object = UNSET,
        access_token: object = UNSET,
        refresh_token_secret_id: Optional[str] = None,
        refresh_token_secret_created_at: Optional[datetime] = None,
        access_token_secret_id: Optional[str] = None,
        access_token_secret_created_at: Optional[datetime] = None,
        expires_at: Optional[datetime] = None,
        scope: Optional[str] = None,
        profile_email: object = UNSET,
    ) -> IntegrationConnection:
        payload: dict[str, object] = {}

        if refresh_token_secret_id is not None:
            payload["refresh_token_secret_id"] = refresh_token_secret_id
        if refresh_token_secret_created_at is not None:
            payload["refresh_token_secret_created_at"] = refresh_token_secret_created_at.isoformat()
        if access_token_secret_id is not None:
            payload["access_token_secret_id"] = access_token_secret_id
        if access_token_secret_created_at is not None:
            payload["access_token_secret_created_at"] = access_token_secret_created_at.isoformat()

        if refresh_token is not UNSET:
            payload["refresh_token"] = refresh_token
        if access_token is not UNSET:
            payload["access_token"] = access_token
        if expires_at is not None:
            payload["expires_at"] = expires_at.isoformat()
        if scope is not None:
            payload["scope"] = scope
        if profile_email is not UNSET:
            payload["profile_email"] = profile_email

        existing = self.get_connection(organization_id, provider)
        if existing:
            response = (
                self.client.table(self.TABLE_NAME)
                .update(payload)
                .eq("id", str(existing.id))
                .execute()
            )
            data = response.data or []
            record = data[0] if data else existing.model_dump()
            return IntegrationConnection(**record)

        insert_payload = {
            "id": str(uuid4()),
            "organization_id": str(organization_id),
            "provider": provider,
            **payload,
        }
        response = self.client.table(self.TABLE_NAME).insert(insert_payload).execute()
        data = response.data or insert_payload
        if isinstance(data, list):
            data = data[0]
        return IntegrationConnection(**data)

    def delete_connection(self, organization_id: UUID, provider: str) -> None:
        self.client.table(self.TABLE_NAME).delete().eq("organization_id", str(organization_id)).eq("provider", provider).execute()
