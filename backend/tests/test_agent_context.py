from types import SimpleNamespace

import asyncio

import pytest
from livekit.agents import ChatContext

from backend.runtime.factory import BaseConfigurableAgent, UserData


class DummySession:
    def __init__(self, userdata: UserData):
        self.userdata = userdata
        self.history = ChatContext.empty()
        self.generated_reply_called = False

    def generate_reply(self, *_, **__):
        self.generated_reply_called = True


def _make_agent(name: str = "Test Agent") -> BaseConfigurableAgent:
    agent = object.__new__(BaseConfigurableAgent)
    userdata = UserData()
    session = DummySession(userdata)
    activity = SimpleNamespace(session=session)
    object.__setattr__(agent, "_session", session)
    object.__setattr__(agent, "_activity", activity)
    agent.agent_name = name
    agent.agent_id = "agent-id"
    return agent


class _StubAgent:
    def __init__(self):
        self.updated_ctx: ChatContext | None = None

    async def update_chat_ctx(self, ctx: ChatContext) -> None:
        self.updated_ctx = ctx


def test_transfer_to_agent_updates_chat_context() -> None:
    async def _run() -> None:
        source_agent = _make_agent()
        target_agent = _StubAgent()

        source_agent.session.history.add_message(role="user", content="Hello there")

        userdata = source_agent.session.userdata
        userdata.personas["target"] = target_agent

        context = SimpleNamespace(userdata=userdata)

        returned = await source_agent._transfer_to_agent("target", context)

        assert returned is target_agent
        assert isinstance(target_agent.updated_ctx, ChatContext)
        assert target_agent.updated_ctx is not source_agent.session.history
        assert target_agent.updated_ctx.items[-1].content == ["Hello there"]

    asyncio.run(_run())


def test_on_enter_uses_session_history() -> None:
    async def _run() -> None:
        agent = _make_agent("Support Agent")
        agent.session.history.add_message(role="user", content="Need assistance")

        captured: dict[str, ChatContext] = {}

        async def fake_update(chat_ctx: ChatContext) -> None:
            captured["ctx"] = chat_ctx

        agent.update_chat_ctx = fake_update  # type: ignore[assignment]

        await agent.on_enter()

        assert agent.session.generated_reply_called is True
        ctx = captured["ctx"]
        assert ctx.items[-2].content == ["Need assistance"]
        assert ctx.items[-1].role == "system"
        assert "Support Agent" in ctx.items[-1].content[0]

    asyncio.run(_run())


def test_transfer_to_missing_agent_raises() -> None:
    async def _run() -> None:
        agent = _make_agent()
        context = SimpleNamespace(userdata=agent.session.userdata)

        with pytest.raises(ValueError):
            await agent._transfer_to_agent("unknown", context)

    asyncio.run(_run())
