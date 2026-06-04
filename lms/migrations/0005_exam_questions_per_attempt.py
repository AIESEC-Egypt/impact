from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("lms", "0004_exam_mandatory_and_rename_mxp_academy"),
    ]

    operations = [
        migrations.AddField(
            model_name="exam",
            name="questions_per_attempt",
            field=models.PositiveIntegerField(
                default=0,
                help_text=(
                    "How many questions each attempt shows (randomly chosen from the full bank). "
                    "0 = show all questions."
                ),
            ),
        ),
    ]
