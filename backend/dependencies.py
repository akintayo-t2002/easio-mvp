"""FastAPI dependencies for dependency injection."""

from typing import Generator
from uuid import UUID

from fastapi import Header, HTTPException, status
from supabase import Client, create_client

from .config import get_settings
from .repositories import IntegrationConnectionRepository, SupabaseWorkflowRepository


def get_supabase_client() -> Client:
    """Create and return a Supabase client."""
    settings = get_settings()
    if not settings.supabase_url or not settings.supabase_key:
        raise RuntimeError("Supabase credentials are not configured")

    return create_client(settings.supabase_url, settings.supabase_key)


def get_repository() -> Generator[SupabaseWorkflowRepository, None, None]:
    """Provide a Supabase repository instance."""
    client = get_supabase_client()
    yield SupabaseWorkflowRepository(client)


def get_integration_repository() -> Generator[IntegrationConnectionRepository, None, None]:
    """Provide an integration connection repository instance."""
    client = get_supabase_client()
    yield IntegrationConnectionRepository(client)


def get_organization_id(
    x_organization_id: str = Header(default="00000000-0000-0000-0000-000000000000")
) -> UUID:
    """Extract organization ID from headers (placeholder for multi-tenancy)."""
    try:
        return UUID(x_organization_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid organization ID format",
        )
