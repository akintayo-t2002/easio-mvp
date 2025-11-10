"""Utility script to exercise Supabase Vault helpers end-to-end.

Run with the appropriate Supabase environment variables configured in
``.env.local`` or the shell.
"""

from __future__ import annotations

import argparse
import asyncio
import secrets
from datetime import datetime

from backend.config import get_settings
from backend.services import vault


async def _run(name_prefix: str, secret_value: str, description: str | None) -> None:
    settings = get_settings()

    print("Creating secret...")
    secret_id, created_at = await vault.create_secret(
        settings,
        name=name_prefix,
        secret=secret_value,
        description=description,
    )
    print(f"  ✓ Created {secret_id} at {created_at.isoformat()}")

    print("Reading secret back...")
    read_value = await vault.get_secret(settings, secret_id=secret_id)
    matches = "matches" if read_value == secret_value else "DIFFERS"
    print(f"  ✓ Retrieved value ({matches})")

    updated_secret = secret_value + "::updated"
    print("Updating secret...")
    _, updated_at = await vault.update_secret(
        settings,
        secret_id=secret_id,
        secret=updated_secret,
        description=description,
    )
    print(f"  ✓ Updated at {updated_at.isoformat()}")

    print("Reading updated secret...")
    read_updated = await vault.get_secret(settings, secret_id=secret_id)
    matches = "matches" if read_updated == updated_secret else "DIFFERS"
    print(f"  ✓ Retrieved updated value ({matches})")

    print("Deleting secret...")
    await vault.delete_secret(settings, secret_id=secret_id)
    print("  ✓ Delete request sent")


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Exercise Supabase Vault RPC wrappers")
    parser.add_argument(
        "--name",
        default=f"vault-diagnostic-{datetime.utcnow().isoformat(timespec='seconds')}",
        help="Secret name prefix to use",
    )
    parser.add_argument(
        "--secret",
        default=None,
        help="Secret value to store (defaults to a random token)",
    )
    parser.add_argument(
        "--description",
        default="Vault diagnostic secret",
        help="Optional description for the secret",
    )
    return parser.parse_args()


def main() -> None:
    args = _parse_args()
    secret_value = args.secret or secrets.token_urlsafe(32)
    asyncio.run(_run(args.name, secret_value, args.description))


if __name__ == "__main__":
    main()
