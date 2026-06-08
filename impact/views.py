from django.conf import settings
from django.shortcuts import render


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
