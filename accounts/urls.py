from django.urls import path

from . import views

app_name = "accounts"

urlpatterns = [
    path("login/", views.login_page, name="login"),
    path("expa/start/", views.expa_start, name="expa_start"),
    path("expa/callback/", views.expa_callback, name="expa_callback"),
    path("logout/", views.logout_view, name="logout"),
]
