from datetime import UTC, datetime
from unittest.mock import AsyncMock
from uuid import UUID, uuid4

import pytest
from fastapi import HTTPException

from backend.repositories.supabase_repo import SupabaseWorkflowRepository
from backend.routes import delete_path_variable, update_path, update_path_variable
from backend.schemas import (
    AgentPathResponse,
    AgentPathUpdateRequest,
    PathVariableResponse,
    PathVariableUpdateRequest,
)


pytestmark = pytest.mark.anyio


@pytest.fixture
def anyio_backend() -> str:
    return "asyncio"


def _make_agent_path_response(path_id: UUID) -> AgentPathResponse:
    return AgentPathResponse(
        id=path_id,
        from_agent_id=uuid4(),
        to_agent_id=uuid4(),
        name="Escalate",
        description="Escalate to supervisor",
        guard_condition="needs_manager",
        metadata={"hideEdge": False},
        created_at=datetime.now(UTC),
    )


def _make_path_variable_response(variable_id: UUID, path_id: UUID) -> PathVariableResponse:
    return PathVariableResponse(
        id=variable_id,
        path_id=path_id,
        name="caseId",
        description="ID of the case",
        is_required=True,
        data_type="string",
        created_at=datetime.now(UTC),
    )


async def test_update_path_returns_repo_value():
    repo = AsyncMock(spec=SupabaseWorkflowRepository)
    path_id = uuid4()
    payload = AgentPathUpdateRequest(name="Escalate to manager")
    expected = _make_agent_path_response(path_id)
    repo.update_path.return_value = expected

    result = await update_path(path_id, payload, repo=repo)

    assert result == expected
    repo.update_path.assert_awaited_once_with(path_id, payload)


async def test_update_path_raises_404_when_missing():
    repo = AsyncMock(spec=SupabaseWorkflowRepository)
    path_id = uuid4()
    payload = AgentPathUpdateRequest(name="Escalate")
    repo.update_path.return_value = None

    with pytest.raises(HTTPException) as exc:
        await update_path(path_id, payload, repo=repo)

    assert exc.value.status_code == 404
    repo.update_path.assert_awaited_once_with(path_id, payload)


async def test_update_path_variable_returns_repo_value():
    repo = AsyncMock(spec=SupabaseWorkflowRepository)
    variable_id = uuid4()
    path_id = uuid4()
    payload = PathVariableUpdateRequest(description="Updated")
    expected = _make_path_variable_response(variable_id, path_id)
    repo.update_path_variable.return_value = expected

    result = await update_path_variable(variable_id, payload, repo=repo)

    assert result == expected
    repo.update_path_variable.assert_awaited_once_with(variable_id, payload)


async def test_update_path_variable_raises_404_when_missing():
    repo = AsyncMock(spec=SupabaseWorkflowRepository)
    variable_id = uuid4()
    payload = PathVariableUpdateRequest(name="ticketId")
    repo.update_path_variable.return_value = None

    with pytest.raises(HTTPException) as exc:
        await update_path_variable(variable_id, payload, repo=repo)

    assert exc.value.status_code == 404
    repo.update_path_variable.assert_awaited_once_with(variable_id, payload)


async def test_delete_path_variable_propagates_repo_result():
    repo = AsyncMock(spec=SupabaseWorkflowRepository)
    variable_id = uuid4()
    repo.delete_path_variable.return_value = True

    result = await delete_path_variable(variable_id, repo=repo)

    assert result is None
    repo.delete_path_variable.assert_awaited_once_with(variable_id)


async def test_delete_path_variable_raises_404_when_missing():
    repo = AsyncMock(spec=SupabaseWorkflowRepository)
    variable_id = uuid4()
    repo.delete_path_variable.return_value = False

    with pytest.raises(HTTPException) as exc:
        await delete_path_variable(variable_id, repo=repo)

    assert exc.value.status_code == 404
    repo.delete_path_variable.assert_awaited_once_with(variable_id)
