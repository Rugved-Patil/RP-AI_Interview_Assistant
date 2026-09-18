"""
Shared role/company/location validation rules.

Factored out once a second copy of "role is required, trimmed" and
"blank optional string becomes None" was about to exist - one in
schemas/session.py (situational practice's request body) and one in
schemas/preset.py (saved presets). Keeping the rule in one place means a
future tweak (e.g. a max length, or disallowing certain characters)
only has to happen once and can't drift between the two call sites.
"""

from __future__ import annotations


def require_role(value: str) -> str:
    stripped = value.strip()
    if not stripped:
        raise ValueError("role is required")
    return stripped


def blank_optional_becomes_none(value: str | None) -> str | None:
    # An empty string from an untouched optional frontend field should
    # behave the same as never sending the field at all - otherwise
    # downstream code would have to treat "" and None as two different
    # "not provided" cases.
    if value is None:
        return None
    stripped = value.strip()
    return stripped or None