import asyncio
from types import SimpleNamespace
from typing import Any
from uuid import uuid4

import pytest

from livekit.agents import ChatContext
from livekit.agents.llm.tool_context import ToolError

from backend.runtime.config import AgentConfig, PathConfig, PathVariableConfig, WorkflowRuntimeConfig
from backend.runtime.factory import AgentFactory, UserData


class _StubAgent:
    def __init__(self):
        self.updated_ctx: ChatContext | None = None

    async def update_chat_ctx(self, ctx: ChatContext) -> None:
        self.updated_ctx = ctx


def test_default_stt_uses_deepgram_nova3(monkeypatch):
    factory = AgentFactory()

    captured: dict[str, Any] = {}

    def fake_stt(*, model: str):
        captured["model"] = model
        return f"deepgram:{model}"

    monkeypatch.setattr("backend.runtime.factory.deepgram.STT", fake_stt)

    stt = factory._create_stt(None)

    assert stt == "deepgram:nova-3"
    assert captured["model"] == "nova-3"


def test_stt_use_livekit_returns_identifier():
    factory = AgentFactory()

    stt = factory._create_stt({"provider": "deepgram", "use_livekit": True})

    assert stt == "deepgram/nova-3"


def test_llm_respects_frontend_config(monkeypatch):
    factory = AgentFactory()

    def fake_openai_llm(*, model: str):  # type: ignore[override]
        return {"provider": "openai", "model": model}

    monkeypatch.setattr("backend.runtime.factory.openai.LLM", fake_openai_llm)

    config = {"provider": "openai", "model": "gpt-4o", "use_livekit": False}

    llm = factory._create_llm(config)

    assert llm == {"provider": "openai", "model": "gpt-4o"}


def test_llm_livekit_mode_returns_identifier():
    factory = AgentFactory()

    config = {"provider": "openai", "model": "gpt-4o-mini", "use_livekit": True}

    llm = factory._create_llm(config)

    assert llm == "openai/gpt-4o-mini"


def test_transfer_tool_enforces_required_variables(monkeypatch):
    async def _run() -> None:
        factory = AgentFactory()

        monkeypatch.setattr(factory, "_create_stt", lambda *_args, **_kwargs: "stt")
        monkeypatch.setattr(factory, "_create_llm", lambda *_args, **_kwargs: "llm")
        monkeypatch.setattr(factory, "_create_tts", lambda *_args, **_kwargs: "tts")
        monkeypatch.setattr(factory, "_create_vad", lambda *_args, **_kwargs: "vad")

        target_agent_id = uuid4()
        path = PathConfig(
            id=uuid4(),
            target_agent_id=target_agent_id,
            name="To PA",
            description=None,
            guard_condition=None,
            required_variables=[
                PathVariableConfig(
                    name="memberEmail",
                    description="Patient email",
                    data_type="string",
                )
            ],
            metadata=None,
        )

        agent_config = AgentConfig(
            id=uuid4(),
            name="Auth Agent",
            instructions="Collect member email",
            paths=[path],
        )

        workflow_config = WorkflowRuntimeConfig(
            workflow_id=uuid4(),
            organization_id=uuid4(),
            workflow_name="Prior Auth",
            version_id=uuid4(),
            version_number=1,
            agents={str(agent_config.id): agent_config},
            entry_agent_id=str(agent_config.id),
        )

        agent = factory.create_agent(agent_config, workflow_config)

        userdata = UserData()
        stub = _StubAgent()
        userdata.personas[str(target_agent_id)] = stub

        async def fake_say(*_args, **_kwargs):
            return None

        session = SimpleNamespace(
            userdata=userdata,
            history=ChatContext.empty(),
            say=fake_say,
        )
        object.__setattr__(agent, "_session", session)
        object.__setattr__(agent, "_activity", SimpleNamespace(session=session))

        context = SimpleNamespace(userdata=userdata)
        transfer_tool = getattr(agent, f"transfer_to_{path.id}")

        with pytest.raises(ToolError):
            await transfer_tool(context)

        record_tool_name = f"record_{path.id.hex}_{AgentFactory._slugify('memberEmail')}"
        record_tool = getattr(agent, record_tool_name)
        await record_tool({"value": "patient@example.com"})

        result = await transfer_tool(context)

        assert result is stub
        assert stub.updated_ctx is not None
        assert any(
            "Structured handoff context" in "".join(item.content)
            for item in stub.updated_ctx.items
        )

    asyncio.run(_run())
