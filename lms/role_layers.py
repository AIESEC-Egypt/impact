"""Role layers (TM, LCVP, MM, …) for layer-based mandatory quizzes."""

from accounts.role_mapping import ROLE_CODE_TO_FULL

# Canonical layer codes admins can assign (multi-select).
ROLE_LAYER_CHOICES = [
    ("Member", "Member"),
    ("TM", "TM (Teamster)"),
    ("TL", "TL (Team Leader)"),
    ("LCVP", "LCVP"),
    ("LCP", "LCP (Local Committee President)"),
    ("MCVP", "MCVP"),
    ("MCP", "MCP"),
    ("MM", "MM (Middle Manager)"),
    ("ESTL", "ESTL"),
    ("AIVP", "AIVP"),
    ("Director", "Director"),
    ("NST", "NST"),
]

ROLE_LAYER_CODES = {code for code, _ in ROLE_LAYER_CHOICES}

# Map EXPA / roster role_code variants to a canonical layer key.
_CODE_ALIASES = {
    "MIDDLE MANAGER": "MM",
    "MIDDLE MANAGERS": "MM",
    "MIDDLEMANAGER": "MM",
}
for code in ROLE_CODE_TO_FULL:
    if code in ROLE_LAYER_CODES:
        _CODE_ALIASES[code.upper()] = code


def canonical_member_layer(role_code="", role_name=""):
    """Normalize a member's EXPA role to a layer code, or None if unknown."""
    code = (role_code or "").strip()
    name = (role_name or "").strip()

    if code:
        if code in ROLE_LAYER_CODES:
            return code
        upper = code.upper()
        if upper in _CODE_ALIASES:
            return _CODE_ALIASES[upper]
        if upper in ROLE_LAYER_CODES:
            return upper if upper in ROLE_LAYER_CODES else code

    if name:
        upper_name = name.upper()
        if "MIDDLE MANAGER" in upper_name:
            return "MM"
        for layer in ROLE_LAYER_CODES:
            if layer.upper() in upper_name or upper_name.startswith(layer.upper()):
                return layer
        if name in ROLE_CODE_TO_FULL.values():
            from accounts.role_mapping import ROLE_FULL_TO_CODE

            return ROLE_FULL_TO_CODE.get(name)

    return code[:50] if code else None


def exam_is_mandatory_for(exam, role_code="", role_name=""):
    """
    True if this exam is mandatory for the given member layer.

    - mandatory_layers set → mandatory only for listed layers
    - is_mandatory True and no layers → mandatory for everyone (legacy / Dreaming)
    - otherwise optional
    """
    layers = exam.get_mandatory_layers_list()
    if layers:
        member_layer = canonical_member_layer(role_code, role_name)
        if not member_layer:
            return False
        return member_layer in layers
    return bool(exam.is_mandatory)


def format_layers_list(layers):
    if not layers:
        return ""
    return ", ".join(layers)
