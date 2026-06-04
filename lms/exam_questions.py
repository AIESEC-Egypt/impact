"""Random question selection for exams."""

import secrets

SESSION_KEY_PREFIX = "lms_exam_questions_"


def session_key(exam_id):
    return f"{SESSION_KEY_PREFIX}{exam_id}"


def select_questions_for_attempt(exam):
    """
    Pick questions to show for one attempt.

    If exam.questions_per_attempt is set (and smaller than the pool), randomly
    sample that many using secrets.SystemRandom. Otherwise use all questions.
    """
    pool = list(exam.questions.prefetch_related("choices").all())
    if not pool:
        return []

    rng = secrets.SystemRandom()
    limit = exam.questions_per_attempt or 0
    if limit > 0 and limit < len(pool):
        pool = rng.sample(pool, limit)
    elif exam.shuffle_questions:
        rng.shuffle(pool)
    return pool


def store_question_ids_in_session(request, exam_id, question_ids):
    request.session[session_key(exam_id)] = [int(q) for q in question_ids]
    request.session.modified = True


def pop_question_ids_from_session(request, exam_id):
    ids = request.session.pop(session_key(exam_id), None)
    request.session.modified = True
    return ids


def get_question_ids_from_session(request, exam_id):
    return request.session.get(session_key(exam_id))
