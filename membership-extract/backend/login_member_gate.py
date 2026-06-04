# From general/expa_oauth.py – login_or_link_expa_user (membership gate + identity)

"""
After OAuth code exchange:
1. Resolve expa_id from GIS/token profile
2. Require EXPAPerson row exists (roster) – else "active assigned EXPA member"
3. Create/link ExpaAuthIdentity + Django User
4. Store access_token, refresh_token, raw_profile on identity
5. refresh_member_assignments(expa_person)
6. Return app JWT (graphql_jwt)
"""

def login_or_link_expa_user_summary():
    return """
    expa_person = EXPAPerson.objects.filter(expa_id=expa_id).first()
    if not expa_person:
        raise ValueError(
            "You need to be an active assigned EXPA member to use this app."
        )

    identity = ExpaAuthIdentity.objects.filter(expa_id=expa_id).first()
    if not identity:
        user = User.objects.get_or_create(username=f"expa_{expa_id}", ...)[0]
        identity = ExpaAuthIdentity.objects.create(user=user, expa_person=expa_person, expa_id=expa_id)

    identity.access_token = payload["access_token"]
    identity.refresh_token = payload["refresh_token"]
    identity.raw_profile = profile
    identity.save()

    refresh_member_assignments(expa_person)
    jwt_token = get_token(user)
    return {"token": jwt_token, "user": user, "identity": identity}
    """
