"""
Groq-backed provider.

Used for the live interviewer role (scope doc Section 4: "Groq free tier for
the live interviewer conversation"). Groq is chosen there for low-latency
inference, which is what matters once the full mock interview mode (Phase 2)
needs snappy back-and-forth turns instead of a long wait per reply.

A note on `reasoning_effort`:
The default model (openai/gpt-oss-20b) is a *reasoning* model - before
writing its visible answer it spends some of its token budget on internal
chain-of-thought, which is billed against the same max_tokens limit as the
answer itself. If max_tokens is small (or the question is meaty), it's
possible for the reasoning to eat the entire budget and leave literally
nothing for the answer - you get a 200-ish response with an empty
`.content` and `finish_reason: "length"`, no error raised at all.

Two ways to guard against that: give calls a reasonable max_tokens with
headroom (this class doesn't set a default, that's left to callers), and
tell the model not to reason too hard in the first place, since a chatty
interviewer persona doesn't need deep reasoning anyway. `reasoning_effort`
does the latter and defaults to "low" here - pass reasoning_effort=None if
you switch to a Groq model that doesn't support the parameter.
"""

from __future__ import annotations

from groq import AsyncGroq, GroqError

from app.services.llm.base import LLMProvider, LLMProviderError, LLMResponse, Message
from app.services.llm.retry import retry_transient

# Same transient/permanent split as the Gemini provider (see retry.py and
# gemini_provider.py) - 429/5xx are worth a couple of retries, anything
# else (401 bad key, 404 unknown model) is not. groq-python's error classes
# (APIStatusError and its subclasses like RateLimitError) all expose
# `.status_code`; getattr handles the case where some other exception type
# (e.g. a connection-level error with no status code at all) reaches here.
_TRANSIENT_STATUS_CODES = {429, 500, 502, 503, 504}


def _is_transient(exc: Exception) -> bool:
    return getattr(exc, "status_code", None) in _TRANSIENT_STATUS_CODES


class GroqProvider(LLMProvider):
    def __init__(self, *, api_key: str, model: str, reasoning_effort: str | None = "low"):
        self._client = AsyncGroq(api_key=api_key)
        self._model = model
        self._reasoning_effort = reasoning_effort

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

        kwargs: dict = dict(
            model=self._model,
            messages=payload,
            temperature=temperature,
            max_tokens=max_tokens,
        )
        if self._reasoning_effort is not None:
            kwargs["reasoning_effort"] = self._reasoning_effort

        try:
            completion = await retry_transient(
                lambda: self._client.chat.completions.create(**kwargs),
                is_transient=_is_transient,
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