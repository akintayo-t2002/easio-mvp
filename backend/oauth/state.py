"""Utilities for signing and validating OAuth state tokens."""

from __future__ import annotations

import base64
import hmac
import json
import secrets
import time
from hashlib import sha256
from typing import Any, Dict, Optional
from uuid import UUID


class StateTokenError(ValueError):
    """Raised when an OAuth state token cannot be validated."""


def _b64encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("utf-8").rstrip("=")


def _b64decode(token: str) -> bytes:
    padding = "=" * (-len(token) % 4)
    return base64.urlsafe_b64decode(token + padding)


def generate_state_token(
    organization_id: UUID,
    secret_key: str,
    *,
    redirect_url: Optional[str] = None,
    ttl_seconds: int = 300,
    extra: Optional[Dict[str, Any]] = None,
) -> str:
    """Create a signed state token embedding the organization and redirect info."""

    if not secret_key:
        raise StateTokenError("OAuth state secret is not configured")

    payload: Dict[str, Any] = {
        "org": str(organization_id),
        "exp": int(time.time()) + ttl_seconds,
        "nonce": secrets.token_urlsafe(8),
    }
    if redirect_url:
        payload["redirect"] = redirect_url
    if extra:
        payload.update(extra)

    raw = json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8")
    signature = hmac.new(secret_key.encode("utf-8"), raw, sha256).digest()
    return f"{_b64encode(raw)}.{_b64encode(signature)}"


def verify_state_token(token: str, secret_key: str) -> Dict[str, Any]:
    """Validate and deserialize a state token."""

    if not secret_key:
        raise StateTokenError("OAuth state secret is not configured")

    try:
        raw_part, sig_part = token.split(".", 1)
    except ValueError as exc:  # pragma: no cover - defensive
        raise StateTokenError("Malformed state token") from exc

    raw_bytes = _b64decode(raw_part)
    expected_sig = hmac.new(secret_key.encode("utf-8"), raw_bytes, sha256).digest()
    provided_sig = _b64decode(sig_part)

    if not hmac.compare_digest(expected_sig, provided_sig):
        raise StateTokenError("Invalid state signature")

    payload = json.loads(raw_bytes.decode("utf-8"))

    if payload.get("exp") is None or int(payload["exp"]) < int(time.time()):
        raise StateTokenError("State token has expired")

    return payload
