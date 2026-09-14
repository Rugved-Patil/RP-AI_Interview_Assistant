"""
Small helper for retrying a single async provider call a few times when the
failure looks *transient* - the provider's own infrastructure temporarily
overloaded (503), or a rate limit (429) - as opposed to a *permanent*
failure (bad API key, malformed request, unknown model name) where
retrying is just a slower way to reach the same error.

Kept here rather than duplicated in each provider file, since "wait, then
retry a capped number of times with backoff" is the same policy regardless
of which SDK raised the error - only how to *recognize* a transient error
differs per SDK (Groq's exceptions expose `.status_code`, Gemini's expose
`.code`), which is why `is_transient` is a caller-supplied argument rather
than baked in here.
"""

from __future__ import annotations

import asyncio
from typing import Awaitable, Callable, TypeVar

T = TypeVar("T")

_MAX_ATTEMPTS = 3
_BASE_DELAY_SECONDS = 1.0


async def retry_transient(
    call: Callable[[], Awaitable[T]],
    *,
    is_transient: Callable[[Exception], bool],
) -> T:
    """
    Calls `call()`. If it raises and `is_transient(exc)` is True, waits
    briefly and tries again, up to `_MAX_ATTEMPTS` total attempts, with the
    delay doubling each time (1s, then 2s). Any non-transient exception -
    or the last attempt's exception, once attempts run out - is re-raised
    immediately for the caller's own error handling to catch, same as if
    this wrapper weren't here at all.
    """
    for attempt in range(1, _MAX_ATTEMPTS + 1):
        try:
            return await call()
        except Exception as exc:
            if not is_transient(exc) or attempt == _MAX_ATTEMPTS:
                raise
            await asyncio.sleep(_BASE_DELAY_SECONDS * (2 ** (attempt - 1)))

    # Unreachable: the loop above always either returns or raises on its
    # final iteration. Present only so type checkers see every path covered.
    raise AssertionError("retry_transient exited its loop without returning or raising")