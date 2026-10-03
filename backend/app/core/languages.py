"""
Language resolution and multilingual prompt instructions for RP-AI Interview Assistant.
"""

LANGUAGE_NAMES: dict[str, str] = {
    "en": "English",
    "hi": "Hindi (हिन्दी)",
    "mr": "Marathi (मराठी)",
    "de": "German (Deutsch)",
    "es": "Spanish (Español)",
    "fr": "French (Français)",
    "ja": "Japanese (日本語)",
    "gu": "Gujarati (ગુજરાતી)",
    "ta": "Tamil (தமிழ்)",
    "te": "Telugu (తెలుగు)",
    "bn": "Bengali (বাংলা)",
    "kn": "Kannada (ಕನ್ನಡ)",
}


def get_language_display_name(lang: str | None) -> str:
    """Resolves language code (or dialect like 'hi-IN', 'de-DE') to a human-readable name."""
    if not lang:
        return "English"
    cleaned = lang.strip().lower()
    if cleaned in LANGUAGE_NAMES:
        return LANGUAGE_NAMES[cleaned]
    # Check 2-letter prefix
    prefix = cleaned.split("-")[0].split("_")[0]
    if prefix in LANGUAGE_NAMES:
        return LANGUAGE_NAMES[prefix]
    return lang.strip()


def build_language_prompt_instruction(
    language: str | None,
    is_evaluator: bool = False,
    is_json: bool = False,
) -> str:
    """Builds explicit prompt instructions to generate output in the chosen language."""
    display_name = get_language_display_name(language)
    if display_name.lower() == "english":
        return ""

    if is_evaluator and is_json:
        return (
            f"\n\nLANGUAGE INSTRUCTION (MANDATORY):\n"
            f"- All string values and textual feedback in your JSON response (including 'overall_impression', 'key_strengths', 'areas_for_improvement', 'skills_not_fully_verified', and 'recommended_preparation') MUST be written entirely in {display_name}.\n"
            f"- Keep the JSON schema keys ('score', 'feedback', etc.) in English exactly as specified.\n"
            f"- Write natural, encouraging, professional {display_name}."
        )
    elif is_evaluator:
        return (
            f"\n\nLANGUAGE INSTRUCTION (MANDATORY):\n"
            f"- The candidate's answer and your FEEDBACK MUST be written in {display_name}.\n"
            f"- Keep the exact formatting labels 'SCORE: <integer 0-10>' and 'FEEDBACK: <text in {display_name}>'."
        )
    else:
        return (
            f"\n\nLANGUAGE INSTRUCTION (MANDATORY):\n"
            f"- You MUST conduct the interview entirely in {display_name}.\n"
            f"- Ask your questions and conversational follow-ups in {display_name}.\n"
            f"- The candidate will respond in {display_name}.\n"
            f"- Ensure natural, authentic, professional phrasing appropriate for a real-world interview in {display_name}."
        )
