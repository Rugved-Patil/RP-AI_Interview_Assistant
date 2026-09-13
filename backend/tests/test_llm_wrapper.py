"""
Unit tests for the LLM wrapper.

Every provider's underlying SDK client is mocked here - these tests never
make a real network call, cost nothing, and run in well under a second.
For a test that actually hits Groq/Gemini with your real keys, see
backend/scripts/smoke_test_llm.py instead - that one is deliberately kept
separate so it never runs automatically (e.g. in CI) and burns quota.

Run with:
    pytest tests/test_llm_wrapper.py -v

Requires: pip install pytest pytest-asyncio
Also requires this in backend/pyproject.toml:
    [tool.pytest.ini_options]
    asyncio_mode = "auto"
    pythonpath = ["."]
"""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services.llm.base import LLMProviderError, Message, Role
from app.services.llm.factory import LLMRole, get_provider
from app.services.llm.gemini_provider import GeminiProvider
from app.services.llm.groq_provider import GroqProvider


async def test_groq_provider_generate_success():
    with patch("app.services.llm.groq_provider.AsyncGroq") as mock_groq_cls:
        mock_client = mock_groq_cls.return_value
        fake_completion = MagicMock()
        fake_completion.choices = [MagicMock(message=MagicMock(content="Hello from Groq"))]
        fake_completion.model_dump.return_value = {"id": "fake"}
        mock_client.chat.completions.create = AsyncMock(return_value=fake_completion)

        provider = GroqProvider(api_key="fake-key", model="openai/gpt-oss-20b")
        result = await provider.generate([Message(Role.USER, "Hi")])

        assert result.text == "Hello from Groq"
        assert result.provider == "groq"
        mock_client.chat.completions.create.assert_awaited_once()


async def test_groq_provider_wraps_sdk_errors():
    from groq import GroqError

    with patch("app.services.llm.groq_provider.AsyncGroq") as mock_groq_cls:
        mock_client = mock_groq_cls.return_value
        mock_client.chat.completions.create = AsyncMock(side_effect=GroqError("boom"))

        provider = GroqProvider(api_key="fake-key", model="openai/gpt-oss-20b")

        with pytest.raises(LLMProviderError):
            await provider.generate([Message(Role.USER, "Hi")])


async def test_gemini_provider_generate_success():
    # google-genai shape: genai.Client(...).aio.models.generate_content(...)
    # - different from the old google-generativeai GenerativeModel shape.
    with patch("app.services.llm.gemini_provider.genai") as mock_genai:
        fake_client = MagicMock()
        fake_response = MagicMock()
        fake_response.text = "Hello from Gemini"
        fake_response.model_dump.return_value = {}
        fake_client.aio.models.generate_content = AsyncMock(return_value=fake_response)
        mock_genai.Client.return_value = fake_client

        provider = GeminiProvider(api_key="fake-key", model="gemini-2.5-flash")
        result = await provider.generate(
            [Message(Role.SYSTEM, "You are a grader"), Message(Role.USER, "Grade this")]
        )

        assert result.text == "Hello from Gemini"
        assert result.provider == "gemini"
        fake_client.aio.models.generate_content.assert_awaited_once()


def test_factory_routes_roles_to_correct_provider_type():
    # factory.py calls get_settings() (a function), not a module-level
    # `settings` variable - so we patch get_settings and have it return a
    # fake settings object with the four attributes the factory reads.
    with patch("app.services.llm.factory.get_settings") as mock_get_settings:
        fake_settings = MagicMock()
        fake_settings.groq_api_key = "fake-groq-key"
        fake_settings.groq_model = "openai/gpt-oss-20b"
        fake_settings.gemini_api_key = "fake-gemini-key"
        fake_settings.gemini_model = "gemini-2.5-flash"
        mock_get_settings.return_value = fake_settings

        get_provider.cache_clear()  # the factory caches by role - clear between tests
        interviewer = get_provider(LLMRole.INTERVIEWER)
        grader = get_provider(LLMRole.GRADER)

        assert isinstance(interviewer, GroqProvider)
        assert isinstance(grader, GeminiProvider)
