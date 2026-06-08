from django.conf import settings
from django.contrib import messages
from django.core.exceptions import ValidationError
from django.shortcuts import get_object_or_404, redirect, render
from django.urls import reverse
from django.views.decorators.http import require_POST

from .academy_themes import get_academy_theme
from .exam_respondents import resolve_haweya_exam, respondents_for_exam
from .manage_access import (
    is_site_admin,
    manage_login_required,
    managed_academies_queryset,
    require_manage_academy,
    user_expa_id,
)
from .manage_forms import (
    ChoiceFormSet,
    ExamManageForm,
    MaterialManageForm,
    QuestionManageForm,
    SessionManageForm,
    validate_question_choices,
)
from .models import Academy, Exam, Material, Question, Session


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
            f"No academy is assigned to your EXPA ID yet. "
            f"Contact {settings.SUPPORT_CONTACT_NAME} to get access.",
        )
    haweya_exam = resolve_haweya_exam() if is_site_admin(request.user) else None
    return render(
        request,
        "lms/manage/hub.html",
        {
            "academies": academies,
            "haweya_exam": haweya_exam,
            "is_site_admin": is_site_admin(request.user),
            "user_expa_id": user_expa_id(request.user),
        },
    )


def _get_exam(academy, exam_id):
    return get_object_or_404(
        Exam,
        pk=exam_id,
        academy=academy,
        kind__in=(Exam.KIND_EXAM, Exam.KIND_QUIZ),
    )


def _blank_question_forms(exam):
    next_order = exam.questions.count() + 1
    form = QuestionManageForm(initial={"order": next_order, "points": 1})
    formset = ChoiceFormSet()
    return form, formset


def _try_save_new_question(exam, post_data):
    form = QuestionManageForm(post_data)
    formset = ChoiceFormSet(post_data)
    if not (form.is_valid() and formset.is_valid()):
        return False, form, formset
    try:
        validate_question_choices(
            form.cleaned_data["question_type"],
            formset.cleaned_data,
        )
    except ValidationError as exc:
        form.add_error(None, exc)
        return False, form, formset
    question = form.save(commit=False)
    question.exam = exam
    question.save()
    formset.instance = question
    formset.save()
    return True, form, formset


def _exam_questions_redirect(key, exam_id, add_another=False):
    url = reverse("lms:manage_exam_questions", args=[key, exam_id])
    if add_another:
        return redirect(f"{url}#add-question")
    return redirect(url)


@manage_login_required
@require_manage_academy
def manage_dashboard(request, key):
    academy = request.manage_academy
    materials = academy.materials.order_by("order", "id")
    sessions = academy.sessions.order_by("order", "id")
    exams = academy.exams.filter(kind=Exam.KIND_EXAM).order_by("title", "id")
    ctx = _manage_context(
        request,
        academy,
        materials=materials,
        sessions=sessions,
        exams=exams,
        published_materials=materials.filter(is_published=True).count(),
        published_sessions=sessions.filter(is_published=True).count(),
        published_exams=exams.filter(is_published=True).count(),
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


@manage_login_required
@require_manage_academy
def exam_create(request, key):
    academy = request.manage_academy
    if request.method == "POST":
        form = ExamManageForm(request.POST)
        if form.is_valid():
            obj = form.save(commit=False)
            obj.academy = academy
            obj.kind = Exam.KIND_EXAM
            obj.save()
            messages.success(request, f"Created quiz “{obj.title}”. Add questions next.")
            return redirect("lms:manage_exam_questions", key=key, exam_id=obj.pk)
    else:
        form = ExamManageForm(initial={"is_published": False, "pass_mark": 60})
    return render(
        request,
        "lms/manage/exam_form.html",
        _manage_context(request, academy, form=form, editing=False),
    )


@manage_login_required
@require_manage_academy
def exam_edit(request, key, exam_id):
    academy = request.manage_academy
    exam = _get_exam(academy, exam_id)
    if request.method == "POST":
        form = ExamManageForm(request.POST, instance=exam)
        if form.is_valid():
            form.save()
            messages.success(request, "Quiz settings updated.")
            return redirect("lms:manage_exam_questions", key=key, exam_id=exam.pk)
    else:
        form = ExamManageForm(instance=exam)
    return render(
        request,
        "lms/manage/exam_form.html",
        _manage_context(request, academy, form=form, editing=True, exam=exam),
    )


@manage_login_required
@require_manage_academy
@require_POST
def exam_delete(request, key, exam_id):
    academy = request.manage_academy
    exam = _get_exam(academy, exam_id)
    title = exam.title
    exam.delete()
    messages.success(request, f"Removed quiz “{title}”.")
    return redirect("lms:manage_dashboard", key=key)


@manage_login_required
@require_manage_academy
def exam_questions(request, key, exam_id):
    academy = request.manage_academy
    exam = _get_exam(academy, exam_id)
    questions = exam.questions.prefetch_related("choices").order_by("order", "id")

    if request.method == "POST":
        saved, form, formset = _try_save_new_question(exam, request.POST)
        if saved:
            messages.success(request, "Question added.")
            return _exam_questions_redirect(
                key,
                exam.pk,
                add_another="add_another" in request.POST,
            )
    else:
        form, formset = _blank_question_forms(exam)

    return render(
        request,
        "lms/manage/exam_questions.html",
        _manage_context(
            request,
            academy,
            exam=exam,
            questions=questions,
            respondents=respondents_for_exam(exam),
            form=form,
            formset=formset,
        ),
    )


@manage_login_required
@require_manage_academy
def question_create(request, key, exam_id):
    """Legacy URL — quiz builder lives on the questions page."""
    academy = request.manage_academy
    exam = _get_exam(academy, exam_id)
    if request.method == "POST":
        saved, form, formset = _try_save_new_question(exam, request.POST)
        if saved:
            messages.success(request, "Question added.")
            return _exam_questions_redirect(
                key,
                exam.pk,
                add_another="add_another" in request.POST,
            )
        questions = exam.questions.prefetch_related("choices").order_by("order", "id")
        return render(
            request,
            "lms/manage/exam_questions.html",
            _manage_context(
                request,
                academy,
                exam=exam,
                questions=questions,
                form=form,
                formset=formset,
            ),
        )
    return redirect(
        f"{reverse('lms:manage_exam_questions', args=[key, exam_id])}#add-question"
    )


@manage_login_required
@require_manage_academy
def question_edit(request, key, exam_id, pk):
    academy = request.manage_academy
    exam = _get_exam(academy, exam_id)
    question = get_object_or_404(Question, pk=pk, exam=exam)
    if request.method == "POST":
        form = QuestionManageForm(request.POST, instance=question)
        formset = ChoiceFormSet(request.POST, instance=question)
        if form.is_valid() and formset.is_valid():
            try:
                validate_question_choices(
                    form.cleaned_data["question_type"],
                    formset.cleaned_data,
                )
            except ValidationError as exc:
                form.add_error(None, exc)
            else:
                form.save()
                formset.save()
                messages.success(request, "Question updated.")
                return redirect("lms:manage_exam_questions", key=key, exam_id=exam.pk)
    else:
        form = QuestionManageForm(instance=question)
        formset = ChoiceFormSet(instance=question)
    return render(
        request,
        "lms/manage/question_form.html",
        _manage_context(
            request,
            academy,
            exam=exam,
            form=form,
            formset=formset,
            editing=True,
            question=question,
        ),
    )


@manage_login_required
@require_manage_academy
@require_POST
def question_delete(request, key, exam_id, pk):
    academy = request.manage_academy
    exam = _get_exam(academy, exam_id)
    question = get_object_or_404(Question, pk=pk, exam=exam)
    question.delete()
    messages.success(request, "Question removed.")
    return redirect("lms:manage_exam_questions", key=key, exam_id=exam.pk)
