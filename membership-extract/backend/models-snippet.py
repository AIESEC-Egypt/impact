# Reference models from general/models.py (Django)
# Copy fields into your project or import from general.models

"""
EXPAPerson – roster of members allowed in the app (synced from EXPA).
  expa_id (PK), person, office, is_member, role_code, role_name, function

ExpaAuthIdentity – links Django User ↔ EXPA person after OAuth login.
  user, expa_person, expa_id, access_token, refresh_token, token_expires_at,
  raw_profile (JSON), created_at, updated_at

ExpaConfig – server token for bulk member position fetch (not per-user login).
  access_token, graphql_url, default_office_id, date_from, date_to
"""

# --- Who logged in (OAuth identities) ---

def get_logged_in_identities_queryset():
    """
    Members who completed EXPA OAuth and are linked in the DB.
    Order by last login (updated_at).
    """
    from general.models import ExpaAuthIdentity
    return (
        ExpaAuthIdentity.objects
        .select_related("user", "expa_person", "expa_person__person", "expa_person__office")
        .order_by("-updated_at")
    )


def identity_to_dict(identity):
    ep = identity.expa_person
    person = ep.person if ep else None
    return {
        "expa_id": identity.expa_id,
        "username": identity.user.username if identity.user_id else None,
        "full_name": str(person) if person else None,
        "office": ep.office.office_name if ep and ep.office_id else None,
        "role_code": ep.role_code if ep else None,
        "function": ep.function.function_name if ep and ep.function_id else None,
        "last_login_at": identity.updated_at.isoformat() if identity.updated_at else None,
        "has_expa_token": bool(identity.access_token),
    }


def list_logged_in_members(limit=100):
    return [identity_to_dict(i) for i in get_logged_in_identities_queryset()[:limit]]


# --- Roster: who is allowed to log in (must exist as EXPAPerson) ---

def get_member_roster_queryset():
    from general.models import EXPAPerson
    return EXPAPerson.objects.filter(is_member=True).select_related(
        "person", "office", "function"
    )


def member_must_exist_in_roster(expa_id):
    """EDM gate in login_or_link_expa_user – raises ValueError if not in roster."""
    from general.models import EXPAPerson
    return EXPAPerson.objects.filter(expa_id=expa_id).first()
