"""
Gemini-backed provider.

Used for the grading role (scope doc Section 4: "Gemini Flash-tier for
grading"). Its large context window suits reviewing a full interview
transcript in one shot at the end of a mock interview session.

Why this uses `google-genai` and not `google-generativeai`:
The older `google-generativeai` package (what this file originally used) is
now fully deprecated by Google - "all support has ended." Its async methods
also default to a grpc transport, which on some networks fails with DNS
resolution errors talking to generativelanguage.googleapis.com even though
plain HTTP requests to the same host work fine. `google-genai` is the
actively supported replacement SDK and uses plain HTTP (httpx) for both its
sync and async clients, sidestepping that whole class of grpc-specific
connectivity problem.

Gemini has two quirks this class papers over so callers never notice the
difference from Groq:
  1. No "system" role in the message list - a system instruction is passed
     separately via GenerateContentConfig.
  2. The assistant's role is called "model", not "assistant".

Requires: pip install google-genai
"""

from __future__ import annotations

from google import genai
from google.genai import types
from google.genai.errors import APIError

from app.services.llm.base import LLMProvider, LLMProviderError, LLMResponse, Message, Role
from app.services.llm.retry import retry_transient

# HTTP statuses worth retrying: 429 (rate limited) and the common 5xx
# "temporarily unavailable" family. Anything else (401 bad key, 404 unknown
# model, 400 malformed request) is permanent - retrying just delays the
# same error, so those are left alone and raised immediately.
_TRANSIENT_CODES = {429, 500, 502, 503, 504}


def _is_transient(exc: Exception) -> bool:
    return isinstance(exc, APIError) and exc.code in _TRANSIENT_CODES


class GeminiProvider(LLMProvider):
    def __init__(self, *, api_key: str, model: str):
        self._client = genai.Client(api_key=api_key)
        self._model = model

    async def generate(
        self,
        messages: list[Message],
        *,
        temperature: float = 0.7,
        max_tokens: int | None = None,
    ) -> LLMResponse:
        # Gemini has no "system" role - fold any system messages into a
        # separate system_instruction string instead.
        system_instruction = "\n".join(m.content for m in messages if m.role == Role.SYSTEM) or None

        # Everything else becomes Gemini-style Content objects. Groq/OpenAI
        # call the AI's turn "assistant"; Gemini calls it "model".
        contents = [
            types.Content(
                role="model" if m.role == Role.ASSISTANT else "user",
                parts=[types.Part.from_text(text=m.content)],
            )
            for m in messages
            if m.role != Role.SYSTEM
        ]

        config = types.GenerateContentConfig(
            system_instruction=system_instruction,
            temperature=temperature,
            max_output_tokens=max_tokens,
        )

        try:
            response = await retry_transient(
                lambda: self._client.aio.models.generate_content(
                    model=self._model,
                    contents=contents,
                    config=config,
                ),
                is_transient=_is_transient,
            )
        except APIError as exc:
            raise LLMProviderError(f"Gemini API call failed: {exc}", provider="gemini", original=exc) from exc

        return LLMResponse(
            text=response.text,
            provider="gemini",
            model=self._model,
            raw=response.model_dump() if hasattr(response, "model_dump") else {},
        )