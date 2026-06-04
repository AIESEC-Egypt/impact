"""Infer EXPA department + role from GIS profile (login-time fallback)."""

from .expa_oauth import _role_name
from .expa_roster_sync import _parse_position_row
from .position_selection import pick_current_from_profile


def department_from_profile(profile):
    """Department/role/academy from the current active EXPA position."""
    pos = pick_current_from_profile(profile)
    if not pos:
        return None
    func = (pos or {}).get("function") or {}
    func_raw = func.get("name") if isinstance(func, dict) else str(func or "")
    committee = (pos or {}).get("committee_department") or {}
    committee_raw = (
        committee.get("name") if isinstance(committee, dict) else str(committee or "")
    )
    role_raw = _role_name(pos) or (pos or {}).get("title") or ""
    return _parse_position_row({
        "role_name": role_raw,
        "department_raw": func_raw,
        "committee_department_raw": committee_raw,
    })


def apply_department_from_profile(user, profile):
    """Set user role/department/academy from GIS profile positions."""
    inferred = department_from_profile(profile)
    if not inferred:
        return None
    user.role_code = inferred.get("role_code") or ""
    user.role_name = inferred.get("role_name") or ""
    user.department_code = inferred.get("department_code") or ""
    user.department_name = inferred.get("department_name") or ""
    user.academy_key = inferred.get("academy_key") or ""
    return inferred
