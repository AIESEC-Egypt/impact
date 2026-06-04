from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin
from django.utils.html import escape
from django.utils.safestring import mark_safe

from .models import ExpaMemberSyncConfig, ExpaOAuthConfig, LoginEvent, MemberRoster, User
from .roster_quizzes import mandatory_completion_summary, quiz_progress_for_expa_id


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    list_display = (
        "username",
        "full_name",
        "email",
        "home_mc",
        "current_office",
        "role_code",
        "department_code",
        "academy_key",
        "is_active_member",
        "login_count",
        "last_synced",
    )
    list_filter = ("is_active_member", "academy_key", "home_mc", "is_staff", "is_superuser")
    search_fields = ("username", "full_name", "email", "expa_id")
    readonly_fields = ("expa_id", "profile_json", "last_synced", "login_count", "quiz_results_display")

    fieldsets = DjangoUserAdmin.fieldsets + (
        (
            "EXPA profile",
            {
                "fields": (
                    "expa_id",
                    "full_name",
                    "home_mc",
                    "current_office",
                    "role_code",
                    "role_name",
                    "department_code",
                    "department_name",
                    "academy_key",
                    "is_active_member",
                    "last_synced",
                    "profile_json",
                    "quiz_results_display",
                )
            },
        ),
    )

    @admin.display(description="Quiz progress")
    def quiz_results_display(self, obj):
        return _format_quiz_results_html(
            obj.expa_id,
            role_code=obj.role_code,
            role_name=obj.role_name,
        )


@admin.register(LoginEvent)
class LoginEventAdmin(admin.ModelAdmin):
    list_display = ("user", "created_at", "ip_address", "user_agent")
    list_filter = ("created_at",)
    search_fields = ("user__username", "user__full_name", "ip_address")
    readonly_fields = ("user", "created_at", "ip_address", "user_agent")

    def has_add_permission(self, request):
        return False


@admin.register(ExpaOAuthConfig)
class ExpaOAuthConfigAdmin(admin.ModelAdmin):
    list_display = ("name", "client_id", "redirect_uri", "require_active_member", "is_active")
    fieldsets = (
        (None, {"fields": ("name", "is_active")}),
        ("Credentials", {"fields": ("client_id", "client_secret")}),
        ("Endpoints", {"fields": ("auth_url", "token_url", "people_me_url", "redirect_uri")}),
        ("Access rules", {"fields": ("allowed_entities", "require_active_member")}),
    )


def _format_quiz_results_html(expa_id, academy_key=None, role_code=None, role_name=None):
    progress = quiz_progress_for_expa_id(
        expa_id,
        academy_key=academy_key or None,
        role_code=role_code,
        role_name=role_name,
    )
    summary = mandatory_completion_summary(
        expa_id, role_code=role_code, role_name=role_name
    )
    user = progress["user"]
    if not user:
        return mark_safe(
            "<p><em>No IMPACT login yet for EXPA ID "
            f"{escape(expa_id or '—')}.</em></p>"
        )

    header = (
        "<p><strong>Mandatory:</strong> "
        f"{escape(summary['mandatory_passed'])} / {escape(summary['mandatory_total'])} passed"
        " &nbsp;|&nbsp; <strong>Pending mandatory:</strong> "
        f"{escape(summary['mandatory_pending'])}</p>"
    )
    if not progress["rows"]:
        return mark_safe(header + "<p><em>No published quizzes.</em></p>")

    def _td(value):
        return f"<td>{escape(value)}</td>"

    rows_html = []
    for row in progress["rows"]:
        if row["is_mandatory"]:
            layers = row.get("mandatory_layers") or []
            req = f"Mandatory ({', '.join(layers)})" if layers else "Mandatory (all)"
        else:
            req = "Optional"
        if row["attempt"]:
            score = escape(f"{row['percentage']:.0f}%")
            result = escape("Passed" if row["passed"] else "Not passed")
            color = "#0a8a0a" if row["passed"] else "#b00020"
            score_cell = (
                f'<td><span style="color:{color}"><b>{score}</b> ({result})</span></td>'
            )
        else:
            score_cell = "<td>—</td>"
        rows_html.append(
            "<tr>"
            + _td(row["academy_key"])
            + _td(row["exam"].title)
            + _td(req)
            + score_cell
            + _td(row["pass_mark"])
            + "</tr>"
        )

    return mark_safe(
        header
        + "<table style='width:100%;border-collapse:collapse;font-size:12px;'>"
        "<thead><tr style='background:#f0f0f0'>"
        "<th align='left'>Academy</th><th align='left'>Quiz</th>"
        "<th align='left'>Type</th><th align='left'>Best score</th>"
        "<th align='left'>Pass mark</th>"
        "</tr></thead><tbody>"
        + "".join(rows_html)
        + "</tbody></table>"
    )


@admin.register(MemberRoster)
class MemberRosterAdmin(admin.ModelAdmin):
    list_display = (
        "expa_id",
        "full_name",
        "role_code",
        "committee_department",
        "department_code",
        "academy_key",
        "quiz_mandatory_progress",
        "is_active",
        "last_synced_at",
    )
    list_filter = ("is_active", "academy_key", "department_code", "role_code")
    search_fields = ("expa_id", "full_name", "email", "department_raw", "role_raw")
    readonly_fields = (
        "last_synced_at",
        "quiz_results_display",
        "mandatory_quiz_summary",
    )
    fieldsets = (
        (
            None,
            {
                "fields": (
                    "expa_id",
                    "full_name",
                    "email",
                    "is_active",
                    "last_synced_at",
                )
            },
        ),
        (
            "EXPA position",
            {
                "fields": (
                    "role_code",
                    "role_name",
                    "role_raw",
                    "committee_department",
                    "department_code",
                    "department_name",
                    "department_raw",
                    "academy_key",
                    "home_lc_name",
                    "member_position_id",
                )
            },
        ),
        (
            "Quiz progress (IMPACT logins)",
            {
                "fields": (
                    "mandatory_quiz_summary",
                    "quiz_results_display",
                ),
            },
        ),
    )

    @admin.display(description="Mandatory quizzes")
    def quiz_mandatory_progress(self, obj):
        s = mandatory_completion_summary(
            obj.expa_id, role_code=obj.role_code, role_name=obj.role_name
        )
        if s["mandatory_total"] == 0:
            return "—"
        return f"{s['mandatory_passed']}/{s['mandatory_total']}"

    @admin.display(description="Mandatory summary")
    def mandatory_quiz_summary(self, obj):
        s = mandatory_completion_summary(
            obj.expa_id, role_code=obj.role_code, role_name=obj.role_name
        )
        return (
            f"{s['mandatory_passed']} of {s['mandatory_total']} mandatory quizzes passed; "
            f"{s['mandatory_pending']} still pending."
        )

    @admin.display(description="All quiz attempts")
    def quiz_results_display(self, obj):
        return _format_quiz_results_html(
            obj.expa_id,
            academy_key=obj.academy_key or None,
            role_code=obj.role_code,
            role_name=obj.role_name,
        )


@admin.register(ExpaMemberSyncConfig)
class ExpaMemberSyncConfigAdmin(admin.ModelAdmin):
    list_display = ("name", "office_id", "date_from", "date_to", "is_active")
    fieldsets = (
        (None, {"fields": ("name", "is_active")}),
        ("EXPA GIS API", {"fields": ("access_token", "graphql_url", "office_id")}),
        ("Date range (position start_date filter)", {"fields": ("date_from", "date_to")}),
    )
