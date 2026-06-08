from django import template

from lms.role_layers import exam_is_mandatory_for

register = template.Library()


@register.filter
def get_item(mapping, key):
    """Look up a dict value by a variable key inside templates."""
    if hasattr(mapping, "get"):
        return mapping.get(key)
    return None


@register.filter
def navbar_account_name(user):
    """Display name for nav chips; omit when it would duplicate the Admin link."""
    if not user or not user.is_authenticated:
        return ""
    name = (user.full_name or user.get_full_name() or user.username or "").strip()
    if user.is_staff and name.lower() == "admin":
        return ""
    return name


@register.filter
def exam_mandatory_for_user(exam, user):
    """True if exam is mandatory for this user's role layer."""
    if not user or not user.is_authenticated:
        return False
    return exam_is_mandatory_for(exam, user.role_code, user.role_name)
