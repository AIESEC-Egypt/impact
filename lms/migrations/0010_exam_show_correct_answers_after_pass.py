from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("lms", "0009_material_legacy_cards"),
    ]

    operations = [
        migrations.AddField(
            model_name="exam",
            name="show_correct_answers_after_pass",
            field=models.BooleanField(
                default=True,
                help_text=(
                    "After a member passes, show the review section with correct answers. "
                    "When off, passed attempts only show the score."
                ),
            ),
        ),
    ]
