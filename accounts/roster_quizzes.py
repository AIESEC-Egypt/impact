"""Quiz progress for roster members (linked by EXPA id)."""

from django.contrib.auth import get_user_model
from django.db.models import Q

from lms.models import Attempt, Exam
from lms.role_layers import exam_is_mandatory_for


def get_user_for_expa_id(expa_id):
    if not expa_id:
        return None
    return get_user_model().objects.filter(expa_id=str(expa_id)).first()


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


def best_attempts_by_exam(user):
    """Return dict exam_id -> best Attempt (highest percentage, submitted)."""
    if not user:
        return {}
    attempts = (
        Attempt.objects.filter(user=user, submitted_at__isnull=False)
        .select_related("exam", "exam__academy")
        .order_by("exam_id", "-percentage", "-submitted_at")
    )
    best = {}
    for att in attempts:
        if att.exam_id not in best:
            best[att.exam_id] = att
    return best


def _exam_visible_for_member(exam, academy_key, role_code, role_name):
    if exam_is_mandatory_for(exam, role_code, role_name):
        return True
    if academy_key and exam.academy.key == academy_key:
        return True
    return False


def quiz_progress_for_expa_id(expa_id, academy_key=None, role_code=None, role_name=None):
    """
    Quiz rows for a roster member, merged with their best attempt if any.
    """
    user = get_user_for_expa_id(expa_id)
    role_code, role_name = _member_role(expa_id, role_code, role_name)
    best = best_attempts_by_exam(user)
    academy_key = _normalize_academy_key(academy_key)

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
    exams = base.order_by("academy__order", "academy__key", "title")

    rows = []
    for exam in exams:
        if not _exam_visible_for_member(exam, academy_key, role_code, role_name):
            continue
        att = best.get(exam.id)
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
    )
    mandatory = [r for r in progress["rows"] if r["is_mandatory"]]
    passed = [r for r in mandatory if r["passed"]]
    return {
        "mandatory_total": len(mandatory),
        "mandatory_passed": len(passed),
        "mandatory_pending": len(mandatory) - len(passed),
    }
