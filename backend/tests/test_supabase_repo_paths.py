from types import SimpleNamespace
from unittest.mock import MagicMock
from uuid import uuid4

import pytest

from backend.repositories.supabase_repo import SupabaseWorkflowRepository
from backend.schemas import AgentPathUpdateRequest, PathVariableUpdateRequest


pytestmark = pytest.mark.anyio


@pytest.fixture
def anyio_backend() -> str:
    return "asyncio"


def _build_repo_chain(client, method: str, *, result_payload: dict):
    table_mock = client.table.return_value
    method_mock = getattr(table_mock, method)
    method_return = method_mock.return_value
    eq_mock = method_return.eq.return_value
    eq_mock.execute.return_value = SimpleNamespace(data=[result_payload])

    return table_mock, method_mock, eq_mock


async def test_update_path_includes_metadata_fields():
    client = MagicMock()
    repo = SupabaseWorkflowRepository(client)
    path_id = uuid4()

    payload = AgentPathUpdateRequest(
        name="Escalate",
        description="Send to tier 2",
        guard_condition="needs_manager",
        metadata={"hideEdge": True, "transferMessage": "Escalating"},
    )

    response_payload = {
        "id": str(path_id),
        "from_agent_id": str(uuid4()),
        "to_agent_id": str(uuid4()),
        "name": payload.name,
        "description": payload.description,
        "guard_condition": payload.guard_condition,
        "metadata": payload.metadata,
        "created_at": "2024-01-01T00:00:00Z",
    }

    table_mock, update_mock, eq_mock = _build_repo_chain(
        client,
        "update",
        result_payload=response_payload,
    )

    result = await repo.update_path(path_id, payload)

    assert result is not None
    client.table.assert_called_with("agent_path")
    update_mock.assert_called_once()
    args, _ = update_mock.call_args
    assert args[0] == payload.model_dump(exclude_none=True)
    eq_mock.execute.assert_called_once()


async def test_update_path_variable_sends_fields():
    client = MagicMock()
    repo = SupabaseWorkflowRepository(client)
    variable_id = uuid4()

    payload = PathVariableUpdateRequest(
        name="caseId",
        description="Unique case identifier",
        data_type="number",
    )

    response_payload = {
        "id": str(variable_id),
        "path_id": str(uuid4()),
        "name": payload.name,
        "description": payload.description,
        "is_required": True,
        "data_type": payload.data_type,
        "created_at": "2024-01-01T00:00:00Z",
    }

    table_mock, update_mock, eq_mock = _build_repo_chain(
        client,
        "update",
        result_payload=response_payload,
    )

    result = await repo.update_path_variable(variable_id, payload)

    assert result is not None
    client.table.assert_called_with("path_variable")
    args, _ = update_mock.call_args
    assert args[0] == payload.model_dump(exclude_none=True)
    eq_mock.execute.assert_called_once()


async def test_delete_path_variable_returns_bool():
    client = MagicMock()
    repo = SupabaseWorkflowRepository(client)
    variable_id = uuid4()

    delete_mock = client.table.return_value.delete.return_value
    eq_mock = delete_mock.eq.return_value
    eq_mock.execute.return_value = SimpleNamespace(data=[{"id": str(variable_id)}])

    result = await repo.delete_path_variable(variable_id)

    assert result is True
    client.table.assert_called_with("path_variable")
    delete_mock.eq.assert_called_once()
