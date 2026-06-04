from django import forms
from django.core.exceptions import ValidationError

from .models import Exam, HomePromo
from .role_layers import ROLE_LAYER_CHOICES


class ExamAdminForm(forms.ModelForm):
    mandatory_layer_picks = forms.MultipleChoiceField(
        choices=ROLE_LAYER_CHOICES,
        required=False,
        widget=forms.CheckboxSelectMultiple,
        label="Mandatory for layers",
        help_text="Select one or more layers (TM, LCVP, MM, …). Leave empty to use “mandatory for all layers” only when that box is checked.",
    )

    class Meta:
        model = Exam
        fields = "__all__"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if self.instance.pk:
            self.fields["mandatory_layer_picks"].initial = (
                self.instance.get_mandatory_layers_list()
            )

    def save(self, commit=True):
        obj = super().save(commit=False)
        picked = self.cleaned_data.get("mandatory_layer_picks") or []
        obj.mandatory_layers = list(picked)
        if commit:
            obj.save()
            self.save_m2m()
        return obj


class HomePromoAdminForm(forms.ModelForm):
    class Meta:
        model = HomePromo
        fields = "__all__"

    def clean(self):
        cleaned = super().clean()
        destination = cleaned.get("destination")
        exam = cleaned.get("exam")
        custom_url = cleaned.get("custom_url")
        if destination == HomePromo.DEST_DREAMING_EXAM and not exam:
            self.add_error(
                "exam",
                "Select the Dreaming knowledge quiz (e.g. Howya / History certificate test).",
            )
        if destination == HomePromo.DEST_CUSTOM_URL and not custom_url:
            self.add_error("custom_url", "Enter the full URL for the button.")
        return cleaned
