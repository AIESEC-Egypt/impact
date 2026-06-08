"""Aggregate quiz respondents (best attempt per member) for manage, admin, and export."""

from django.db.models import Q

from accounts.models import MemberRoster

from .models import Attempt, Exam

HOWYA_EXAM_TITLE = "AIESEC in Egypt History & Identity Assessment"
HOWYA_LEGACY_TITLES = ("El Haweya Knowledge Quiz",)


def _member_key(attempt):
    expa = (attempt.expa_id or "").strip()
    if expa:
        return f"expa:{expa}"
    if attempt.user_id:
        return f"user:{attempt.user_id}"
    return f"attempt:{attempt.pk}"


def _display_identity(attempt, roster_by_expa):
    user = attempt.user
    expa_id = (attempt.expa_id or getattr(user, "expa_id", "") or "").strip()
    roster = roster_by_expa.get(expa_id) if expa_id else None

    full_name = (
        (getattr(user, "full_name", "") or "").strip()
        or (roster.full_name if roster else "")
        or (getattr(user, "username", "") or "")
    )
    email = (
        (getattr(user, "email", "") or "").strip()
        or (roster.email if roster else "")
    )
    role_name = (
        (getattr(user, "role_name", "") or "").strip()
        or (roster.role_name if roster else "")
    )
    home_lc = (roster.home_lc_name if roster else "") or ""

    return {
        "expa_id": expa_id,
        "full_name": full_name,
        "email": email,
        "role_name": role_name,
        "home_lc": home_lc,
    }


def respondents_for_exam(exam):
    """
    One row per member who submitted at least one attempt for this exam.
    Best attempt = highest percentage, then most recent submitted_at.
    """
    attempts = (
        Attempt.objects.filter(exam=exam, submitted_at__isnull=False)
        .select_related("user")
        .order_by("-percentage", "-submitted_at")
    )

    expa_ids = {
        (a.expa_id or getattr(a.user, "expa_id", "") or "").strip()
        for a in attempts
    }
    expa_ids.discard("")
    roster_by_expa = {
        r.expa_id: r
        for r in MemberRoster.objects.filter(expa_id__in=expa_ids)
    }

    groups = {}
    for attempt in attempts:
        key = _member_key(attempt)
        groups.setdefault(key, []).append(attempt)

    rows = []
    for key, member_attempts in groups.items():
        best = member_attempts[0]
        identity = _display_identity(best, roster_by_expa)
        rows.append(
            {
                **identity,
                "user_id": best.user_id,
                "percentage": best.percentage,
                "passed": best.passed,
                "submitted_at": best.submitted_at,
                "attempt_count": len(member_attempts),
                "best_attempt_id": best.pk,
            }
        )

    rows.sort(
        key=lambda r: (
            not r["passed"],
            -(r["percentage"] or 0),
            r["full_name"].lower(),
        )
    )
    return rows


def resolve_howya_exam():
    """Dreaming academy Howya / El Haweya history certificate quiz."""
    titles = (HOWYA_EXAM_TITLE,) + HOWYA_LEGACY_TITLES
    return (
        Exam.objects.filter(academy__key="dreaming", title__in=titles)
        .select_related("academy")
        .order_by("-id")
        .first()
    )


def exam_respondents_payload(exam):
    respondents = respondents_for_exam(exam)
    return {
        "exam": {
            "id": exam.id,
            "title": exam.title,
            "academy_key": exam.academy.key,
            "academy_title": exam.academy.title,
        },
        "total_respondents": len(respondents),
        "respondents": [
            {
                "expa_id": r["expa_id"],
                "full_name": r["full_name"],
                "email": r["email"],
                "role_name": r["role_name"],
                "home_lc": r["home_lc"],
                "percentage": round(r["percentage"], 1),
                "passed": r["passed"],
                "submitted_at": r["submitted_at"].isoformat() if r["submitted_at"] else None,
                "attempt_count": r["attempt_count"],
            }
            for r in respondents
        ],
    }
