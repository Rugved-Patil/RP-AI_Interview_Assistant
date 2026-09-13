"""
Common interface every LLM backend must implement.

Why this file exists
---------------------
The interviewer (Groq) and the grader (Gemini) are two different APIs with
different SDKs, different request/response shapes, and different naming
conventions for roles. Everything *above* this layer - FastAPI routes,
session/transcript logic, grading logic - should only ever talk to the
`LLMProvider` interface defined here. Nothing above this file should ever
`import groq` or `import google.generativeai` directly.

That's the whole point of a "provider-agnostic wrapper": if Groq's free tier
changes, or you want to add a third provider, you write one new class here
and nothing above this file changes.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from enum import Enum


class Role(str, Enum):
    """
    Chat roles, using OpenAI/Groq-style naming since that's the convention
    Groq's SDK follows. Gemini's SDK uses different names internally
    ("model" instead of "assistant", no "system" role at all) - that
    translation happens inside GeminiProvider, not here, so callers never
    have to think about it.
    """

    SYSTEM = "system"
    USER = "user"
    ASSISTANT = "assistant"


@dataclass
class Message:
    """One turn in a conversation."""

    role: Role
    content: str


@dataclass
class LLMResponse:
    """What every provider hands back, regardless of which API produced it."""

    text: str
    provider: str  # e.g. "groq", "gemini" - handy for logging/debugging
    model: str  # the actual model string used, e.g. "llama-3.3-70b-versatile"
    raw: dict = field(default_factory=dict, repr=False)  # original SDK payload, kept for debugging only


class LLMProviderError(Exception):
    """
    Raised whenever a provider call fails, for any reason - network error,
    bad API key, rate limit, malformed response, whatever.

    Wrapping every SDK's own exception type in this one class means calling
    code (a FastAPI route, say) only ever needs to catch ONE exception type,
    instead of knowing that Groq raises `groq.GroqError` while Gemini raises
    `google.api_core.exceptions.GoogleAPIError`. That knowledge stays fully
    contained inside this services/llm package.
    """

    def __init__(self, message: str, *, provider: str, original: Exception | None = None):
        super().__init__(message)
        self.provider = provider
        self.original = original


class LLMProvider(ABC):
    """
    Abstract base class every concrete provider (Groq, Gemini, ...) must
    implement. Trying to instantiate a subclass that hasn't implemented
    `generate` will raise a TypeError immediately - Python enforces the
    contract for you, you don't have to remember to check it.
    """

    @abstractmethod
    async def generate(
        self,
        messages: list[Message],
        *,
        temperature: float = 0.7,
        max_tokens: int | None = None,
    ) -> LLMResponse:
        """
        Send a full conversation (system prompt + all prior turns) and get
        back one complete reply.

        Takes the FULL conversation, not just the latest message, because
        LLM APIs are stateless (see scope doc Section 3.5) - the caller
        (session/transcript logic) is responsible for building up the
        running transcript. This method's only job is making the API call
        and normalizing the result into an LLMResponse.
        """
        raise NotImplementedError
