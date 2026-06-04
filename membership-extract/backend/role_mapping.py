"""
Mapping of AIESEC role abbreviations to full names.
Used for PersonType and Role display (TM → Teamster, TL → Team Leader, etc.).
"""

# Role code → full name
ROLE_CODE_TO_FULL = {
    "TM": "Teamster",
    "TL": "Team Leader",
    "LCVP": "Local Committee Vice President",
    "LCP": "Local Committee President",
    "MCVP": "Members Committee Vice President",
    "MCP": "Members Committee President",
    "Director": "Director",
    "Middle Manager": "Middle Manager",
    "Member": "Member",
    "NST": "National Support Team",
}

# Reverse for lookup
ROLE_FULL_TO_CODE = {v: k for k, v in ROLE_CODE_TO_FULL.items()}


def parse_expa_role(raw: str) -> tuple[str, str] | None:
    """
    Parse EXPA role string into (code, full_name).
    Returns (code, full_name) or None if empty.
    """
    raw = (raw or "").strip()
    if not raw:
        return None

    # Format: "CODE - Full Name"
    if " - " in raw:
        parts = raw.split(" - ", 1)
        code = parts[0].strip()[:50]
        full = parts[1].strip()[:250] if len(parts) > 1 else code
        if code and full:
            return (code, full)

    # Just code or full name - use mapping
    if raw.upper() in ROLE_CODE_TO_FULL:
        return (raw[:50], ROLE_CODE_TO_FULL[raw.upper()])
    if raw in ROLE_FULL_TO_CODE:
        return (ROLE_FULL_TO_CODE[raw], raw)

    return (raw[:50], raw[:250])
