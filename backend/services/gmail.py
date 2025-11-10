"""Helpers for interacting with the Gmail API."""

from __future__ import annotations

import base64
from email.message import EmailMessage
from email.utils import formataddr
from typing import Optional, Sequence

import aiohttp

from ..config import Settings

TOKEN_URL = "https://oauth2.googleapis.com/token"
SEND_URL = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send"


class GmailError(RuntimeError):
    """Raised when a Gmail API interaction fails."""

    def __init__(self, message: str, *, status: Optional[int] = None) -> None:
        super().__init__(message)
        self.status = status


def _require_oauth_config(settings: Settings) -> None:
    if not settings.gmail_client_id or not settings.gmail_client_secret:
        raise GmailError("Gmail OAuth client configuration is missing")


def _encode_message(message: EmailMessage) -> str:
    raw_bytes = message.as_bytes()
    encoded = base64.urlsafe_b64encode(raw_bytes).decode("utf-8")
    return encoded.rstrip("=")


async def refresh_access_token(*, refresh_token: str, settings: Settings) -> dict[str, object]:
    """Refresh a Gmail access token using a stored refresh token."""

    _require_oauth_config(settings)

    payload = {
        "grant_type": "refresh_token",
        "refresh_token": refresh_token,
        "client_id": settings.gmail_client_id,
        "client_secret": settings.gmail_client_secret,
    }

    timeout = aiohttp.ClientTimeout(total=10.0)
    async with aiohttp.ClientSession(timeout=timeout) as session:
        async with session.post(TOKEN_URL, data=payload) as response:
            body_text = await response.text()
            if response.status != 200:
                raise GmailError(
                    f"Failed to refresh Gmail token (status {response.status}): {body_text}",
                    status=response.status,
                )
            return await response.json()


async def send_email(
    *,
    access_token: str,
    from_address: str,
    to_addresses: Sequence[str],
    subject: Optional[str],
    body: str,
    cc_addresses: Optional[Sequence[str]] = None,
    bcc_addresses: Optional[Sequence[str]] = None,
    sender_name: Optional[str] = None,
    reply_to: Optional[str] = None,
    body_is_html: bool = False,
) -> dict[str, object]:
    """Send an email via the Gmail API."""

    message = EmailMessage()

    message["From"] = formataddr((sender_name or "", from_address)) if sender_name else from_address
    message["To"] = ", ".join(to_addresses)
    if cc_addresses:
        message["Cc"] = ", ".join(cc_addresses)
    if bcc_addresses:
        message["Bcc"] = ", ".join(bcc_addresses)
    if reply_to:
        message["Reply-To"] = reply_to
    if subject:
        message["Subject"] = subject

    if body_is_html:
        message.set_content(body, subtype="html")
    else:
        message.set_content(body)

    payload = {"raw": _encode_message(message)}

    headers = {
        "Authorization": f"Bearer {access_token}",
        "Accept": "application/json",
        "Content-Type": "application/json",
    }

    timeout = aiohttp.ClientTimeout(total=10.0)
    async with aiohttp.ClientSession(timeout=timeout) as session:
        async with session.post(SEND_URL, json=payload, headers=headers) as response:
            content_type = response.headers.get("Content-Type", "")
            if "application/json" in content_type.lower():
                data = await response.json()
            else:
                data = {"raw": await response.text()}

            if response.status >= 400:
                message = data.get("error") if isinstance(data, dict) else None
                detail = (
                    message.get("message")
                    if isinstance(message, dict)
                    else "Gmail request failed."
                )
                raise GmailError(detail, status=response.status)

            return data
