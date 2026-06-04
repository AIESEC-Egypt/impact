"""AIESEC position role codes from EXPA (Member, TM, LCVP, …)."""

ROLE_CODE_TO_FULL = {
    "TM": "Teamster",
    "TL": "Team Leader",
    "LCVP": "Local Committee Vice President",
    "LCP": "Local Committee President",
    "MCVP": "Members Committee Vice President",
    "ESTL": "Exchange Standards Team Leader",
    "MCP": "Members Committee President",
    "AIVP": "Associate Vice President",
    "Director": "Director",
    "Middle Manager": "Middle Manager",
    "Member": "Member",
    "NST": "National Support Team",
}

ROLE_FULL_TO_CODE = {v: k for k, v in ROLE_CODE_TO_FULL.items()}


def parse_expa_role(raw):
    """Return (role_code, role_name) or None."""
    raw = (raw or "").strip()
    if not raw:
        return None

    if " - " in raw:
        parts = raw.split(" - ", 1)
        code = parts[0].strip()[:50]
        full = parts[1].strip()[:250] if len(parts) > 1 else code
        if code and full:
            return (code, full)
        if code:
            return (code, ROLE_CODE_TO_FULL.get(code.upper(), code))

    upper = raw.upper()
    if upper in ROLE_CODE_TO_FULL:
        return (raw[:50], ROLE_CODE_TO_FULL[upper])
    if raw in ROLE_FULL_TO_CODE:
        return (ROLE_FULL_TO_CODE[raw], raw[:250])

    return (raw[:50], raw[:250])
