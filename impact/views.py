from django.conf import settings
from django.http import HttpResponse
from django.shortcuts import render


def health(request):
    """Plain 200 for Docker/Coolify probes (no HTTPS redirect)."""
    return HttpResponse("ok", content_type="text/plain")


def page_not_found(request, exception):
    return render(
        request,
        "errors/404.html",
        {"support_contact": settings.SUPPORT_CONTACT_NAME},
        status=404,
    )


def server_error(request):
    return render(
        request,
        "errors/500.html",
        {"support_contact": settings.SUPPORT_CONTACT_NAME},
        status=500,
    )
