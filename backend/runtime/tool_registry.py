"""Registry for dynamic agent tool execution."""

from __future__ import annotations

import asyncio
import logging
import re
from datetime import datetime, timedelta, timezone
from email.utils import getaddresses
from typing import Any, Callable, Dict, Iterable, List, Optional, Sequence
from urllib.parse import quote
from uuid import UUID, uuid4

import aiohttp
from livekit.agents.llm.tool_context import ToolError, function_tool

from ..config import get_settings
from ..dependencies import get_supabase_client
from ..repositories.integrations_repo import IntegrationConnectionRepository
from ..services.airtable_oauth import AirtableOAuthError, refresh_access_token as airtable_refresh_access_token
from ..services.gmail import (
    GmailError,
    refresh_access_token as gmail_refresh_access_token,
    send_email as gmail_send_email,
)
from ..services.gmail_oauth import GmailOAuthError, fetch_userinfo
from ..services.vault import (
    VaultError,
    create_secret,
    get_secret,
    update_secret,
)
from .config import RuntimeToolParameterConfig, ToolConfig, WorkflowRuntimeConfig

logger = logging.getLogger(__name__)

ToolCallable = Callable[..., Any]
ToolBuilder = Callable[[ToolConfig, WorkflowRuntimeConfig], Optional[ToolCallable]]

TOOL_BUILDERS: Dict[str, ToolBuilder] = {}


def build_tool_functions(
    tools: Iterable[ToolConfig], workflow_config: WorkflowRuntimeConfig
) -> List[ToolCallable]:
    functions: List[ToolCallable] = []
    for tool in tools:
        builder = TOOL_BUILDERS.get(tool.tool_type)
        if not builder:
            logger.debug("No runtime handler for tool type %s", tool.tool_type)
            continue
        func = builder(tool, workflow_config)
        if func:
            functions.append(func)
    return functions


def _normalize_tool_name(base: str, tool_id: UUID) -> str:
    slug = re.sub(r"[^a-zA-Z0-9_]+", "_", base).strip("_").lower()
    if not slug:
        slug = "tool"
    return f"{slug}_{tool_id.hex[:8]}"


def _json_type(data_type: str, required: bool) -> Any:
    mapping = {
        "string": "string",
        "number": "number",
        "integer": "number",
        "boolean": "boolean",
        "object": "object",
        "array": "array",
    }
    base_type = mapping.get(data_type.lower(), "string")
    if required:
        return base_type
    return [base_type, "null"]


def _build_raw_schema(
    *,
    name: str,
    description: str,
    runtime_parameters: Sequence[RuntimeToolParameterConfig],
) -> dict[str, Any]:
    properties: Dict[str, Any] = {}
    required: List[str] = []
    for param in runtime_parameters:
        properties[param.name] = {
            "type": _json_type(param.data_type, param.required),
            "description": param.description,
        }
        if param.required:
            required.append(param.name)

    schema: dict[str, Any] = {
        "name": name,
        "description": description or "",
        "parameters": {
            "type": "object",
            "properties": properties,
            "additionalProperties": False,
        },
    }
    if required:
        schema["parameters"]["required"] = required
    return schema


def _validate_airtable_field_name(field_name: str) -> str:
    cleaned = field_name.strip()
    if not cleaned:
        raise ValueError("Field name cannot be empty.")

    if any(char in cleaned for char in "{}\"'\n\r\t"):
        raise ValueError("Field name contains invalid characters like braces or quotes.")

    return cleaned


def _escape_formula_literal(value: str) -> str:
    return value.replace("\"", "\"\"")


def _build_filter_formula(field_name: str, search_value: str) -> str:
    escaped_value = _escape_formula_literal(search_value)
    return f'{{{field_name}}} = "{escaped_value}"'


def _resolve_max_records(raw_value: Any) -> int:
    default = 1
    maximum = 20

    if raw_value is None:
        return default

    parsed: Optional[int] = None
    if isinstance(raw_value, int):
        parsed = raw_value
    elif isinstance(raw_value, str):
        stripped = raw_value.strip()
        if stripped:
            try:
                parsed = int(stripped)
            except ValueError:
                parsed = None

    if parsed is None:
        return default

    if parsed < 1:
        return default

    if parsed > maximum:
        return maximum

    return parsed


async def _run_in_thread(func: Callable[..., Any], *args: Any, **kwargs: Any) -> Any:
    return await asyncio.to_thread(func, *args, **kwargs)


async def _get_connection(
    repo: IntegrationConnectionRepository,
    organization_id: UUID,
    provider: str,
    friendly_name: Optional[str] = None,
) -> Any:
    connection = await _run_in_thread(repo.get_connection, organization_id, provider)
    if not connection:
        name = friendly_name or provider.capitalize()
        raise ToolError(f"{name} is not connected for this organization.")
    return connection


async def _load_secret(secret_id: Optional[UUID]) -> Optional[str]:
    if not secret_id:
        return None
    settings = get_settings()
    try:
        return await get_secret(settings, secret_id=str(secret_id))
    except VaultError as exc:
        logger.warning("Failed to read Airtable secret %s: %s", secret_id, exc)
        raise ToolError("Unable to load Airtable credentials.") from exc


async def _store_access_token(
    *,
    organization_id: UUID,
    repo: IntegrationConnectionRepository,
    connection: Any,
    access_token: str,
    expires_at: Optional[datetime],
    provider: str,
) -> str:
    settings = get_settings()
    secret_id = getattr(connection, "access_token_secret_id", None)
    created_at: datetime | None = None

    if secret_id:
        try:
            _, created_at = await update_secret(
                settings, secret_id=str(secret_id), secret=access_token
            )
        except VaultError as exc:
            logger.warning("Failed to update Airtable access token secret: %s", exc)
            raise ToolError("Unable to update Airtable credentials.") from exc
        access_secret_id = str(secret_id)
    else:
        slug = provider.replace(".", "-")
        secret_name = f"{slug}-access-{organization_id}-{uuid4()}"
        description = f"{provider.capitalize()} access token for org {organization_id}"
        try:
            access_secret_id, created_at = await create_secret(
                settings,
                name=secret_name,
                secret=access_token,
                description=description,
            )
        except VaultError as exc:
            logger.warning("Failed to store Airtable access token: %s", exc)
            raise ToolError("Unable to persist Airtable credentials.") from exc

    await _run_in_thread(
        repo.upsert_connection,
        organization_id,
        provider,
        access_token=None,
        refresh_token=None,
        access_token_secret_id=access_secret_id,
        access_token_secret_created_at=created_at,
        expires_at=expires_at,
    )
    return access_secret_id


async def _store_refresh_token(
    *,
    organization_id: UUID,
    repo: IntegrationConnectionRepository,
    connection: Any,
    refresh_token: str,
    provider: str,
) -> str:
    settings = get_settings()
    secret_id = getattr(connection, "refresh_token_secret_id", None)
    created_at: datetime | None = None

    if secret_id:
        try:
            _, created_at = await update_secret(
                settings, secret_id=str(secret_id), secret=refresh_token
            )
        except VaultError as exc:
            logger.warning("Failed to update Airtable refresh token secret: %s", exc)
            raise ToolError("Unable to update Airtable credentials.") from exc
        refresh_secret_id = str(secret_id)
    else:
        slug = provider.replace(".", "-")
        secret_name = f"{slug}-refresh-{organization_id}-{uuid4()}"
        description = f"{provider.capitalize()} refresh token for org {organization_id}"
        try:
            refresh_secret_id, created_at = await create_secret(
                settings,
                name=secret_name,
                secret=refresh_token,
                description=description,
            )
        except VaultError as exc:
            logger.warning("Failed to store Airtable refresh token: %s", exc)
            raise ToolError("Unable to persist Airtable credentials.") from exc

    await _run_in_thread(
        repo.upsert_connection,
        organization_id,
        provider,
        access_token=None,
        refresh_token=None,
        refresh_token_secret_id=refresh_secret_id,
        refresh_token_secret_created_at=created_at,
    )
    return refresh_secret_id


async def _refresh_airtable_token(
    *,
    organization_id: UUID,
    repo: IntegrationConnectionRepository,
    connection: Any,
    refresh_token: str,
) -> tuple[str, Optional[datetime]]:
    settings = get_settings()
    try:
        response = await airtable_refresh_access_token(refresh_token=refresh_token, settings=settings)
    except AirtableOAuthError as exc:
        raise ToolError("Failed to refresh Airtable access token.") from exc

    access_token = response.get("access_token")
    if not isinstance(access_token, str) or not access_token:
        raise ToolError("Airtable did not return an access token.")

    expires_in = response.get("expires_in")
    expires_at = None
    if isinstance(expires_in, (int, float)):
        expires_at = datetime.now(timezone.utc) + timedelta(seconds=int(expires_in))

    await _store_access_token(
        organization_id=organization_id,
        repo=repo,
        connection=connection,
        access_token=access_token,
        expires_at=expires_at,
        provider="airtable",
    )

    new_refresh_token = response.get("refresh_token")
    if isinstance(new_refresh_token, str) and new_refresh_token:
        try:
            await _store_refresh_token(
                organization_id=organization_id,
                repo=repo,
                connection=connection,
                refresh_token=new_refresh_token,
                provider="airtable",
            )
        except ToolError:
            logger.warning("Failed to store rotated Airtable refresh token; keeping previous token.")
    return access_token, expires_at


async def _resolve_airtable_access_token(
    *,
    organization_id: UUID,
    repo: IntegrationConnectionRepository,
    connection: Any,
) -> str:
    now = datetime.now(timezone.utc)
    access_token = await _load_secret(getattr(connection, "access_token_secret_id", None))
    refresh_token = await _load_secret(getattr(connection, "refresh_token_secret_id", None))

    should_refresh = False
    expires_at = getattr(connection, "expires_at", None)
    if expires_at and isinstance(expires_at, datetime):
        should_refresh = expires_at <= now + timedelta(seconds=30)

    if not access_token:
        should_refresh = True

    if should_refresh:
        if not refresh_token:
            raise ToolError("Airtable refresh token is missing; reconnect the integration.")
        access_token, _ = await _refresh_airtable_token(
            organization_id=organization_id,
            repo=repo,
            connection=connection,
            refresh_token=refresh_token,
        )
    return access_token


def _resolve_max_recipients(raw_value: Any) -> int:
    default = 5
    maximum = 20

    if raw_value is None:
        return default

    parsed: Optional[int] = None
    if isinstance(raw_value, int):
        parsed = raw_value
    elif isinstance(raw_value, str):
        stripped = raw_value.strip()
        if stripped:
            try:
                parsed = int(stripped)
            except ValueError:
                parsed = None

    if parsed is None:
        return default

    if parsed < 1:
        return default

    if parsed > maximum:
        return maximum

    return parsed


def _validate_config_email(value: Any, *, field: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"Configuration '{field}' must be a non-empty string.")
    address = value.strip()
    if "@" not in address or address.startswith("@") or address.endswith("@"):
        raise ValueError(f"Configuration '{field}' must be a valid email address.")
    return address


def _optional_config_email(value: Any, *, field: str) -> Optional[str]:
    if value is None or (isinstance(value, str) and not value.strip()):
        return None
    return _validate_config_email(value, field=field)


def _coerce_config_bool(value: Any, *, field: str) -> Optional[bool]:
    if value is None:
        return None
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        lowered = value.strip().lower()
        if lowered in {"true", "1", "yes"}:
            return True
        if lowered in {"false", "0", "no"}:
            return False
    raise ValueError(f"Configuration '{field}' must be a boolean value.")


def _parse_email_addresses(
    raw_value: Optional[Any],
    *,
    field: str,
    required: bool,
) -> List[str]:
    if raw_value is None:
        if required:
            raise ToolError(f"Parameter '{field}' is required.")
        return []

    if not isinstance(raw_value, str):
        raise ToolError(f"Parameter '{field}' must be provided as a string.")

    addresses = [addr.strip() for _, addr in getaddresses([raw_value]) if addr.strip()]

    if not addresses:
        if required:
            raise ToolError(f"Parameter '{field}' must include at least one email address.")
        return []

    for address in addresses:
        if "@" not in address or address.startswith("@") or address.endswith("@"):
            raise ToolError(f"Parameter '{field}' contains an invalid email address: {address}.")

    return addresses


def _get_string_argument(
    arguments: dict[str, Any],
    *,
    field: str,
    required: bool,
) -> Optional[str]:
    value = arguments.get(field)
    if value is None:
        if required:
            raise ToolError(f"Parameter '{field}' is required.")
        return None
    if not isinstance(value, str):
        raise ToolError(f"Parameter '{field}' must be provided as a string.")
    stripped = value.strip()
    if required and not stripped:
        raise ToolError(f"Parameter '{field}' cannot be empty.")
    return stripped or None


def _get_boolean_argument(
    arguments: dict[str, Any],
    *,
    field: str,
) -> Optional[bool]:
    value = arguments.get(field)
    if value is None:
        return None
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        lowered = value.strip().lower()
        if lowered in {"true", "1", "yes"}:
            return True
        if lowered in {"false", "0", "no"}:
            return False
    raise ToolError(f"Parameter '{field}' must be a boolean value.")


async def _refresh_gmail_token(
    *,
    organization_id: UUID,
    repo: IntegrationConnectionRepository,
    connection: Any,
    refresh_token: str,
) -> tuple[str, Optional[datetime]]:
    settings = get_settings()
    try:
        response = await gmail_refresh_access_token(
            refresh_token=refresh_token,
            settings=settings,
        )
    except GmailError as exc:
        raise ToolError("Failed to refresh Gmail access token.") from exc

    access_token = response.get("access_token")
    if not isinstance(access_token, str) or not access_token:
        raise ToolError("Gmail did not return an access token.")

    expires_in = response.get("expires_in")
    expires_at = None
    if isinstance(expires_in, (int, float)):
        expires_at = datetime.now(timezone.utc) + timedelta(seconds=int(expires_in))

    await _store_access_token(
        organization_id=organization_id,
        repo=repo,
        connection=connection,
        access_token=access_token,
        expires_at=expires_at,
        provider="gmail",
    )

    new_refresh_token = response.get("refresh_token")
    if isinstance(new_refresh_token, str) and new_refresh_token:
        try:
            await _store_refresh_token(
                organization_id=organization_id,
                repo=repo,
                connection=connection,
                refresh_token=new_refresh_token,
                provider="gmail",
            )
        except ToolError:
            logger.warning("Failed to store rotated Gmail refresh token; keeping previous token.")

    return access_token, expires_at


async def _resolve_gmail_access_token(
    *,
    organization_id: UUID,
    repo: IntegrationConnectionRepository,
    connection: Any,
) -> str:
    now = datetime.now(timezone.utc)
    access_token = await _load_secret(getattr(connection, "access_token_secret_id", None))
    refresh_token = await _load_secret(getattr(connection, "refresh_token_secret_id", None))

    should_refresh = False
    expires_at = getattr(connection, "expires_at", None)
    if expires_at and isinstance(expires_at, datetime):
        should_refresh = expires_at <= now + timedelta(seconds=30)

    if not access_token:
        should_refresh = True

    if should_refresh:
        if not refresh_token:
            raise ToolError("Gmail refresh token is missing; reconnect the integration.")
        access_token, _ = await _refresh_gmail_token(
            organization_id=organization_id,
            repo=repo,
            connection=connection,
            refresh_token=refresh_token,
        )
    return access_token


async def _call_airtable(
    *,
    access_token: str,
    base_id: str,
    table_id: str,
    field_name: str,
    search_value: str,
    max_records: int,
) -> dict[str, Any]:
    timeout = aiohttp.ClientTimeout(total=10.0)
    url_base = quote(base_id, safe="")
    url_table = quote(table_id, safe="")
    url = f"https://api.airtable.com/v0/{url_base}/{url_table}"

    formula = _build_filter_formula(field_name, search_value)
    params = {
        "filterByFormula": formula,
        "maxRecords": max_records,
    }

    headers = {
        "Authorization": f"Bearer {access_token}",
        "Accept": "application/json",
    }

    async with aiohttp.ClientSession(timeout=timeout) as session:
        async with session.get(url, headers=headers, params=params) as response:
            content_type = response.headers.get("Content-Type", "")
            if "application/json" in content_type.lower():
                payload = await response.json()
            else:
                payload = {"raw": await response.text()}

            if response.status == 200:
                return payload

            if response.status in {401, 403}:
                raise ToolError("unauthorized")

            message = payload.get("error") if isinstance(payload, dict) else None
            raise ToolError(
                message.get("message") if isinstance(message, dict) else "Airtable request failed."
            )


def _build_airtable_find_record_tool(
    tool_config: ToolConfig, workflow_config: WorkflowRuntimeConfig
) -> Optional[ToolCallable]:
    base_id = tool_config.config.get("baseId")
    table_id = tool_config.config.get("tableId")
    if not isinstance(base_id, str) or not base_id:
        logger.warning("Airtable tool missing baseId; skipping registration")
        return None
    if not isinstance(table_id, str) or not table_id:
        logger.warning("Airtable tool missing tableId; skipping registration")
        return None

    field_name = tool_config.config.get("fieldName") or tool_config.config.get("field")
    if not isinstance(field_name, str) or not field_name.strip():
        logger.warning(
            "Airtable tool missing fieldName; skipping registration",
            extra={"tool_id": str(tool_config.id), "tool_type": tool_config.tool_type},
        )
        return None
    try:
        field_name = _validate_airtable_field_name(field_name)
    except ValueError as exc:
        logger.warning(
            "Airtable tool has invalid fieldName; skipping registration",
            extra={
                "tool_id": str(tool_config.id),
                "tool_type": tool_config.tool_type,
                "reason": str(exc),
            },
        )
        return None

    max_records = _resolve_max_records(tool_config.config.get("maxRecords"))

    runtime_parameters = list(tool_config.runtime_parameters)

    search_param: Optional[RuntimeToolParameterConfig] = None
    for param in runtime_parameters:
        if param.name.lower() in {"searchvalue", "search_value", "value", "lookupvalue", "recordvalue"}:
            search_param = param
            break

    if search_param:
        description = search_param.description or "Provide the value to search for."
        search_param = RuntimeToolParameterConfig(
            name=search_param.name,
            description=description,
            required=True,
            data_type="string",
        )
    else:
        search_param = RuntimeToolParameterConfig(
            name="searchValue",
            description="Value provided by the caller to look up a record.",
            required=True,
            data_type="string",
        )

    description = tool_config.llm_description or (
        tool_config.display_name or "Use this Airtable operation when appropriate."
    )
    tool_name = _normalize_tool_name(tool_config.tool_type.replace(".", "_"), tool_config.id)

    schema = _build_raw_schema(
        name=tool_name,
        description=description,
        runtime_parameters=[search_param],
    )

    repo = IntegrationConnectionRepository(get_supabase_client())
    organization_id = workflow_config.organization_id

    @function_tool(raw_schema=schema)
    async def airtable_find_record(
        self,
        raw_arguments: dict[str, Any],
    ) -> dict[str, Any]:
        if not isinstance(raw_arguments, dict):
            raise ToolError("Invalid arguments payload.")

        search_value_value = raw_arguments.get(search_param.name)
        if not isinstance(search_value_value, str) or not search_value_value.strip():
            raise ToolError(f"Parameter '{search_param.name}' is required.")
        search_value_clean = search_value_value.strip()

        field_name_clean = field_name

        connection = await _get_connection(repo, organization_id, "airtable", "Airtable")
        access_token = await _resolve_airtable_access_token(
            organization_id=organization_id,
            repo=repo,
            connection=connection,
        )

        try:
            payload = await _call_airtable(
                access_token=access_token,
                base_id=base_id,
                table_id=table_id,
                field_name=field_name_clean,
                search_value=search_value_clean,
                max_records=max_records,
            )
        except ToolError as exc:
            if str(exc) == "unauthorized":
                refresh_token = await _load_secret(
                    getattr(connection, "refresh_token_secret_id", None)
                )
                if not refresh_token:
                    raise ToolError("Airtable credentials expired; reconnect the integration.")
                access_token, _ = await _refresh_airtable_token(
                    organization_id=organization_id,
                    repo=repo,
                    connection=connection,
                    refresh_token=refresh_token,
                )
                payload = await _call_airtable(
                    access_token=access_token,
                    base_id=base_id,
                    table_id=table_id,
                    field_name=field_name_clean,
                    search_value=search_value_clean,
                    max_records=max_records,
                )
            else:
                raise

        records = payload.get("records") if isinstance(payload, dict) else None
        count = len(records) if isinstance(records, list) else 0

        return {
            "matched": count > 0,
            "count": count,
            "records": records or [],
            "baseId": base_id,
            "tableId": table_id,
            "fieldName": field_name_clean,
            "searchValue": search_value_clean,
            "maxRecords": max_records,
        }

    airtable_find_record.__name__ = tool_name
    return airtable_find_record


TOOL_BUILDERS["airtable.find_record_by_field"] = _build_airtable_find_record_tool


def _find_runtime_parameter(
    parameters: Sequence[RuntimeToolParameterConfig],
    aliases: Iterable[str],
) -> Optional[RuntimeToolParameterConfig]:
    alias_set = {alias.lower() for alias in aliases}
    for param in parameters:
        if param.name.lower() in alias_set:
            return param
    return None


def _normalize_runtime_parameter(
    existing: Optional[RuntimeToolParameterConfig],
    *,
    fallback_name: str,
    description: str,
    required: bool,
    data_type: str,
) -> RuntimeToolParameterConfig:
    if existing:
        return RuntimeToolParameterConfig(
            name=existing.name,
            description=existing.description or description,
            required=required,
            data_type=data_type,
        )
    return RuntimeToolParameterConfig(
        name=fallback_name,
        description=description,
        required=required,
        data_type=data_type,
    )


async def _resolve_gmail_profile_email(
    *,
    connection: Any,
    repo: IntegrationConnectionRepository,
    organization_id: UUID,
    access_token: str,
) -> tuple[Optional[str], str]:
    existing_email = getattr(connection, "profile_email", None)
    if isinstance(existing_email, str) and existing_email:
        return existing_email, access_token

    try:
        userinfo = await fetch_userinfo(access_token=access_token)
    except GmailOAuthError as exc:
        logger.debug("Failed to fetch Gmail profile email: %s", exc)
        raise

    email = userinfo.get("email") if isinstance(userinfo, dict) else None
    if isinstance(email, str) and email:
        try:
            await _run_in_thread(
                repo.upsert_connection,
                organization_id,
                "gmail",
                profile_email=email,
            )
        except Exception as exc:  # pragma: no cover - defensive logging only
            logger.warning(
                "Failed to persist Gmail profile email",
                extra={
                    "organization_id": str(organization_id),
                    "connection_id": getattr(connection, "id", None),
                    "error": str(exc),
                },
            )
        return email, access_token

    return None, access_token


def _build_gmail_send_email_tool(
    tool_config: ToolConfig, workflow_config: WorkflowRuntimeConfig
) -> Optional[ToolCallable]:
    config = tool_config.config

    try:
        from_address_override = _optional_config_email(
            config.get("fromAddress"), field="fromAddress"
        )
    except ValueError as exc:
        logger.warning(
            "Gmail tool has invalid fromAddress override; skipping registration",
            extra={"tool_id": str(tool_config.id), "reason": str(exc)},
        )
        return None

    try:
        reply_to = _optional_config_email(config.get("replyTo"), field="replyTo")
    except ValueError as exc:
        logger.warning(
            "Gmail tool has invalid replyTo; skipping registration",
            extra={"tool_id": str(tool_config.id), "reason": str(exc)},
        )
        return None

    sender_name = config.get("senderName") if isinstance(config.get("senderName"), str) else None
    default_subject = (
        config.get("defaultSubject") if isinstance(config.get("defaultSubject"), str) else None
    )
    default_body = config.get("defaultBody") if isinstance(config.get("defaultBody"), str) else None

    try:
        body_is_html_default = _coerce_config_bool(
            config.get("defaultBodyIsHtml"), field="defaultBodyIsHtml"
        )
    except ValueError as exc:
        logger.warning(
            "Gmail tool has invalid defaultBodyIsHtml; skipping registration",
            extra={"tool_id": str(tool_config.id), "reason": str(exc)},
        )
        return None

    max_recipients = _resolve_max_recipients(config.get("maxRecipients"))

    runtime_parameters = list(tool_config.runtime_parameters)

    to_param_src = _find_runtime_parameter(
        runtime_parameters,
        [
            "to",
            "recipient",
            "toaddress",
            "to_address",
            "recipientemail",
            "recipient_email",
            "toemail",
            "to_email",
        ],
    )
    subject_param_src = _find_runtime_parameter(
        runtime_parameters,
        ["subject", "email_subject", "subjectline", "subject_line", "emailsubject"],
    )
    body_param_src = _find_runtime_parameter(
        runtime_parameters,
        [
            "body",
            "message",
            "email_body",
            "bodytext",
            "body_text",
            "messagebody",
            "message_body",
            "emailbody",
        ],
    )
    cc_param_src = _find_runtime_parameter(
        runtime_parameters,
        ["cc", "ccaddress", "cc_address", "ccemails", "cc_emails"],
    )
    bcc_param_src = _find_runtime_parameter(
        runtime_parameters,
        ["bcc", "bccaddress", "bcc_address", "bccemails", "bcc_emails"],
    )
    html_param_src = _find_runtime_parameter(
        runtime_parameters,
        ["ishtml", "bodyishtml", "html", "body_is_html", "html_body", "use_html"],
    )

    to_param = _normalize_runtime_parameter(
        to_param_src,
        fallback_name="to",
        description="Comma-separated email addresses for the primary recipients.",
        required=True,
        data_type="string",
    )
    subject_param = _normalize_runtime_parameter(
        subject_param_src,
        fallback_name="subject",
        description="Subject line for the email.",
        required=default_subject is None,
        data_type="string",
    )
    body_param = _normalize_runtime_parameter(
        body_param_src,
        fallback_name="body",
        description="Body content of the email.",
        required=default_body is None,
        data_type="string",
    )
    cc_param = _normalize_runtime_parameter(
        cc_param_src,
        fallback_name="cc",
        description="Optional comma-separated CC recipients.",
        required=False,
        data_type="string",
    )
    bcc_param = _normalize_runtime_parameter(
        bcc_param_src,
        fallback_name="bcc",
        description="Optional comma-separated BCC recipients.",
        required=False,
        data_type="string",
    )
    html_param = _normalize_runtime_parameter(
        html_param_src,
        fallback_name="bodyIsHtml",
        description="Set to true if the body content is HTML.",
        required=False,
        data_type="boolean",
    )

    # Preserve any additional runtime parameters the user configured.
    handled_names = {
        to_param.name.lower(),
        subject_param.name.lower(),
        body_param.name.lower(),
        cc_param.name.lower(),
        bcc_param.name.lower(),
        html_param.name.lower(),
    }

    extra_parameters = [
        RuntimeToolParameterConfig(
            name=param.name,
            description=param.description,
            required=param.required,
            data_type=param.data_type,
        )
        for param in runtime_parameters
        if param.name.lower() not in handled_names
    ]

    description = tool_config.llm_description or (
        tool_config.display_name or "Send an email through the connected Gmail account."
    )
    tool_name = _normalize_tool_name(tool_config.tool_type.replace(".", "_"), tool_config.id)

    schema_parameters: List[RuntimeToolParameterConfig] = [
        to_param,
        subject_param,
        body_param,
        cc_param,
        bcc_param,
        html_param,
        *extra_parameters,
    ]

    schema = _build_raw_schema(
        name=tool_name,
        description=description,
        runtime_parameters=schema_parameters,
    )

    repo = IntegrationConnectionRepository(get_supabase_client())
    organization_id = workflow_config.organization_id

    @function_tool(raw_schema=schema)
    async def gmail_send_email_tool(
        self,
        raw_arguments: dict[str, Any],
    ) -> dict[str, Any]:
        if not isinstance(raw_arguments, dict):
            raise ToolError("Invalid arguments payload.")

        to_value = _get_string_argument(raw_arguments, field=to_param.name, required=True)
        subject_value = _get_string_argument(
            raw_arguments, field=subject_param.name, required=subject_param.required
        )
        body_value = _get_string_argument(
            raw_arguments, field=body_param.name, required=body_param.required
        )
        cc_value = _get_string_argument(raw_arguments, field=cc_param.name, required=False)
        bcc_value = _get_string_argument(raw_arguments, field=bcc_param.name, required=False)
        html_value = _get_boolean_argument(raw_arguments, field=html_param.name)

        to_addresses = _parse_email_addresses(to_value, field=to_param.name, required=True)
        cc_addresses = _parse_email_addresses(cc_value, field=cc_param.name, required=False)
        bcc_addresses = _parse_email_addresses(bcc_value, field=bcc_param.name, required=False)

        total_recipients = len(to_addresses) + len(cc_addresses) + len(bcc_addresses)
        if total_recipients == 0:
            raise ToolError("At least one recipient email address must be provided.")
        if total_recipients > max_recipients:
            raise ToolError(
                f"Too many recipients provided. Limit is {max_recipients} for this tool."
            )

        subject_final = subject_value or default_subject
        body_final = body_value or default_body

        if body_final is None:
            raise ToolError(f"Parameter '{body_param.name}' is required.")

        body_is_html = html_value
        if body_is_html is None:
            body_is_html = body_is_html_default or False

        connection = await _get_connection(repo, organization_id, "gmail", "Gmail")
        access_token = await _resolve_gmail_access_token(
            organization_id=organization_id,
            repo=repo,
            connection=connection,
        )

        from_address_effective = from_address_override
        if not from_address_effective:
            try:
                resolved_email, access_token = await _resolve_gmail_profile_email(
                    connection=connection,
                    repo=repo,
                    organization_id=organization_id,
                    access_token=access_token,
                )
            except GmailOAuthError:
                refresh_token = await _load_secret(
                    getattr(connection, "refresh_token_secret_id", None)
                )
                if not refresh_token:
                    raise ToolError(
                        "Gmail credentials expired; reconnect the integration."
                    )
                access_token, _ = await _refresh_gmail_token(
                    organization_id=organization_id,
                    repo=repo,
                    connection=connection,
                    refresh_token=refresh_token,
                )
                resolved_email, access_token = await _resolve_gmail_profile_email(
                    connection=connection,
                    repo=repo,
                    organization_id=organization_id,
                    access_token=access_token,
                )

            from_address_effective = resolved_email

        if not from_address_effective:
            raise ToolError(
                "Unable to determine a Gmail sender address. Specify a 'fromAddress' override or reconnect the Gmail integration."
            )

        try:
            response = await gmail_send_email(
                access_token=access_token,
                from_address=from_address_effective,
                to_addresses=to_addresses,
                cc_addresses=cc_addresses,
                bcc_addresses=bcc_addresses,
                subject=subject_final,
                body=body_final,
                sender_name=sender_name,
                reply_to=reply_to,
                body_is_html=body_is_html,
            )
        except GmailError as exc:
            if exc.status in {401, 403}:
                refresh_token = await _load_secret(
                    getattr(connection, "refresh_token_secret_id", None)
                )
                if not refresh_token:
                    raise ToolError("Gmail credentials expired; reconnect the integration.")
                access_token, _ = await _refresh_gmail_token(
                    organization_id=organization_id,
                    repo=repo,
                    connection=connection,
                    refresh_token=refresh_token,
                )
                if not from_address_override:
                    try:
                        resolved_email, access_token = await _resolve_gmail_profile_email(
                            connection=connection,
                            repo=repo,
                            organization_id=organization_id,
                            access_token=access_token,
                        )
                        if resolved_email:
                            from_address_effective = resolved_email
                    except GmailOAuthError:
                        pass
                response = await gmail_send_email(
                    access_token=access_token,
                    from_address=from_address_effective,
                    to_addresses=to_addresses,
                    cc_addresses=cc_addresses,
                    bcc_addresses=bcc_addresses,
                    subject=subject_final,
                    body=body_final,
                    sender_name=sender_name,
                    reply_to=reply_to,
                    body_is_html=body_is_html,
                )
            else:
                raise ToolError(str(exc)) from exc

        return {
            "status": "sent",
            "messageId": response.get("id"),
            "threadId": response.get("threadId"),
            "labelIds": response.get("labelIds", []),
            "fromAddress": from_address_effective,
            "to": to_addresses,
            "cc": cc_addresses,
            "bcc": bcc_addresses,
            "subject": subject_final,
            "bodyIsHtml": body_is_html,
        }

    gmail_send_email_tool.__name__ = tool_name
    return gmail_send_email_tool


TOOL_BUILDERS["gmail.send_email"] = _build_gmail_send_email_tool
