from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path
from django.views.generic import TemplateView

from lms import views as lms_views

urlpatterns = [
    path("admin/", admin.site.urls),
    path("accounts/", include("accounts.urls")),

    # Root doubles as the EXPA OAuth callback (registered redirect_uri).
    path("", lms_views.home, name="home"),

    # Public marketing pages (no login required).
    path("history/", TemplateView.as_view(template_name="AiE/History.html"), name="history"),
    path(
        "membership-ranking/",
        TemplateView.as_view(template_name="membership-ranking.html"),
        name="membership_ranking",
    ),
    path(
        "icx-apds-submissions/",
        TemplateView.as_view(template_name="icx-apds-submissions.html"),
        name="icx_apds",
    ),
    path(
        "b2b-contracts/",
        TemplateView.as_view(template_name="b2b-contracts.html"),
        name="b2b_contracts",
    ),
    path(
        "presentation/",
        TemplateView.as_view(template_name="Academy/presentation.html"),
        name="presentation",
    ),

    # LMS (gated academies, dreaming, exams).
    path("", include("lms.urls")),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
