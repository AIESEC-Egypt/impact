"""
Mapping and parsing for AIESEC functions (departments).
EXPA returns format like "MKT - Marketing" or "OGX - Outgoing Exchange".
function_name = short code (MKT, OGX, ICX, BD)
function_type = full description (Marketing, Outgoing Exchange, etc.)
"""

# Standard AIESEC function codes → full names
FUNCTION_CODE_TO_TYPE = {
    "MKT": "Marketing",
    "OGX": "Outgoing Exchange",
    "ICX": "Incoming Exchange",
    "BD": "Business/Partnership Development",
    "TM": "Talent Management",
    "GIP": "Global Internship Programme",
    "GCE": "Global Citizenship",
    "F&B": "Finance & Business",
    "Q&A": "Quality & Audit",
    "EWA": "Engagement With AIESEC",
    "FIN": "Finance",
    "IM": "Information Management",
    "Others": "Others",
    "President": "President",
}

# Reverse: full name → code (for lookup when EXPA returns only full name)
FUNCTION_TYPE_TO_CODE = {v: k for k, v in FUNCTION_CODE_TO_TYPE.items()}


def parse_expa_function(raw: str) -> tuple[str, str] | None:
    """
    Parse EXPA function string into (function_name, function_type).
    EXPA may return:
      - "MKT - Marketing" → ("MKT", "Marketing")
      - "OGX - Outgoing Exchange" → ("OGX", "Outgoing Exchange")
      - "MKT" or "Marketing" → use known mapping
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
        if code:
            full = FUNCTION_CODE_TO_TYPE.get(code.upper(), code)
            return (code, full)

    # Just code or just full name - use mapping
    upper = raw.upper()
    if upper in FUNCTION_CODE_TO_TYPE:
        return (raw[:50], FUNCTION_CODE_TO_TYPE[upper])
    if raw in FUNCTION_TYPE_TO_CODE:
        return (FUNCTION_TYPE_TO_CODE[raw], raw)

    # Unknown: use raw as both (or code = first word)
    return (raw[:50], raw[:250])
