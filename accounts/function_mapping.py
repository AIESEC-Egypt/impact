"""AIESEC department (EXPA function field) → IMPACT functional academy keys.

EXPA calls the department a 'function', e.g. 'OGX - Outgoing Exchange' or 'OGT'.
Position role (Member, TM) is parsed separately in role_mapping.py.
"""

# Standard AIESEC function codes → full names (from EDM membership-extract)
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
    "OGT": "Outgoing Global Talent",
    "IGT": "Incoming Global Talent",
    "OGV": "Outgoing Global Volunteer",
    "IGV": "Incoming Global Volunteer",
    "B2C": "Business to Customer",
    "B2B": "Business to Business",
    "MXP": "Member Experience",
    "OD": "Organisational Development/Expansions",
}

FUNCTION_TYPE_TO_CODE = {v.upper(): k for k, v in FUNCTION_CODE_TO_TYPE.items()}

# Function code or keyword → academy slug (lms.Academy.key)
FUNCTION_TO_ACADEMY = {
    "OGX": "ogv",
    "OGV": "ogv",
    "ICX": "igv",
    "IGV": "igv",
    "OGT": "ogt",
    "IGT": "igt",
    "GTE": "ogt",  # default outgoing; overridden by name below
    "MKT": "b2c",
    "B2C": "b2c",
    "BD": "b2b",
    "B2B": "b2b",
    "TM": "tm",
    "MXP": "tm",
    "EWA": "tm",
    "FIN": "fl",
    "F&B": "fl",
    "GIP": "ogt",
    "IM": "tm",
}

NAME_KEYWORDS_TO_ACADEMY = [
    ("outgoing exchange", "ogv"),
    ("incoming exchange", "igv"),
    ("outgoing global talent", "ogt"),
    ("incoming global talent", "igt"),
    ("outgoing global volunteer", "ogv"),
    ("incoming global volunteer", "igv"),
    ("marketing", "b2c"),
    ("business to customer", "b2c"),
    ("business development", "b2b"),
    ("partnership", "b2b"),
    ("member experience", "tm"),
    ("talent management", "tm"),
    ("finance", "fl"),
    ("legal", "fl"),
]


def parse_expa_department(raw):
    """Return (department_code, department_name) or None."""
    return parse_expa_function(raw)


def parse_expa_function(raw):
    """Return (code, full_name) for department or None."""
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
            return (code, FUNCTION_CODE_TO_TYPE.get(code.upper(), code))

    upper = raw.upper()
    if upper in FUNCTION_CODE_TO_TYPE:
        return (raw[:50], FUNCTION_CODE_TO_TYPE[upper])
    if raw.upper() in FUNCTION_TYPE_TO_CODE:
        return (FUNCTION_TYPE_TO_CODE[raw.upper()], raw[:250])

    return (raw[:50], raw[:250])


def resolve_academy_key(department_raw):
    """Map EXPA department string to academy slug (ogv, ogt, …) or None."""
    parsed = parse_expa_department(department_raw)
    if not parsed:
        return None

    code, full_name = parsed
    code_upper = code.upper().replace(".", "").strip()

    if code_upper in FUNCTION_TO_ACADEMY:
        key = FUNCTION_TO_ACADEMY[code_upper]
        if code_upper == "GTE":
            lower = full_name.lower()
            if "incoming" in lower:
                return "igt"
            if "outgoing" in lower:
                return "ogt"
        return key

    haystack = f"{code} {full_name}".lower()
    for keyword, academy_key in NAME_KEYWORDS_TO_ACADEMY:
        if keyword in haystack:
            return academy_key

    return None


def department_from_expa_fields(function_name="", committee_department_name=""):
    """
    Build department + academy from EXPA memberPosition fields.

    committee_department.name (e.g. OGV) drives the academy slug when present;
    function.name (e.g. OGX - Outgoing Exchange) provides the long department label.
    """
    committee = (committee_department_name or "").strip()
    func = (function_name or "").strip()

    academy_key = ""
    if committee:
        academy_key = resolve_academy_key(committee) or ""
    if not academy_key and func:
        academy_key = resolve_academy_key(func) or ""

    func_parsed = parse_expa_department(func) if func else None

    if committee:
        code = committee[:50]
        name = FUNCTION_CODE_TO_TYPE.get(committee.upper(), committee)
        if func_parsed and func_parsed[1]:
            name = func_parsed[1]
        raw = f"{func} · {committee}" if func else committee
    elif func_parsed:
        code, name = func_parsed[0], func_parsed[1]
        raw = func
    else:
        code, name, raw = "", "", ""

    return {
        "committee_department": committee[:50],
        "department_code": code,
        "department_name": name[:255],
        "department_raw": raw[:255],
        "academy_key": academy_key or "",
    }
