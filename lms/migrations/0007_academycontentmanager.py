# Generated manually for AcademyContentManager

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("lms", "0006_exam_mandatory_layers"),
    ]

    operations = [
        migrations.CreateModel(
            name="AcademyContentManager",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                (
                    "expa_id",
                    models.CharField(
                        db_index=True,
                        help_text="EXPA person ID — must match the user's expa_id when they log in.",
                        max_length=64,
                    ),
                ),
                (
                    "label",
                    models.CharField(
                        blank=True,
                        help_text="Optional display name (e.g. MCVP OGV).",
                        max_length=120,
                    ),
                ),
                ("is_active", models.BooleanField(default=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "academy",
                    models.ForeignKey(
                        limit_choices_to={"kind": "academy"},
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="content_managers",
                        to="lms.academy",
                    ),
                ),
            ],
            options={
                "verbose_name": "Academy content manager",
                "verbose_name_plural": "Academy content managers",
                "ordering": ["academy__order", "academy__key", "expa_id"],
            },
        ),
        migrations.AddConstraint(
            model_name="academycontentmanager",
            constraint=models.UniqueConstraint(
                fields=("academy", "expa_id"),
                name="unique_academy_manager_expa",
            ),
        ),
    ]
