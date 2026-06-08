"""Token-protected JSON exports for quiz respondents (Apps Script / Sheets)."""

from django.conf import settings
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.http import require_GET

from .exam_respondents import exam_respondents_payload, resolve_haweya_exam
from .models import Exam


def _normalize_token(raw):
    token = (raw or "").strip()
    if token.lower().startswith("bearer "):
        token = token[7:].strip()
    if len(token) >= 2 and token[0] == token[-1] and token[0] in "\"'":
        token = token[1:-1].strip()
    return token


def _authorized(request):
    expected = (getattr(settings, "QUIZ_EXPORT_API_TOKEN", None) or "").strip()
    if not expected:
        return False
    provided = _normalize_token(request.headers.get("Authorization", ""))
    if not provided:
        provided = _normalize_token(request.GET.get("token", ""))
    return provided == expected


def _json_export(payload, status=200):
    payload["exported_at"] = timezone.now().isoformat()
    return JsonResponse(payload, status=status)


@require_GET
def export_exam_respondents(request):
    if not _authorized(request):
        return JsonResponse({"error": "Unauthorized"}, status=401)

    exam_id = request.GET.get("exam_id")
    if not exam_id:
        return JsonResponse({"error": "exam_id is required"}, status=400)

    exam = Exam.objects.filter(pk=exam_id).select_related("academy").first()
    if not exam:
        return JsonResponse({"error": "Exam not found"}, status=404)

    return _json_export(exam_respondents_payload(exam))


@require_GET
def export_haweya_respondents(request):
    if not _authorized(request):
        return JsonResponse({"error": "Unauthorized"}, status=401)

    exam = resolve_haweya_exam()
    if not exam:
        return JsonResponse({"error": "Haweya quiz not found"}, status=404)

    return _json_export(exam_respondents_payload(exam))
