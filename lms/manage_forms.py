from django import forms

from .models import Material, Session


class MaterialManageForm(forms.ModelForm):
    class Meta:
        model = Material
        fields = (
            "title",
            "subtitle",
            "description",
            "material_type",
            "url",
            "thumbnail",
            "order",
            "is_published",
        )
        widgets = {
            "title": forms.TextInput(attrs={"class": "form-control", "placeholder": "Card title"}),
            "subtitle": forms.TextInput(
                attrs={"class": "form-control", "placeholder": "Short line under the title"}
            ),
            "description": forms.Textarea(
                attrs={"class": "form-control", "rows": 3, "placeholder": "Optional notes"}
            ),
            "material_type": forms.Select(attrs={"class": "form-select"}),
            "url": forms.URLInput(
                attrs={
                    "class": "form-control",
                    "placeholder": "https://drive.google.com/... or Slides link",
                }
            ),
            "thumbnail": forms.ClearableFileInput(attrs={"class": "form-control"}),
            "order": forms.NumberInput(attrs={"class": "form-control", "min": 0}),
            "is_published": forms.CheckboxInput(attrs={"class": "form-check-input"}),
        }


class SessionManageForm(forms.ModelForm):
    class Meta:
        model = Session
        fields = (
            "title",
            "description",
            "video_url",
            "thumbnail",
            "order",
            "is_published",
        )
        widgets = {
            "title": forms.TextInput(attrs={"class": "form-control", "placeholder": "Session title"}),
            "description": forms.Textarea(
                attrs={"class": "form-control", "rows": 3, "placeholder": "What this recording covers"}
            ),
            "video_url": forms.URLInput(
                attrs={
                    "class": "form-control",
                    "placeholder": "YouTube or Google Drive video link",
                }
            ),
            "thumbnail": forms.ClearableFileInput(attrs={"class": "form-control"}),
            "order": forms.NumberInput(attrs={"class": "form-control", "min": 0}),
            "is_published": forms.CheckboxInput(attrs={"class": "form-check-input"}),
        }
