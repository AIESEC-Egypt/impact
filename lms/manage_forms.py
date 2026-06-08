from django import forms
from django.core.exceptions import ValidationError
from django.forms import inlineformset_factory

from .models import Choice, Exam, Material, Question, Session
from .role_layers import ROLE_LAYER_CHOICES


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


class ExamManageForm(forms.ModelForm):
    mandatory_layer_picks = forms.MultipleChoiceField(
        choices=ROLE_LAYER_CHOICES,
        required=False,
        widget=forms.CheckboxSelectMultiple,
        label="Mandatory for layers",
        help_text="Optional. Select TM, LCVP, MM, etc. Leave empty unless “Mandatory for all” is checked.",
    )

    class Meta:
        model = Exam
        fields = (
            "title",
            "description",
            "pass_mark",
            "time_limit_minutes",
            "max_attempts",
            "shuffle_questions",
            "show_correct_answers_after_pass",
            "questions_per_attempt",
            "is_mandatory",
            "is_published",
        )
        widgets = {
            "title": forms.TextInput(
                attrs={
                    "class": "form-control",
                    "placeholder": "Quiz title",
                    "required": True,
                    "autofocus": True,
                }
            ),
            "description": forms.Textarea(
                attrs={"class": "form-control", "rows": 3, "placeholder": "Instructions shown before the quiz"}
            ),
            "pass_mark": forms.NumberInput(attrs={"class": "form-control", "min": 1, "max": 100}),
            "time_limit_minutes": forms.NumberInput(attrs={"class": "form-control", "min": 0}),
            "max_attempts": forms.NumberInput(attrs={"class": "form-control", "min": 0}),
            "questions_per_attempt": forms.NumberInput(attrs={"class": "form-control", "min": 0}),
            "shuffle_questions": forms.CheckboxInput(attrs={"class": "form-check-input"}),
            "show_correct_answers_after_pass": forms.CheckboxInput(attrs={"class": "form-check-input"}),
            "is_mandatory": forms.CheckboxInput(attrs={"class": "form-check-input"}),
            "is_published": forms.CheckboxInput(attrs={"class": "form-check-input"}),
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if self.instance.pk:
            self.fields["mandatory_layer_picks"].initial = (
                self.instance.get_mandatory_layers_list()
            )

    def save(self, commit=True):
        obj = super().save(commit=False)
        obj.mandatory_layers = list(self.cleaned_data.get("mandatory_layer_picks") or [])
        if commit:
            obj.save()
            self.save_m2m()
        return obj


class QuestionManageForm(forms.ModelForm):
    class Meta:
        model = Question
        fields = ("text", "question_type", "points", "order")
        widgets = {
            "text": forms.Textarea(attrs={"class": "form-control", "rows": 3}),
            "question_type": forms.Select(attrs={"class": "form-select"}),
            "points": forms.NumberInput(attrs={"class": "form-control", "min": 1}),
            "order": forms.NumberInput(attrs={"class": "form-control", "min": 0}),
        }


class ChoiceManageForm(forms.ModelForm):
    class Meta:
        model = Choice
        fields = ("text", "is_correct", "order")
        widgets = {
            "text": forms.TextInput(attrs={"class": "form-control", "placeholder": "Answer option"}),
            "is_correct": forms.CheckboxInput(attrs={"class": "form-check-input"}),
            "order": forms.NumberInput(attrs={"class": "form-control", "min": 0}),
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["text"].required = False


class BaseChoiceFormSet(forms.BaseInlineFormSet):
    def save(self, commit=True):
        instances = super().save(commit=False)
        kept = []
        for instance in instances:
            if (instance.text or "").strip():
                kept.append(instance)
            elif instance.pk:
                instance.delete()
        if commit:
            for instance in kept:
                instance.save()
            self.save_m2m()
        return kept


ChoiceFormSet = inlineformset_factory(
    Question,
    Choice,
    form=ChoiceManageForm,
    formset=BaseChoiceFormSet,
    extra=4,
    min_num=2,
    validate_min=True,
    can_delete=True,
)


def validate_question_choices(question_type, choices):
    """Ensure choices are valid for the question type."""
    active = [
        c
        for c in choices
        if c and not c.get("DELETE") and (c.get("text") or "").strip()
    ]
    if len(active) < 2:
        raise ValidationError("Add at least two answer options.")
    correct = [c for c in active if c.get("is_correct")]
    if not correct:
        raise ValidationError("Mark at least one option as correct.")
    if question_type == Question.SINGLE and len(correct) != 1:
        raise ValidationError("Single-choice questions must have exactly one correct answer.")
