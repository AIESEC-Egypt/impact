from django.utils import timezone

from TMHub.models import MemberQuizAssignment, QuizAssignmentRule


def refresh_member_assignments(expa_person):
    """
    Refresh assigned quizzes for a member using strict role+function matching.
    Uses EXPAPerson.role_code and EXPAPerson.function (general.Function).
    Returns dict with counters.
    """
    created = 0
    updated = 0
    expired = 0
    if not expa_person.function_id or not (expa_person.role_code or "").strip():
        return {"created": 0, "updated": 0, "expired": 0}

    matching_rules = QuizAssignmentRule.objects.filter(
        is_active=True,
        role_code__iexact=expa_person.role_code.strip(),
        function_id=expa_person.function_id,
    ).select_related("quiz")
    matched_quiz_ids = set()

    for rule in matching_rules:
        matched_quiz_ids.add(rule.quiz_id)
        assignment, was_created = MemberQuizAssignment.objects.get_or_create(
            expa_person=expa_person,
            quiz=rule.quiz,
            defaults={"rule": rule, "status": "assigned"},
        )
        if was_created:
            created += 1
            continue
        changed = False
        if assignment.rule_id != rule.id:
            assignment.rule = rule
            changed = True
        if assignment.status == "expired":
            assignment.status = "assigned"
            assignment.completed_at = None
            changed = True
        if changed:
            assignment.save(update_fields=["rule", "status", "completed_at"])
            updated += 1

    to_expire = MemberQuizAssignment.objects.filter(
        expa_person=expa_person,
        status="assigned",
    ).exclude(quiz_id__in=matched_quiz_ids)
    expired += to_expire.update(status="expired", completed_at=timezone.now())
    return {"created": created, "updated": updated, "expired": expired}


def refresh_all_member_assignments():
    totals = {"created": 0, "updated": 0, "expired": 0}
    from general.models import EXPAPerson
    for expa_person in EXPAPerson.objects.filter(function__isnull=False).exclude(role_code=""):
        result = refresh_member_assignments(expa_person)
        for k in totals:
            totals[k] += result.get(k, 0)
    return totals
