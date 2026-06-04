from django.contrib import messages
from django.shortcuts import get_object_or_404, redirect, render
from django.views.decorators.http import require_POST

from .academy_themes import get_academy_theme
from .manage_access import (
    is_site_admin,
    manage_login_required,
    managed_academies_queryset,
    require_manage_academy,
    user_expa_id,
)
from .manage_forms import MaterialManageForm, SessionManageForm
from .models import Academy, Material, Session


def _manage_context(request, academy, **extra):
    theme = get_academy_theme(academy.key)
    return {
        "academy": academy,
        "academy_theme": theme,
        "is_site_admin": is_site_admin(request.user),
        "manager_assignment": getattr(request, "manage_assignment", None),
        "user_expa_id": user_expa_id(request.user),
        **extra,
    }


@manage_login_required
def manage_hub(request):
    academies = list(managed_academies_queryset(request.user))
    if not academies and request.user.is_authenticated:
        messages.info(
            request,
            "No academy is assigned to your EXPA ID yet. "
            "A site admin can add you under LMS → Academy content managers.",
        )
    return render(
        request,
        "lms/manage/hub.html",
        {
            "academies": academies,
            "is_site_admin": is_site_admin(request.user),
            "user_expa_id": user_expa_id(request.user),
        },
    )


@manage_login_required
@require_manage_academy
def manage_dashboard(request, key):
    academy = request.manage_academy
    materials = academy.materials.order_by("order", "id")
    sessions = academy.sessions.order_by("order", "id")
    ctx = _manage_context(
        request,
        academy,
        materials=materials,
        sessions=sessions,
        published_materials=materials.filter(is_published=True).count(),
        published_sessions=sessions.filter(is_published=True).count(),
    )
    return render(request, "lms/manage/dashboard.html", ctx)


@manage_login_required
@require_manage_academy
def material_create(request, key):
    academy = request.manage_academy
    if request.method == "POST":
        form = MaterialManageForm(request.POST, request.FILES)
        if form.is_valid():
            obj = form.save(commit=False)
            obj.academy = academy
            obj.save()
            messages.success(request, f"Added material “{obj.title}”.")
            return redirect("lms:manage_dashboard", key=key)
    else:
        next_order = academy.materials.count() + 1
        form = MaterialManageForm(initial={"order": next_order, "is_published": True})
    return render(
        request,
        "lms/manage/material_form.html",
        _manage_context(request, academy, form=form, editing=False),
    )


@manage_login_required
@require_manage_academy
def material_edit(request, key, pk):
    academy = request.manage_academy
    material = get_object_or_404(Material, pk=pk, academy=academy)
    if request.method == "POST":
        form = MaterialManageForm(request.POST, request.FILES, instance=material)
        if form.is_valid():
            form.save()
            messages.success(request, "Material updated.")
            return redirect("lms:manage_dashboard", key=key)
    else:
        form = MaterialManageForm(instance=material)
    return render(
        request,
        "lms/manage/material_form.html",
        _manage_context(request, academy, form=form, editing=True, item=material),
    )


@manage_login_required
@require_manage_academy
@require_POST
def material_delete(request, key, pk):
    academy = request.manage_academy
    material = get_object_or_404(Material, pk=pk, academy=academy)
    title = material.title
    material.delete()
    messages.success(request, f"Removed “{title}”.")
    return redirect("lms:manage_dashboard", key=key)


@manage_login_required
@require_manage_academy
def session_create(request, key):
    academy = request.manage_academy
    if request.method == "POST":
        form = SessionManageForm(request.POST, request.FILES)
        if form.is_valid():
            obj = form.save(commit=False)
            obj.academy = academy
            obj.save()
            messages.success(request, f"Added session “{obj.title}”.")
            return redirect("lms:manage_dashboard", key=key)
    else:
        next_order = academy.sessions.count() + 1
        form = SessionManageForm(initial={"order": next_order, "is_published": True})
    return render(
        request,
        "lms/manage/session_form.html",
        _manage_context(request, academy, form=form, editing=False),
    )


@manage_login_required
@require_manage_academy
def session_edit(request, key, pk):
    academy = request.manage_academy
    session = get_object_or_404(Session, pk=pk, academy=academy)
    if request.method == "POST":
        form = SessionManageForm(request.POST, request.FILES, instance=session)
        if form.is_valid():
            form.save()
            messages.success(request, "Session updated.")
            return redirect("lms:manage_dashboard", key=key)
    else:
        form = SessionManageForm(instance=session)
    return render(
        request,
        "lms/manage/session_form.html",
        _manage_context(request, academy, form=form, editing=True, item=session),
    )


@manage_login_required
@require_manage_academy
@require_POST
def session_delete(request, key, pk):
    academy = request.manage_academy
    session = get_object_or_404(Session, pk=pk, academy=academy)
    title = session.title
    session.delete()
    messages.success(request, f"Removed “{title}”.")
    return redirect("lms:manage_dashboard", key=key)
