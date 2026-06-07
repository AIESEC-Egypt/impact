from django.conf import settings
from django.db import models
from django.utils import timezone


class Academy(models.Model):
    """A functional academy (oGV, iGV, ...) or the dreaming process."""

    KIND_ACADEMY = "academy"
    KIND_DREAMING = "dreaming"
    KIND_CHOICES = [
        (KIND_ACADEMY, "Functional academy"),
        (KIND_DREAMING, "Dreaming process"),
    ]

    key = models.SlugField(
        max_length=40,
        unique=True,
        help_text="Short code used in URLs, e.g. ogv, igv, dreaming.",
    )
    title = models.CharField(max_length=120)
    subtitle = models.CharField(max_length=200, blank=True)
    description = models.TextField(blank=True)
    kind = models.CharField(max_length=20, choices=KIND_CHOICES, default=KIND_ACADEMY)
    template_name = models.CharField(
        max_length=120,
        blank=True,
        help_text="Optional custom template. Defaults to lms/academy_detail.html.",
    )
    order = models.PositiveIntegerField(default=0)
    is_published = models.BooleanField(default=True)

    class Meta:
        verbose_name_plural = "Academies"
        ordering = ["order", "title"]

    def __str__(self):
        return self.title

    def get_absolute_url(self):
        from django.urls import reverse

        return reverse("lms:academy_detail", args=[self.key])

    def get_manage_url(self):
        from django.urls import reverse

        return reverse("lms:manage_dashboard", args=[self.key])


class AcademyContentManager(models.Model):
    """EXPA member who can manage one academy's materials and sessions (hidden /manage/ UI)."""

    academy = models.ForeignKey(
        Academy,
        on_delete=models.CASCADE,
        related_name="content_managers",
        limit_choices_to={"kind": Academy.KIND_ACADEMY},
    )
    expa_id = models.CharField(
        max_length=64,
        db_index=True,
        help_text="EXPA person ID — must match the user's expa_id when they log in.",
    )
    label = models.CharField(
        max_length=120,
        blank=True,
        help_text="Optional display name (e.g. MCVP OGV).",
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Academy content manager"
        verbose_name_plural = "Academy content managers"
        ordering = ["academy__order", "academy__key", "expa_id"]
        constraints = [
            models.UniqueConstraint(
                fields=["academy", "expa_id"],
                name="unique_academy_manager_expa",
            )
        ]

    def __str__(self):
        name = self.label or self.expa_id
        return f"{self.academy.key}: {name}"


class HomePromo(models.Model):
    """Call-to-action banners on the home page (controlled from Django admin)."""

    DEST_DREAMING_PAGE = "dreaming_page"
    DEST_DREAMING_EXAM = "dreaming_exam"
    DEST_CUSTOM_URL = "custom_url"
    DESTINATION_CHOICES = [
        (DEST_DREAMING_PAGE, "Dreaming process page (/dreaming/)"),
        (DEST_DREAMING_EXAM, "Dreaming knowledge quiz (certificate test)"),
        (DEST_CUSTOM_URL, "Custom URL"),
    ]

    title = models.CharField(
        max_length=200,
        help_text='Headline shown on the home page, e.g. "Obtain your Howya certificate now".',
    )
    subtitle = models.CharField(max_length=300, blank=True)
    button_label = models.CharField(max_length=80, default="Start now")
    destination = models.CharField(
        max_length=20,
        choices=DESTINATION_CHOICES,
        default=DEST_DREAMING_EXAM,
    )
    exam = models.ForeignKey(
        "Exam",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="home_promos",
        limit_choices_to={
            "academy__key": "dreaming",
            "kind": "knowledge_quiz",
            "is_published": True,
        },
        help_text='Required when destination is "Dreaming knowledge quiz".',
    )
    custom_url = models.URLField(max_length=500, blank=True)
    order = models.PositiveIntegerField(default=0)
    is_published = models.BooleanField(default=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Home page promo"
        verbose_name_plural = "Home page promos"
        ordering = ["order", "id"]

    def __str__(self):
        return self.title

    def get_button_url(self):
        from django.urls import reverse

        if self.destination == self.DEST_DREAMING_PAGE:
            return reverse("lms:dreaming")
        if self.destination == self.DEST_DREAMING_EXAM and self.exam_id:
            return reverse(
                "lms:exam_take",
                args=[self.exam.academy.key, self.exam_id],
            )
        if self.destination == self.DEST_CUSTOM_URL and self.custom_url:
            return self.custom_url
        return reverse("lms:dreaming")


class Material(models.Model):
    """A learning resource: a PPT / Drive / doc link shown as a card."""

    TYPE_CHOICES = [
        ("ppt", "Presentation (PPT / Slides)"),
        ("drive", "Google Drive file/folder"),
        ("doc", "Document"),
        ("pdf", "PDF"),
        ("link", "Other link"),
    ]

    academy = models.ForeignKey(Academy, on_delete=models.CASCADE, related_name="materials")
    title = models.CharField(max_length=200, help_text="Used for admin and image alt text.")
    section_group = models.CharField(
        max_length=120,
        blank=True,
        help_text="Section heading on the academy page (e.g. Consideration, IRs).",
    )
    subtitle = models.CharField(
        max_length=200,
        blank=True,
        help_text="Mini subtitle shown under the card (e.g. The 3-Call Journey).",
    )
    description = models.TextField(blank=True)
    material_type = models.CharField(max_length=20, choices=TYPE_CHOICES, default="ppt")
    card_image = models.CharField(
        max_length=500,
        blank=True,
        help_text="Static card graphic, e.g. Academy/pdf/Phone call.svg",
    )
    pdf_filename = models.CharField(
        max_length=255,
        blank=True,
        help_text="Opens /static/Academy/pdf/<name>.pdf when set (legacy academy decks).",
    )
    url = models.URLField("Drive / resource link", max_length=500, blank=True)
    thumbnail = models.ImageField(
        upload_to="materials/",
        blank=True,
        null=True,
        help_text="Card image (upload the designed graphic from the old academy pages).",
    )
    order = models.PositiveIntegerField(default=0)
    is_published = models.BooleanField(default=True)

    class Meta:
        ordering = ["order", "id"]

    def __str__(self):
        return f"{self.academy.key}: {self.title}"

    def link_url(self):
        """External URL when the card is clickable (Drive, etc.). Never PDFs."""
        u = (self.url or "").strip()
        if not u:
            return ""
        lower = u.lower()
        if lower.endswith(".pdf") or "/academy/pdf/" in lower or "/static/academy/pdf/" in lower:
            return ""
        return u

    @property
    def embed_url(self):
        """Best-effort embeddable URL for Google Drive/Slides links."""
        u = self.url or ""
        if not u:
            return ""
        if "docs.google.com/presentation" in u:
            if "/edit" in u:
                return u.split("/edit")[0] + "/embed"
            if "/pub" in u or "/embed" in u:
                return u
            return u.rstrip("/") + "/embed"
        if "drive.google.com/file/d/" in u and "/preview" not in u:
            base = u.split("/view")[0]
            return base.rstrip("/") + "/preview" if base.endswith("/") is False else base + "preview"
        return u


class Session(models.Model):
    """A recorded session / video resource."""

    academy = models.ForeignKey(Academy, on_delete=models.CASCADE, related_name="sessions")
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    video_url = models.URLField("Video link (YouTube / Drive)", max_length=500)
    thumbnail = models.ImageField(upload_to="sessions/", blank=True, null=True)
    order = models.PositiveIntegerField(default=0)
    is_published = models.BooleanField(default=True)

    class Meta:
        ordering = ["order", "id"]

    def __str__(self):
        return f"{self.academy.key}: {self.title}"

    @property
    def embed_url(self):
        u = self.video_url
        if "youtube.com/watch" in u and "v=" in u:
            vid = u.split("v=")[1].split("&")[0]
            return f"https://www.youtube.com/embed/{vid}"
        if "youtu.be/" in u:
            vid = u.split("youtu.be/")[1].split("?")[0]
            return f"https://www.youtube.com/embed/{vid}"
        if "drive.google.com/file/d/" in u and "/preview" not in u:
            base = u.split("/view")[0]
            return base.rstrip("/") + "/preview"
        return u


class Exam(models.Model):
    """A quiz or exam. Knowledge quizzes (dreaming) use kind=knowledge_quiz."""

    KIND_EXAM = "exam"
    KIND_QUIZ = "knowledge_quiz"
    KIND_CHOICES = [
        (KIND_EXAM, "Exam / Quiz"),
        (KIND_QUIZ, "Knowledge quiz"),
    ]

    academy = models.ForeignKey(Academy, on_delete=models.CASCADE, related_name="exams")
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    kind = models.CharField(max_length=20, choices=KIND_CHOICES, default=KIND_EXAM)
    pass_mark = models.PositiveIntegerField(
        default=60, help_text="Minimum percentage required to pass."
    )
    time_limit_minutes = models.PositiveIntegerField(
        default=0, help_text="0 means no time limit."
    )
    max_attempts = models.PositiveIntegerField(
        default=0, help_text="0 means unlimited attempts."
    )
    shuffle_questions = models.BooleanField(default=False)
    questions_per_attempt = models.PositiveIntegerField(
        default=0,
        help_text=(
            "How many questions each attempt shows (randomly chosen from the full bank). "
            "0 = show all questions."
        ),
    )
    is_mandatory = models.BooleanField(
        default=False,
        help_text="Mandatory for all layers when no specific layers are selected below.",
    )
    mandatory_layers = models.JSONField(
        default=list,
        blank=True,
        help_text="Role layers that must pass this quiz (e.g. TM, LCVP, MM). Empty uses “all layers” only if the box above is checked.",
    )
    is_published = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["academy", "title"]

    def __str__(self):
        return f"{self.academy.key}: {self.title}"

    @property
    def total_points(self):
        return sum(q.points for q in self.questions.all()) or 0

    def attempts_for(self, user):
        return self.attempts.filter(user=user)

    def can_attempt(self, user):
        if self.max_attempts == 0:
            return True
        return self.attempts_for(user).count() < self.max_attempts

    def get_mandatory_layers_list(self):
        from .role_layers import ROLE_LAYER_CODES

        raw = self.mandatory_layers
        if not raw or not isinstance(raw, list):
            return []
        return [str(x) for x in raw if str(x) in ROLE_LAYER_CODES]

    def effective_questions_per_attempt(self):
        """Questions shown per attempt (capped at bank size)."""
        bank = self.questions.count()
        if not bank:
            return 0
        limit = self.questions_per_attempt or 0
        if limit <= 0 or limit >= bank:
            return bank
        return limit


class Question(models.Model):
    SINGLE = "single"
    MULTIPLE = "multiple"
    TRUE_FALSE = "true_false"
    TYPE_CHOICES = [
        (SINGLE, "Single choice"),
        (MULTIPLE, "Multiple choice"),
        (TRUE_FALSE, "True / False"),
    ]

    exam = models.ForeignKey(Exam, on_delete=models.CASCADE, related_name="questions")
    text = models.TextField()
    question_type = models.CharField(max_length=20, choices=TYPE_CHOICES, default=SINGLE)
    points = models.PositiveIntegerField(default=1)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["order", "id"]

    def __str__(self):
        return self.text[:60]

    @property
    def correct_choice_ids(self):
        return set(self.choices.filter(is_correct=True).values_list("id", flat=True))


class Choice(models.Model):
    question = models.ForeignKey(Question, on_delete=models.CASCADE, related_name="choices")
    text = models.CharField(max_length=400)
    is_correct = models.BooleanField(default=False)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["order", "id"]

    def __str__(self):
        return f"{self.text} ({'correct' if self.is_correct else 'wrong'})"


class Attempt(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="attempts"
    )
    exam = models.ForeignKey(Exam, on_delete=models.CASCADE, related_name="attempts")
    started_at = models.DateTimeField(auto_now_add=True)
    submitted_at = models.DateTimeField(null=True, blank=True)
    score = models.FloatField(default=0)
    max_score = models.FloatField(default=0)
    percentage = models.FloatField(default=0)
    passed = models.BooleanField(default=False)

    class Meta:
        ordering = ["-started_at"]

    def __str__(self):
        return f"{self.user} - {self.exam.title} ({self.percentage:.0f}%)"

    def grade(self):
        """Auto-grade answers for questions presented in this attempt only."""
        total = 0.0
        earned = 0.0
        for answer in self.answers.select_related("question").all():
            question = answer.question
            total += question.points
            selected = set(answer.selected_choices.values_list("id", flat=True))
            correct = question.correct_choice_ids
            if selected and selected == correct:
                earned += question.points
        self.score = earned
        self.max_score = total
        self.percentage = (earned / total * 100) if total else 0
        self.passed = self.percentage >= self.exam.pass_mark
        self.submitted_at = timezone.now()
        self.save()
        return self


class Answer(models.Model):
    attempt = models.ForeignKey(Attempt, on_delete=models.CASCADE, related_name="answers")
    question = models.ForeignKey(Question, on_delete=models.CASCADE, related_name="answers")
    selected_choices = models.ManyToManyField(Choice, blank=True)

    class Meta:
        unique_together = ("attempt", "question")

    def __str__(self):
        return f"{self.attempt_id} - Q{self.question_id}"
