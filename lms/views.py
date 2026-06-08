from django.contrib import messages
from django.db.utils import DatabaseError
from django.http import Http404
from django.shortcuts import get_object_or_404, redirect, render
from django.urls import reverse

from accounts.decorators import expa_login_required
from accounts.views import handle_oauth_callback

from .academy_themes import academies_for_chooser, get_academy_theme
from .models import Academy, Attempt, Answer, Exam, HomePromo


def home(request):
    """Site root.

    Doubles as the EXPA OAuth callback because the registered redirect_uri is
    the site root. If a ?code= is present we complete the login, otherwise we
    render the landing page.
    """
    code = request.GET.get("code")
    if code and not request.user.is_authenticated:
        return handle_oauth_callback(request, code)
    try:
        home_promos = list(HomePromo.objects.filter(is_published=True))
    except DatabaseError:
        home_promos = []
    return render(request, "index.html", {"home_promos": home_promos})


def _published_academies():
    return Academy.objects.filter(is_published=True, kind=Academy.KIND_ACADEMY)


def _exam_page_context(academy, **extra):
    """Shared template context for quiz take / result pages."""
    dream_theme = academy.kind == Academy.KIND_DREAMING
    if dream_theme:
        cancel_url = reverse("lms:dreaming")
        back_label = "Dreaming Process"
    else:
        cancel_url = academy.get_absolute_url()
        back_label = academy.title
    return {
        "academy": academy,
        "dream_theme": dream_theme,
        "cancel_url": cancel_url,
        "back_label": back_label,
        **extra,
    }


def _material_sections(materials):
    """Group published materials by legacy section heading."""
    sections = []
    current_title = None
    current_items = []
    for material in materials:
        title = (material.section_group or "").strip()
        if title != current_title:
            if current_items:
                sections.append({"title": current_title or "", "materials": current_items})
            current_title = title
            current_items = []
        current_items.append(material)
    if current_items:
        sections.append({"title": current_title or "", "materials": current_items})
    return sections


def _visible_materials(academy):
    """Published materials for the public page.

    Hide legacy HTML imports (static card graphic only, no link or upload).
    Show admin/manage rows that have a Drive URL and/or uploaded thumbnail,
    even if a legacy card_image path is still on the row.
    """
    from django.db.models import Q

    legacy_card_only = Q(card_image__startswith="Academy/") & (
        Q(url="") | Q(url__isnull=True)
    ) & (Q(thumbnail__isnull=True) | Q(thumbnail=""))
    return academy.materials.filter(is_published=True).exclude(legacy_card_only)


def academy_context(academy):
    materials = _visible_materials(academy)
    return {
        "academy": academy,
        "materials": materials,
        "material_sections": _material_sections(materials),
        "sessions": academy.sessions.filter(is_published=True),
        "exams": academy.exams.filter(is_published=True, kind=Exam.KIND_EXAM),
    }


@expa_login_required
def academy_chooser(request):
    """Let members pick which functional academy to open (after login)."""
    return render(
        request,
        "lms/academy_chooser.html",
        {"academy_cards": academies_for_chooser(_published_academies())},
    )


@expa_login_required
def academy_detail(request, key):
    if key == "mxp":
        return redirect("lms:academy_detail", key="tm")
    canonical = (key or "").strip().lower()
    if canonical != key:
        return redirect("lms:academy_detail", key=canonical)
    academy = Academy.objects.filter(key__iexact=key, is_published=True).first()
    if not academy:
        raise Http404
    if academy.key != canonical:
        return redirect("lms:academy_detail", key=academy.key)
    context = academy_context(academy)
    context["user_attempts"] = {
        a.exam_id: a
        for a in Attempt.objects.filter(user=request.user, exam__academy=academy)
        .order_by("exam_id", "-percentage")
    }
    user = request.user
    if user.department_code and user.department_name:
        context["user_department"] = (
            f"{user.department_code} — {user.department_name}"
            if user.department_name != user.department_code
            else user.department_code
        )
    else:
        context["user_department"] = user.department_code or user.department_name or ""
    if user.role_code and user.role_name:
        context["user_role"] = (
            f"{user.role_code} — {user.role_name}"
            if user.role_name != user.role_code
            else user.role_code
        )
    else:
        context["user_role"] = user.role_code or user.role_name or ""
    context["academy_theme"] = get_academy_theme(academy.key)
    return render(request, "lms/academy_detail.html", context)


@expa_login_required
def dreaming(request):
    academy = Academy.objects.filter(kind=Academy.KIND_DREAMING).first()
    quizzes = []
    if academy:
        quizzes = academy.exams.filter(is_published=True)
    return render(
        request,
        "dreaming.html",
        {"academy": academy, "knowledge_quizzes": quizzes},
    )


@expa_login_required
def exam_take(request, key, exam_id):
    from .exam_questions import (
        pop_question_ids_from_session,
        select_questions_for_attempt,
        store_question_ids_in_session,
    )

    academy = get_object_or_404(Academy, key=key)
    exam = get_object_or_404(Exam, id=exam_id, academy=academy, is_published=True)

    if not exam.can_attempt(request.user):
        messages.warning(request, "You have reached the maximum number of attempts.")
        return redirect(academy.get_absolute_url())

    if request.method == "POST":
        presented_ids = pop_question_ids_from_session(request, exam.id)
        if not presented_ids:
            messages.warning(
                request,
                "Your quiz session expired. Please open the quiz again to get a new set of questions.",
            )
            return redirect("lms:exam_take", key=academy.key, exam_id=exam.id)

        questions_by_id = {
            q.id: q
            for q in exam.questions.prefetch_related("choices").filter(id__in=presented_ids)
        }
        if len(questions_by_id) != len(presented_ids):
            messages.warning(request, "Invalid quiz submission. Please try again.")
            return redirect("lms:exam_take", key=academy.key, exam_id=exam.id)

        attempt = Attempt.objects.create(
            user=request.user,
            exam=exam,
            expa_id=(request.user.expa_id or "").strip(),
        )
        for qid in presented_ids:
            question = questions_by_id[qid]
            field = f"question_{question.id}"
            selected_ids = request.POST.getlist(field)
            answer = Answer.objects.create(attempt=attempt, question=question)
            if selected_ids:
                valid = question.choices.filter(id__in=selected_ids)
                answer.selected_choices.set(valid)
        attempt.grade()
        return redirect(
            "lms:exam_result", key=academy.key, exam_id=exam.id, attempt_id=attempt.id
        )

    questions = select_questions_for_attempt(exam)
    if not questions:
        messages.warning(request, "This quiz has no questions yet.")
        return redirect(academy.get_absolute_url())

    store_question_ids_in_session(request, exam.id, [q.id for q in questions])
    pool_size = exam.questions.count()

    return render(
        request,
        "lms/exam_take.html",
        _exam_page_context(
            academy,
            exam=exam,
            questions=questions,
            question_pool_size=pool_size,
            questions_shown=len(questions),
        ),
    )


@expa_login_required
def exam_result(request, key, exam_id, attempt_id):
    academy = get_object_or_404(Academy, key=key)
    exam = get_object_or_404(Exam, id=exam_id, academy=academy)
    attempt = get_object_or_404(Attempt, id=attempt_id, exam=exam, user=request.user)

    review = []
    for answer in (
        attempt.answers.select_related("question")
        .prefetch_related("question__choices", "selected_choices")
        .order_by("question__order", "question__id")
    ):
        question = answer.question
        selected = set(answer.selected_choices.values_list("id", flat=True))
        correct = question.correct_choice_ids
        review.append(
            {
                "question": question,
                "choices": question.choices.all(),
                "selected": selected,
                "correct": correct,
                "is_correct": bool(selected) and selected == correct,
            }
        )

    show_review = (not attempt.passed) or exam.show_correct_answers_after_pass

    return render(
        request,
        "lms/exam_result.html",
        _exam_page_context(
            academy,
            exam=exam,
            attempt=attempt,
            review=review,
            show_review=show_review,
        ),
    )
