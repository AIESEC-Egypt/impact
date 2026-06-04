from django.urls import path

from . import manage_views, views

app_name = "lms"

urlpatterns = [
    path("dreaming/", views.dreaming, name="dreaming"),
    path("academy/", views.academy_chooser, name="academy_chooser"),
    path("academy/<slug:key>/", views.academy_detail, name="academy_detail"),
    path("academy/<slug:key>/exam/<int:exam_id>/", views.exam_take, name="exam_take"),
    path(
        "academy/<slug:key>/exam/<int:exam_id>/result/<int:attempt_id>/",
        views.exam_result,
        name="exam_result",
    ),
    # Hidden function content portal (not linked from public nav).
    path("manage/", manage_views.manage_hub, name="manage_hub"),
    path("manage/<slug:key>/", manage_views.manage_dashboard, name="manage_dashboard"),
    path(
        "manage/<slug:key>/materials/new/",
        manage_views.material_create,
        name="manage_material_create",
    ),
    path(
        "manage/<slug:key>/materials/<int:pk>/edit/",
        manage_views.material_edit,
        name="manage_material_edit",
    ),
    path(
        "manage/<slug:key>/materials/<int:pk>/delete/",
        manage_views.material_delete,
        name="manage_material_delete",
    ),
    path(
        "manage/<slug:key>/sessions/new/",
        manage_views.session_create,
        name="manage_session_create",
    ),
    path(
        "manage/<slug:key>/sessions/<int:pk>/edit/",
        manage_views.session_edit,
        name="manage_session_edit",
    ),
    path(
        "manage/<slug:key>/sessions/<int:pk>/delete/",
        manage_views.session_delete,
        name="manage_session_delete",
    ),
]
