"""
Manual smoke test - actually calls the real Groq and Gemini free-tier APIs
using whatever keys are in your .env. Run this once right after wiring the
wrapper up, and again any time you touch it, to confirm both providers are
reachable and your keys/models are valid.

This is NOT part of the automated test suite on purpose - it costs a sliver
of real API quota, so it should only run when you choose to run it, not on
every `pytest` run.

Run from the backend/ directory, with your venv active:
    python -m scripts.smoke_test_llm
"""

import asyncio

from app.services.llm import LLMRole, Message, Role, get_provider

# Both Groq's gpt-oss models and Gemini 3.6 Flash spend some of their token
# budget on internal reasoning before writing the visible answer. Too small
# a max_tokens can let that reasoning eat the whole budget, leaving an empty
# .text with no error raised - so this smoke test leaves generous headroom
# and explicitly flags an empty result as a warning rather than reporting OK.
SMOKE_TEST_MAX_TOKENS = 200


async def check_provider(role: LLMRole) -> None:
    provider = get_provider(role)
    print(f"\n--- Testing {role.value} ({type(provider).__name__}) ---")
    try:
        response = await provider.generate(
            [
                Message(Role.SYSTEM, "You are a helpful assistant. Be extremely brief."),
                Message(Role.USER, "Reply with exactly: wrapper works"),
            ],
            max_tokens=SMOKE_TEST_MAX_TOKENS,
        )
        print(f"Model:    {response.model}")
        print(f"Response: {response.text!r}")
        if response.text.strip():
            print("Result:   OK")
        else:
            print("Result:   WARNING - call succeeded but returned empty text.")
            print("          Likely the reasoning budget ate all of max_tokens.")
            print(f"          Try raising SMOKE_TEST_MAX_TOKENS above {SMOKE_TEST_MAX_TOKENS}.")
    except Exception as exc:  # noqa: BLE001 - intentionally broad, this is a smoke test
        print(f"Result:   FAILED - {exc}")


async def main() -> None:
    print("Running LLM wrapper smoke test against the real Groq and Gemini APIs...")
    await check_provider(LLMRole.INTERVIEWER)
    await check_provider(LLMRole.GRADER)


if __name__ == "__main__":
    asyncio.run(main())
