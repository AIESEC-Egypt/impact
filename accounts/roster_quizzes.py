"""Quiz progress for roster members (linked by EXPA id)."""

from django.contrib.auth import get_user_model
from django.db.models import Q

from lms.models import Attempt, Exam
from lms.role_layers import exam_is_mandatory_for


def get_user_for_expa_id(expa_id):
    if not expa_id:
        return None
    return get_user_model().objects.filter(expa_id=str(expa_id)).order_by("-last_login").first()


def _normalize_academy_key(academy_key):
    if not academy_key:
        return None
    key = str(academy_key).strip()
    return key or None


def _member_role(expa_id, role_code=None, role_name=None):
    if role_code is not None or role_name is not None:
        return role_code or "", role_name or ""
    user = get_user_for_expa_id(expa_id)
    if user:
        return user.role_code or "", user.role_name or ""
    return "", ""


def attempts_for_expa_id(expa_id):
    """All submitted attempts for an EXPA member (stable across logins)."""
    if not expa_id:
        return Attempt.objects.none()
    expa_id = str(expa_id).strip()
    user_ids = list(
        get_user_model().objects.filter(expa_id=expa_id).values_list("id", flat=True)
    )
    query = Q(expa_id=expa_id)
    if user_ids:
        query |= Q(user_id__in=user_ids)
    return (
        Attempt.objects.filter(query, submitted_at__isnull=False)
        .select_related("exam", "exam__academy", "user")
        .order_by("exam_id", "-percentage", "-submitted_at")
    )


def best_attempts_by_exam(expa_id):
    """Return dict exam_id -> best Attempt (highest percentage, submitted)."""
    best = {}
    for att in attempts_for_expa_id(expa_id):
        if att.exam_id not in best:
            best[att.exam_id] = att
    return best


def _exam_visible_for_member(exam, academy_key, role_code, role_name):
    if exam_is_mandatory_for(exam, role_code, role_name):
        return True
    if academy_key and exam.academy.key == academy_key:
        return True
    return False


def quiz_progress_for_expa_id(
    expa_id,
    academy_key=None,
    role_code=None,
    role_name=None,
    *,
    admin_profile=False,
):
    """
    Quiz rows for a roster member, merged with their best attempt if any.

    When admin_profile=True, always include quizzes the member has attempted
    (e.g. Dreaming) even if optional / outside their functional academy.
    """
    user = get_user_for_expa_id(expa_id)
    role_code, role_name = _member_role(expa_id, role_code, role_name)
    best = best_attempts_by_exam(expa_id)
    academy_key = _normalize_academy_key(academy_key)
    if admin_profile:
        academy_key = None

    base = Exam.objects.filter(
        is_published=True,
        kind__in=(Exam.KIND_EXAM, Exam.KIND_QUIZ),
    ).select_related("academy")

    if academy_key:
        base = base.filter(
            Q(academy__key=academy_key)
            | Q(is_mandatory=True)
            | ~Q(mandatory_layers=[])
        ).distinct()

    exam_by_id = {exam.id: exam for exam in base.order_by("academy__order", "academy__key", "title")}
    for exam_id in best.keys():
        if exam_id not in exam_by_id:
            extra = (
                Exam.objects.filter(id=exam_id)
                .select_related("academy")
                .first()
            )
            if extra:
                exam_by_id[exam_id] = extra

    rows = []
    for exam in sorted(
        exam_by_id.values(),
        key=lambda e: (e.academy.order, e.academy.key, e.title),
    ):
        att = best.get(exam.id)
        if admin_profile:
            include = bool(att) or _exam_visible_for_member(
                exam, academy_key, role_code, role_name
            )
        else:
            include = _exam_visible_for_member(exam, academy_key, role_code, role_name)
        if not include:
            continue
        mandatory = exam_is_mandatory_for(exam, role_code, role_name)
        rows.append(
            {
                "exam": exam,
                "academy_key": exam.academy.key,
                "academy_title": exam.academy.title,
                "is_mandatory": mandatory,
                "mandatory_layers": exam.get_mandatory_layers_list(),
                "pass_mark": exam.pass_mark,
                "attempt": att,
                "percentage": att.percentage if att else None,
                "passed": att.passed if att else False,
                "submitted_at": att.submitted_at if att else None,
                "status": (
                    "passed"
                    if att and att.passed
                    else ("failed" if att else "not_started")
                ),
            }
        )
    return {"user": user, "rows": rows, "role_code": role_code, "role_name": role_name}


def mandatory_completion_summary(expa_id, academy_key=None, role_code=None, role_name=None):
    """Mandatory quizzes that apply to this member's layer."""
    progress = quiz_progress_for_expa_id(
        expa_id,
        academy_key=None,
        role_code=role_code,
        role_name=role_name,
        admin_profile=False,
    )
    mandatory = [r for r in progress["rows"] if r["is_mandatory"]]
    passed = [r for r in mandatory if r["passed"]]
    return {
        "mandatory_total": len(mandatory),
        "mandatory_passed": len(passed),
        "mandatory_pending": len(mandatory) - len(passed),
    }
