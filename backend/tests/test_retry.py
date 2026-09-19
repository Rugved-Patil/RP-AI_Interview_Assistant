"""
Unit tests for the retry helper, plus the Groq provider's rule for what
counts as a transient error.

The scope doc says retry was "verified against actual SDK exception
shapes" - that was a manual check. These tests make it repeatable.
asyncio.sleep is replaced with a recorder so the tests run instantly and
can assert on the backoff delays.
"""

import pytest

from app.services.llm import retry as retry_module
from app.services.llm.groq_provider import _is_transient as groq_is_transient
from app.services.llm.retry import retry_transient


class TransientError(Exception):
    pass


class PermanentError(Exception):
    pass


def _is_transient(exc: Exception) -> bool:
    return isinstance(exc, TransientError)


class ScriptedCall:
    """An async callable that plays back a script: exceptions are raised, anything else is returned."""

    def __init__(self, *outcomes):
        self._outcomes = list(outcomes)
        self.calls = 0

    async def __call__(self):
        outcome = self._outcomes[self.calls]  # IndexError = called more often than scripted
        self.calls += 1
        if isinstance(outcome, Exception):
            raise outcome
        return outcome


@pytest.fixture
def sleeps(monkeypatch) -> list[float]:
    recorded: list[float] = []

    async def fake_sleep(seconds: float) -> None:
        recorded.append(seconds)

    monkeypatch.setattr(retry_module.asyncio, "sleep", fake_sleep)
    return recorded


async def test_returns_immediately_on_success(sleeps):
    call = ScriptedCall("ok")

    assert await retry_transient(call, is_transient=_is_transient) == "ok"
    assert call.calls == 1
    assert sleeps == []


async def test_retries_transient_errors_then_succeeds(sleeps):
    call = ScriptedCall(TransientError("429"), TransientError("503"), "ok")

    assert await retry_transient(call, is_transient=_is_transient) == "ok"
    assert call.calls == 3
    # The policy from retry.py's docstring: 1s, then 2s (doubling each time).
    assert sleeps == [1.0, 2.0]


async def test_gives_up_after_max_attempts_and_reraises_the_last_error(sleeps):
    last = TransientError("third")
    call = ScriptedCall(TransientError("first"), TransientError("second"), last)

    with pytest.raises(TransientError) as exc_info:
        await retry_transient(call, is_transient=_is_transient)

    assert exc_info.value is last
    assert call.calls == 3
    assert sleeps == [1.0, 2.0]  # no pointless sleep after the final attempt


async def test_permanent_error_is_not_retried(sleeps):
    call = ScriptedCall(PermanentError("404"), "never reached")

    with pytest.raises(PermanentError):
        await retry_transient(call, is_transient=_is_transient)

    assert call.calls == 1
    assert sleeps == []


async def test_permanent_error_after_a_transient_one_stops_retrying(sleeps):
    call = ScriptedCall(TransientError("429"), PermanentError("401"), "never reached")

    with pytest.raises(PermanentError):
        await retry_transient(call, is_transient=_is_transient)

    assert call.calls == 2
    assert sleeps == [1.0]


class _FakeStatusError(Exception):
    """Mimics the one thing groq's APIStatusError exposes that the classifier reads."""

    def __init__(self, status_code: int) -> None:
        super().__init__(f"status {status_code}")
        self.status_code = status_code


@pytest.mark.parametrize("status", [429, 500, 502, 503, 504])
def test_groq_treats_rate_limits_and_server_errors_as_transient(status):
    assert groq_is_transient(_FakeStatusError(status)) is True


@pytest.mark.parametrize("status", [400, 401, 404])
def test_groq_treats_client_errors_as_permanent(status):
    assert groq_is_transient(_FakeStatusError(status)) is False


def test_groq_treats_errors_without_a_status_code_as_permanent():
    assert groq_is_transient(ValueError("no status code")) is False