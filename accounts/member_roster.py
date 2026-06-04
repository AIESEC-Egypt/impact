"""Member roster gate and post-login routing (EDM-style)."""

from django.conf import settings
from django.urls import reverse

from .models import MemberRoster
from .profile_department import department_from_profile


def roster_gate_enabled():
    """Use roster when enabled and at least one active member exists."""
    if not getattr(settings, "EXPA_USE_MEMBER_ROSTER", True):
        return False
    return MemberRoster.objects.filter(is_active=True).exists()


def get_roster_member(expa_id):
    if not expa_id:
        return None
    return MemberRoster.objects.filter(expa_id=str(expa_id), is_active=True).first()


def post_login_target_for_path(path):
    """Map the URL the user tried to open → where they land after EXPA login."""
    if not path:
        return "/"
    bare = path.split("?", 1)[0]
    if bare.startswith("/manage"):
        return reverse("lms:manage_hub")
    if bare.startswith("/academy/") and bare.rstrip("/") != "/academy":
        return reverse("lms:academy_chooser")
    return path


def login_redirect_url(session_next, expa_id, user=None):
    """After login: honor explicit destinations; academy links → function chooser."""
    del expa_id, user  # roster no longer auto-routes to one academy
    if session_next:
        target = post_login_target_for_path(session_next)
        if target not in ("/", "/accounts/login/", "/accounts/login"):
            return target
    return "/"


def apply_roster_to_user(user, expa_id, profile=None):
    """Copy role, department, and academy from roster onto the User record."""
    member = get_roster_member(expa_id)
    if not member:
        return None

    if profile and not member.department_code:
        inferred = department_from_profile(profile)
        if inferred:
            member.role_code = inferred["role_code"] or member.role_code
            member.role_name = inferred["role_name"] or member.role_name
            member.role_raw = inferred["role_raw"] or member.role_raw
            member.committee_department = inferred.get("committee_department") or ""
            member.department_code = inferred["department_code"]
            member.department_name = inferred["department_name"]
            member.department_raw = inferred["department_raw"]
            member.academy_key = inferred["academy_key"] or member.academy_key
            member.save(
                update_fields=[
                    "role_code",
                    "role_name",
                    "role_raw",
                    "committee_department",
                    "department_code",
                    "department_name",
                    "department_raw",
                    "academy_key",
                ]
            )

    user.role_code = member.role_code
    user.role_name = member.role_name
    user.department_code = member.department_code
    user.department_name = member.department_name
    user.academy_key = member.academy_key or ""
    if member.home_lc_name and not user.current_office:
        user.current_office = member.home_lc_name
    return member
