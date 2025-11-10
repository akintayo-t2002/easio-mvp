"""Service layer exports for integrations and secrets management."""

from .airtable_oauth import (
    AirtableOAuthError,
    build_authorize_url,
    exchange_code_for_tokens,
)
from .vault import (
    VaultError,
    create_secret,
    delete_secret,
    get_secret,
    update_secret,
)

__all__ = [
    # Airtable OAuth
    "AirtableOAuthError",
    "build_authorize_url",
    "exchange_code_for_tokens",
    # Vault helpers
    "VaultError",
    "create_secret",
    "delete_secret",
    "get_secret",
    "update_secret",
]

