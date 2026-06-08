"""EXPA OAuth views (server-side flow).

Flow:
  /accounts/login/          -> renders the "Login with EXPA" page
  /accounts/expa/start/     -> stores ?next, redirects to EXPA authorize URL
  callback (site root or /accounts/expa/callback/)
                            -> exchanges code, fetches profile, gates, logs in
"""

from django.conf import settings
from django.contrib import messages
from django.contrib.auth import get_user_model, login, logout
from django.shortcuts import redirect, render
from django.urls import reverse
from django.utils import timezone

from .expa_oauth import (
    build_authorize_url,
    current_office_name,
    eligibility_summary,
    evaluate_eligibility,
    exchange_code_for_token,
    fetch_profile,
    get_config,
    home_mc_name,
    log_expa_profile_responses,
)
from .member_roster import apply_roster_to_user, login_redirect_url
from .profile_department import apply_department_from_profile
from .models import LoginEvent

User = get_user_model()

NEXT_SESSION_KEY = "expa_login_next"


def login_page(request):
    if request.user.is_authenticated:
        return redirect(request.GET.get("next") or "/")
    request.session[NEXT_SESSION_KEY] = request.GET.get("next", "/")
    return render(request, "accounts/login.html", {"next": request.GET.get("next", "/")})


def expa_start(request):
    config = get_config()
    if not config.client_id:
        messages.error(
            request,
            f"EXPA login is not set up yet. Please contact {settings.SUPPORT_CONTACT_NAME}.",
        )
        return redirect("accounts:login")
    request.session[NEXT_SESSION_KEY] = request.GET.get(
        "next", request.session.get(NEXT_SESSION_KEY, "/")
    )
    return redirect(build_authorize_url(config))


def _client_ip(request):
    forwarded = request.META.get("HTTP_X_FORWARDED_FOR")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR")


def handle_oauth_callback(request, code):
    """Shared callback logic. Returns an HttpResponse."""
    config = get_config()
    try:
        token_data = exchange_code_for_token(config, code)
    except Exception:
        messages.error(request, "Could not complete EXPA login. Please try again.")
        return redirect("accounts:login")

    access_token = token_data.get("access_token")
    if not access_token:
        messages.error(request, "EXPA did not return an access token.")
        return redirect("accounts:login")

    try:
        profile, raw_sources = fetch_profile(config, access_token)
    except Exception:
        messages.error(request, "Could not load your EXPA profile.")
        return redirect("accounts:login")

    allowed, reason = evaluate_eligibility(profile, config)
    summary = eligibility_summary(profile, config)
    log_expa_profile_responses(
        raw_sources,
        profile,
        allowed=allowed,
        reason=reason,
        summary=summary,
    )
    if not allowed:
        return render(
            request,
            "accounts/access_denied.html",
            {"reason": reason},
            status=403,
        )

    expa_id = str(profile.get("id") or "")
    email = profile.get("email") or f"expa_{expa_id}@aiesec.net"
    full_name = profile.get("full_name") or profile.get("first_name") or email

    username = f"expa_{expa_id}" if expa_id else email
    user, _created = User.objects.get_or_create(
        username=username,
        defaults={"email": email},
    )
    user.expa_id = expa_id
    user.email = email
    user.full_name = full_name
    user.home_mc = home_mc_name(profile)
    user.current_office = current_office_name(profile)
    roster_member = apply_roster_to_user(user, expa_id, profile=profile)
    if not roster_member:
        apply_department_from_profile(user, profile)
    user.is_active_member = True
    user.profile_json = profile
    user.last_synced = timezone.now()
    if full_name and " " in full_name and not user.first_name:
        user.first_name, _, user.last_name = full_name.partition(" ")
    user.save()

    login(request, user)
    LoginEvent.objects.create(
        user=user,
        ip_address=_client_ip(request),
        user_agent=request.META.get("HTTP_USER_AGENT", "")[:512],
    )

    session_next = request.session.pop(NEXT_SESSION_KEY, None)
    next_url = login_redirect_url(session_next, expa_id, user=user)
    academy_key = (roster_member.academy_key if roster_member else None) or user.academy_key
    if academy_key:
        if roster_member:
            dept = roster_member.department_display
            role = roster_member.role_display
        else:
            dept = user.department_name or user.department_code
            role = user.role_name or user.role_code
        parts = [f"Welcome, {user.full_name}!"]
        if role:
            parts.append(f"Role: {role}.")
        if dept:
            parts.append(f"Department: {dept}.")
        messages.success(request, " ".join(parts))
    else:
        messages.success(request, f"Welcome, {user.full_name}!")
    return redirect(next_url)


def expa_callback(request):
    """Dedicated callback endpoint (used when redirect_uri points here)."""
    code = request.GET.get("code")
    if not code:
        messages.error(request, "Missing authorization code.")
        return redirect("accounts:login")
    return handle_oauth_callback(request, code)


def logout_view(request):
    logout(request)
    messages.info(request, "You have been logged out.")
    return redirect("/")
