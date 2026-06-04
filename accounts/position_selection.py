"""Pick the current EXPA member position (active, most recent start date)."""

from datetime import date

from .expa_oauth import _coerce_date, iter_positions, position_is_active


def position_start_key(item):
    """Sort key: latest start_date wins."""
    d = _coerce_date((item or {}).get("start_date"))
    return d or date.min


def pick_current_position_row(rows):
    """
    Choose the position that matches EXPA "Active Roles" in the UI:
    prefer ongoing (active) positions, then the one with the latest start_date.
    """
    if not rows:
        return {}
    active = [r for r in rows if position_is_active(r)]
    pool = active if active else rows
    return max(pool, key=position_start_key)


def pick_current_from_profile(profile):
    """Current position from GIS profile member_positions / current_positions."""
    positions = list(iter_positions(profile))
    if not positions:
        return None
    active = [p for p in positions if position_is_active(p)]
    pool = active if active else positions
    return max(pool, key=position_start_key)
