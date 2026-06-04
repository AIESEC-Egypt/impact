from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("lms", "0002_clear_legacy_academy_templates"),
    ]

    operations = [
        migrations.AddField(
            model_name="material",
            name="subtitle",
            field=models.CharField(
                blank=True,
                help_text="Mini subtitle shown under the card (e.g. The 3-Call Journey).",
                max_length=200,
            ),
        ),
        migrations.AlterField(
            model_name="material",
            name="thumbnail",
            field=models.ImageField(
                blank=True,
                help_text="Card image (upload the designed graphic from the old academy pages).",
                null=True,
                upload_to="materials/",
            ),
        ),
        migrations.AlterField(
            model_name="material",
            name="title",
            field=models.CharField(
                help_text="Used for admin and image alt text.",
                max_length=200,
            ),
        ),
    ]
