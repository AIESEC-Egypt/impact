from django.contrib import admin
from django.utils.html import format_html

from .forms import ExamAdminForm, HomePromoAdminForm
from .models import (
    Academy,
    AcademyContentManager,
    Answer,
    Attempt,
    Choice,
    Exam,
    HomePromo,
    Material,
    Question,
    Session,
)


class ContentManagerInline(admin.TabularInline):
    model = AcademyContentManager
    extra = 1
    fields = ("expa_id", "label", "is_active")
    verbose_name = "Content manager (EXPA ID)"
    verbose_name_plural = "Content managers — who can use /manage/<key>/"


class MaterialInline(admin.TabularInline):
    model = Material
    extra = 1
    fields = ("title", "subtitle", "thumbnail", "url", "order", "is_published")


class SessionInline(admin.TabularInline):
    model = Session
    extra = 1
    fields = ("title", "video_url", "order", "is_published")


class ExamInline(admin.TabularInline):
    model = Exam
    extra = 0
    fields = (
        "title",
        "kind",
        "is_mandatory",
        "pass_mark",
        "questions_per_attempt",
        "is_published",
    )
    show_change_link = True


@admin.register(Academy)
class AcademyAdmin(admin.ModelAdmin):
    list_display = ("title", "key", "kind", "order", "is_published")
    list_filter = ("kind", "is_published")
    search_fields = ("title", "key")
    prepopulated_fields = {"key": ("title",)}
    inlines = [ContentManagerInline, MaterialInline, SessionInline, ExamInline]


@admin.register(HomePromo)
class HomePromoAdmin(admin.ModelAdmin):
    form = HomePromoAdminForm
    list_display = ("title", "destination", "exam", "order", "is_published", "updated_at")
    list_filter = ("is_published", "destination")
    list_editable = ("order", "is_published")
    search_fields = ("title", "subtitle")
    autocomplete_fields = ("exam",)
    fieldsets = (
        (
            None,
            {
                "fields": (
                    "title",
                    "subtitle",
                    "button_label",
                    "is_published",
                    "order",
                ),
                "description": (
                    "These banners appear on the IMPACT home page. "
                    "Use them to promote the Howya certificate test or other Dreaming quizzes."
                ),
            },
        ),
        (
            "Button link",
            {
                "fields": ("destination", "exam", "custom_url"),
                "description": (
                    'For the Howya certificate, choose "Dreaming knowledge quiz" '
                    "and select the quiz from the Dreaming page."
                ),
            },
        ),
    )

@admin.register(AcademyContentManager)
class AcademyContentManagerAdmin(admin.ModelAdmin):
    list_display = ("academy", "expa_id", "label", "is_active", "created_at")
    list_filter = ("is_active", "academy")
    search_fields = ("expa_id", "label", "academy__key", "academy__title")
    autocomplete_fields = ("academy",)
    ordering = ("academy__order", "academy__key", "expa_id")


@admin.register(Material)
class MaterialAdmin(admin.ModelAdmin):
    list_display = (
        "title",
        "section_group",
        "academy",
        "has_card_image",
        "order",
        "is_published",
    )
    list_filter = ("material_type", "is_published", "academy")
    search_fields = ("title", "subtitle", "section_group", "card_image")
    fields = (
        "academy",
        "section_group",
        "title",
        "subtitle",
        "card_image",
        "pdf_filename",
        "thumbnail",
        "url",
        "material_type",
        "description",
        "order",
        "is_published",
    )

    @admin.display(boolean=True, description="Card")
    def has_card_image(self, obj):
        return bool(obj.card_image or obj.thumbnail)


@admin.register(Session)
class SessionAdmin(admin.ModelAdmin):
    list_display = ("title", "academy", "order", "is_published")
    list_filter = ("is_published", "academy")
    search_fields = ("title",)


class ChoiceInline(admin.TabularInline):
    model = Choice
    extra = 3
    fields = ("text", "is_correct", "order")


class QuestionInline(admin.TabularInline):
    model = Question
    extra = 1
    fields = ("text", "question_type", "points", "order")
    show_change_link = True


@admin.register(Exam)
class ExamAdmin(admin.ModelAdmin):
    form = ExamAdminForm
    list_display = (
        "title",
        "academy",
        "kind",
        "mandatory_display",
        "pass_mark",
        "question_count",
        "total_points",
        "is_published",
    )
    list_filter = ("kind", "is_mandatory", "is_published", "academy")
    fieldsets = (
        (
            None,
            {
                "fields": (
                    "academy",
                    "title",
                    "description",
                    "kind",
                    "is_published",
                )
            },
        ),
        (
            "Mandatory by layer",
            {
                "fields": ("is_mandatory", "mandatory_layer_picks"),
                "description": (
                    "Choose one or more layers (TM, LCVP, MM, …), or check "
                    "“Mandatory for all layers” with no layers selected."
                ),
            },
        ),
        (
            "Rules",
            {
                "fields": (
                    "pass_mark",
                    "time_limit_minutes",
                    "max_attempts",
                    "shuffle_questions",
                    "questions_per_attempt",
                )
            },
        ),
    )
    search_fields = ("title",)
    inlines = [QuestionInline]

    @admin.display(description="Mandatory")
    def mandatory_display(self, obj):
        layers = obj.get_mandatory_layers_list()
        if layers:
            return ", ".join(layers)
        if obj.is_mandatory:
            return "All layers"
        return "—"

    @admin.display(description="Questions")
    def question_count(self, obj):
        return obj.questions.count()


@admin.register(Question)
class QuestionAdmin(admin.ModelAdmin):
    list_display = ("short_text", "exam", "question_type", "points", "order")
    list_filter = ("question_type", "exam__academy", "exam")
    search_fields = ("text",)
    inlines = [ChoiceInline]

    @admin.display(description="Question")
    def short_text(self, obj):
        return obj.text[:80]


class AnswerInline(admin.TabularInline):
    model = Answer
    extra = 0
    can_delete = False
    readonly_fields = ("question", "selected_display")
    fields = ("question", "selected_display")

    @admin.display(description="Selected")
    def selected_display(self, obj):
        return ", ".join(c.text for c in obj.selected_choices.all())

    def has_add_permission(self, request, obj=None):
        return False


@admin.register(Attempt)
class AttemptAdmin(admin.ModelAdmin):
    list_display = (
        "user",
        "exam",
        "score_display",
        "percentage_display",
        "passed",
        "submitted_at",
    )
    list_filter = ("passed", "exam__academy", "exam", "submitted_at")
    search_fields = ("user__username", "user__full_name", "exam__title")
    readonly_fields = (
        "user",
        "exam",
        "started_at",
        "submitted_at",
        "score",
        "max_score",
        "percentage",
        "passed",
    )
    inlines = [AnswerInline]

    @admin.display(description="Score")
    def score_display(self, obj):
        return f"{obj.score:g} / {obj.max_score:g}"

    @admin.display(description="Result")
    def percentage_display(self, obj):
        color = "#0a8a0a" if obj.passed else "#b00020"
        return format_html('<b style="color:{}">{}%</b>', color, f"{obj.percentage:.0f}")

    def has_add_permission(self, request):
        return False
