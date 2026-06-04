from functools import wraps
from urllib.parse import urlencode

from django.contrib.auth import REDIRECT_FIELD_NAME
from django.shortcuts import redirect
from django.urls import reverse

from .member_roster import post_login_target_for_path


def expa_login_required(view_func):
    """Like login_required, but always sends users to the EXPA login page."""

    @wraps(view_func)
    def _wrapped(request, *args, **kwargs):
        if request.user.is_authenticated:
            return view_func(request, *args, **kwargs)
        login_url = reverse("accounts:login")
        next_path = post_login_target_for_path(request.get_full_path())
        query = urlencode({REDIRECT_FIELD_NAME: next_path})
        return redirect(f"{login_url}?{query}")

    return _wrapped
