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


async def check_provider(role: LLMRole) -> None:
    provider = get_provider(role)
    print(f"\n--- Testing {role.value} ({type(provider).__name__}) ---")
    try:
        response = await provider.generate(
            [
                Message(Role.SYSTEM, "You are a helpful assistant. Be extremely brief."),
                Message(Role.USER, "Reply with exactly: wrapper works"),
            ],
            max_tokens=20,
        )
        print(f"Model:    {response.model}")
        print(f"Response: {response.text!r}")
        print("Result:   OK")
    except Exception as exc:  # noqa: BLE001 - intentionally broad, this is a smoke test
        print(f"Result:   FAILED - {exc}")


async def main() -> None:
    print("Running LLM wrapper smoke test against the real Groq and Gemini APIs...")
    await check_provider(LLMRole.INTERVIEWER)
    await check_provider(LLMRole.GRADER)


if __name__ == "__main__":
    asyncio.run(main())
