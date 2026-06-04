"""Who may use the hidden /manage/ academy content portal."""

from django.contrib.auth import REDIRECT_FIELD_NAME
from django.contrib import messages
from django.shortcuts import redirect
from django.urls import reverse
from functools import wraps
from urllib.parse import urlencode

from accounts.member_roster import post_login_target_for_path

from .models import Academy, AcademyContentManager


def normalize_expa_id(expa_id):
    if expa_id is None:
        return ""
    return str(expa_id).strip()


def is_site_admin(user):
    return user.is_authenticated and (user.is_staff or user.is_superuser)


def user_expa_id(user):
    if not user.is_authenticated:
        return ""
    return normalize_expa_id(getattr(user, "expa_id", ""))


def manager_assignment(user, academy):
    expa = user_expa_id(user)
    if not expa:
        return None
    return (
        AcademyContentManager.objects.filter(
            academy=academy,
            expa_id=expa,
            is_active=True,
        )
        .select_related("academy")
        .first()
    )


def can_manage_academy(user, academy):
    if not user.is_authenticated or academy is None:
        return False
    if is_site_admin(user):
        return True
    return manager_assignment(user, academy) is not None


def managed_academies_queryset(user):
    qs = Academy.objects.filter(kind=Academy.KIND_ACADEMY).order_by("order", "key")
    if not user.is_authenticated:
        return qs.none()
    if is_site_admin(user):
        return qs
    expa = user_expa_id(user)
    if not expa:
        return qs.none()
    keys = AcademyContentManager.objects.filter(
        expa_id=expa, is_active=True
    ).values_list("academy_id", flat=True)
    return qs.filter(pk__in=keys)


def manage_login_required(view_func):
    """EXPA login, same as public academies."""

    @wraps(view_func)
    def _wrapped(request, *args, **kwargs):
        if request.user.is_authenticated:
            return view_func(request, *args, **kwargs)
        login_url = reverse("accounts:login")
        next_path = post_login_target_for_path(request.get_full_path())
        query = urlencode({REDIRECT_FIELD_NAME: next_path})
        return redirect(f"{login_url}?{query}")

    return _wrapped


def require_manage_academy(view_func):
    """View must receive `key`; user must manage that academy."""

    @wraps(view_func)
    def _wrapped(request, key, *args, **kwargs):
        academy = Academy.objects.filter(key=key, kind=Academy.KIND_ACADEMY).first()
        if not academy:
            messages.error(request, "Academy not found.")
            return redirect("lms:manage_hub")
        if not can_manage_academy(request.user, academy):
            messages.error(
                request,
                "You are not assigned as a content manager for this academy. "
                "Ask a site admin to add your EXPA ID in Django admin.",
            )
            return redirect("lms:manage_hub")
        request.manage_academy = academy
        request.manage_assignment = manager_assignment(request.user, academy)
        return view_func(request, key, *args, **kwargs)

    return _wrapped
