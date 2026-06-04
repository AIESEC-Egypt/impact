from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("lms", "0005_exam_questions_per_attempt"),
    ]

    operations = [
        migrations.AddField(
            model_name="exam",
            name="mandatory_layers",
            field=models.JSONField(
                blank=True,
                default=list,
                help_text="Role layers that must pass this quiz (e.g. TM, LCVP, MM). Empty uses “all layers” only if the box above is checked.",
            ),
        ),
        migrations.AlterField(
            model_name="exam",
            name="is_mandatory",
            field=models.BooleanField(
                default=False,
                help_text="Mandatory for all layers when no specific layers are selected below.",
            ),
        ),
    ]
