# Generated for HomePromo

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("lms", "0007_academycontentmanager"),
    ]

    operations = [
        migrations.CreateModel(
            name="HomePromo",
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
                ("title", models.CharField(max_length=200)),
                ("subtitle", models.CharField(blank=True, max_length=300)),
                ("button_label", models.CharField(default="Start now", max_length=80)),
                (
                    "destination",
                    models.CharField(
                        choices=[
                            ("dreaming_page", "Dreaming process page (/dreaming/)"),
                            (
                                "dreaming_exam",
                                "Dreaming knowledge quiz (certificate test)",
                            ),
                            ("custom_url", "Custom URL"),
                        ],
                        default="dreaming_exam",
                        max_length=20,
                    ),
                ),
                ("custom_url", models.URLField(blank=True, max_length=500)),
                ("order", models.PositiveIntegerField(default=0)),
                ("is_published", models.BooleanField(default=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "exam",
                    models.ForeignKey(
                        blank=True,
                        help_text='Required when destination is "Dreaming knowledge quiz".',
                        limit_choices_to={
                            "academy__key": "dreaming",
                            "is_published": True,
                            "kind": "knowledge_quiz",
                        },
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="home_promos",
                        to="lms.exam",
                    ),
                ),
            ],
            options={
                "verbose_name": "Home page promo",
                "verbose_name_plural": "Home page promos",
                "ordering": ["order", "id"],
            },
        ),
    ]
