from django.conf import settings
from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    """Custom user backed by an AIESEC EXPA (GIS) identity.

    We keep the raw profile JSON so we can re-evaluate eligibility or mine
    activity data later without another API round-trip.
    """

    expa_id = models.CharField(max_length=64, blank=True, db_index=True)
    full_name = models.CharField(max_length=255, blank=True)
    home_mc = models.CharField("Home MC / entity", max_length=255, blank=True)
    current_office = models.CharField(max_length=255, blank=True)
    is_active_member = models.BooleanField(default=False)
    role_code = models.CharField(max_length=50, blank=True)
    role_name = models.CharField(max_length=255, blank=True)
    department_code = models.CharField(
        max_length=50,
        blank=True,
        help_text="EXPA department code (OGX, OGT, ICX, …).",
    )
    department_name = models.CharField(
        max_length=255,
        blank=True,
        help_text="EXPA department full name (Outgoing Exchange, …).",
    )
    academy_key = models.CharField(
        max_length=40,
        blank=True,
        help_text="Academy slug mapped from department (ogv, ogt, …).",
    )
    profile_json = models.JSONField(default=dict, blank=True)
    last_synced = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return self.full_name or self.username

    @property
    def login_count(self):
        return self.login_events.count()


class LoginEvent(models.Model):
    """One row per successful EXPA login. Used to identify active users."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="login_events",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.CharField(max_length=512, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.user} @ {self.created_at:%Y-%m-%d %H:%M}"


class ExpaOAuthConfig(models.Model):
    """Editable EXPA OAuth credentials (admin-managed singleton).

    Falls back to settings.EXPA_OAUTH when no row exists. The client secret
    lives here on the server only - it is never shipped to the browser.
    """

    name = models.CharField(max_length=100, default="EXPA OAuth", unique=True)
    client_id = models.CharField(max_length=255)
    client_secret = models.CharField(max_length=255)
    auth_url = models.URLField(default="https://auth.aiesec.org/oauth/authorize")
    token_url = models.URLField(default="https://auth.aiesec.org/oauth/token")
    people_me_url = models.URLField(default="https://gis-api.aiesec.org/v2/current_person.json")
    redirect_uri = models.CharField(max_length=255, default="https://impact.aiesec.org.eg/")
    allowed_entities = models.CharField(
        max_length=255,
        default="egypt",
        help_text="Comma separated entity names allowed to log in (case-insensitive).",
    )
    require_active_member = models.BooleanField(default=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        verbose_name = "EXPA OAuth configuration"
        verbose_name_plural = "EXPA OAuth configuration"

    def __str__(self):
        return self.name

    @property
    def allowed_entities_list(self):
        return [e.strip().lower() for e in self.allowed_entities.split(",") if e.strip()]


class MemberRoster(models.Model):
    """Current EXPA members synced from EDM/GIS — allowed to log in to IMPACT."""

    expa_id = models.CharField(max_length=64, unique=True, db_index=True)
    full_name = models.CharField(max_length=255, blank=True)
    email = models.EmailField(blank=True)
    role_code = models.CharField(max_length=50, blank=True)
    role_name = models.CharField(max_length=255, blank=True)
    role_raw = models.CharField(max_length=255, blank=True)
    committee_department = models.CharField(
        max_length=50,
        blank=True,
        help_text="EXPA committee_department.name (e.g. OGV, IGV) — LC product line.",
    )
    department_code = models.CharField(
        max_length=50,
        blank=True,
        db_index=True,
        help_text="Primary department code; prefers committee_department over function.",
    )
    department_name = models.CharField(max_length=255, blank=True)
    department_raw = models.CharField(
        max_length=255,
        blank=True,
        help_text="EXPA function + committee, e.g. OGX - Outgoing Exchange · OGV.",
    )
    academy_key = models.CharField(
        max_length=40,
        blank=True,
        db_index=True,
        help_text="Academy from department: ogv, igv, ogt, igt, b2c, b2b, tm, fl.",
    )
    home_lc_name = models.CharField(max_length=255, blank=True)
    member_position_id = models.CharField(max_length=64, blank=True)
    is_active = models.BooleanField(default=True, db_index=True)
    last_synced_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "EXPA member (roster)"
        verbose_name_plural = "EXPA member roster"
        ordering = ["full_name", "expa_id"]

    @property
    def role_display(self):
        if self.role_code and self.role_name and self.role_code != self.role_name:
            return f"{self.role_code} — {self.role_name}"
        return self.role_name or self.role_code or self.role_raw or "—"

    @property
    def department_display(self):
        if self.department_code and self.department_name:
            if self.department_name.startswith(self.department_code):
                return self.department_name
            return f"{self.department_code} — {self.department_name}"
        return self.department_code or self.department_raw or "—"

    def __str__(self):
        label = self.full_name or self.expa_id
        parts = [label]
        if self.department_code:
            parts.append(self.department_code)
        if self.academy_key:
            parts.append(f"→ {self.academy_key}")
        return " ".join(parts)


class ExpaMemberSyncConfig(models.Model):
    """Server token + MC office for bulk member position sync from EXPA GraphQL."""

    name = models.CharField(max_length=100, default="EXPA member sync", unique=True)
    access_token = models.CharField(
        max_length=500,
        help_text="GIS API token (from EXPA admin/network tab). Not the OAuth client secret.",
    )
    graphql_url = models.URLField(default="https://gis-api.aiesec.org/graphql")
    office_id = models.PositiveIntegerField(
        help_text="AIESEC in Egypt MC office id in EXPA (filters memberPositions).",
    )
    date_from = models.DateField(
        null=True,
        blank=True,
        help_text="Position start date filter (from).",
    )
    date_to = models.DateField(
        null=True,
        blank=True,
        help_text="Position start date filter (to).",
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        verbose_name = "EXPA member sync configuration"
        verbose_name_plural = "EXPA member sync configuration"

    def __str__(self):
        return self.name
