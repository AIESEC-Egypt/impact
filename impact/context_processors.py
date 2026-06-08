from django.conf import settings


def site_support(request):
    return {
        "support_contact": settings.SUPPORT_CONTACT_NAME,
    }
