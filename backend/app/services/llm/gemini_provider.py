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

A note on `thinking_level` (the Gemini counterpart of Groq's
`reasoning_effort` - see groq_provider.py):
Gemini 3-series models "think" before answering, and those thinking tokens
share the same `max_output_tokens` budget as the visible answer. A high
thinking level plus a modest token limit can leave little or nothing for the
answer. "low" is plenty for grading one answer against a rubric. Pass
thinking_level=None to send no thinking config at all (e.g. for a model
that doesn't support it - Gemini 2.5-era models use a token budget instead,
and sending both kinds of setting is an error).

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
    def __init__(self, *, api_key: str, model: str, thinking_level: str | None = "low"):
        self._client = genai.Client(api_key=api_key)
        self._model = model
        self._thinking_level = thinking_level

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

        # Built up as kwargs (same shape as GroqProvider) so the thinking
        # config is only sent when one was asked for.
        config_kwargs: dict = dict(
            system_instruction=system_instruction,
            temperature=temperature,
            max_output_tokens=max_tokens,
        )
        if self._thinking_level is not None:
            config_kwargs["thinking_config"] = types.ThinkingConfig(thinking_level=self._thinking_level)
        config = types.GenerateContentConfig(**config_kwargs)

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
            # `response.text` is None when the reply has no text parts (e.g.
            # thinking used up the whole token budget, or the reply was
            # blocked). Normalized to "" so callers can rely on a real
            # string and use a plain emptiness check.
            text=response.text or "",
            provider="gemini",
            model=self._model,
            raw=response.model_dump() if hasattr(response, "model_dump") else {},
        )