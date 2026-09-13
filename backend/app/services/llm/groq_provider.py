"""
Groq-backed provider.

Used for the live interviewer role (scope doc Section 4: "Groq free tier for
the live interviewer conversation"). Groq is chosen there for low-latency
inference, which is what matters once the full mock interview mode (Phase 2)
needs snappy back-and-forth turns instead of a long wait per reply.

Requires: pip install groq
"""

from __future__ import annotations

from groq import AsyncGroq, GroqError

from app.services.llm.base import LLMProvider, LLMProviderError, LLMResponse, Message


class GroqProvider(LLMProvider):
    def __init__(self, *, api_key: str, model: str):
        self._client = AsyncGroq(api_key=api_key)
        self._model = model

    async def generate(
        self,
        messages: list[Message],
        *,
        temperature: float = 0.7,
        max_tokens: int | None = None,
    ) -> LLMResponse:
        # Groq's chat completion API speaks plain OpenAI-style dicts, which
        # is exactly what our Role enum's .value gives us for free.
        payload = [{"role": m.role.value, "content": m.content} for m in messages]

        try:
            completion = await self._client.chat.completions.create(
                model=self._model,
                messages=payload,
                temperature=temperature,
                max_tokens=max_tokens,
            )
        except GroqError as exc:
            raise LLMProviderError(f"Groq API call failed: {exc}", provider="groq", original=exc) from exc

        choice = completion.choices[0]
        return LLMResponse(
            text=choice.message.content,
            provider="groq",
            model=self._model,
            raw=completion.model_dump(),
        )
