from typing import Any

import pytest

from backend.runtime.factory import AgentFactory


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
