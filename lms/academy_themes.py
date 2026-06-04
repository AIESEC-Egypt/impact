"""Per-academy hero branding (colors + display label) from legacy Academy/*.html pages."""

# Home page swiper card classes (styles.css .academy-card.red, .blue, …)
ACADEMY_CARD_CLASS = {
    "ogv": "red",
    "igv": "red",
    "ogt": "blue",
    "igt": "blue",
    "b2c": "b2c",
    "b2b": "b2b",
    "tm": "purple",
    "fl": "green",
}

# Same order as the index Function Academies carousel
ACADEMY_CHOOSER_ORDER = ("ogv", "ogt", "igv", "igt", "b2c", "b2b", "tm", "fl")

ACADEMY_THEMES = {
    "ogv": {
        "label": "oGV",
        "theme_class": "academy-hero--ogv",
        "accent": "#F85A40",
        "card_class": "red",
    },
    "igv": {
        "label": "iGV",
        "theme_class": "academy-hero--igv",
        "accent": "#F85A40",
        "card_class": "red",
    },
    "ogt": {
        "label": "oGT",
        "theme_class": "academy-hero--ogt",
        "accent": "#F48924",
        "card_class": "blue",
    },
    "igt": {
        "label": "iGT",
        "theme_class": "academy-hero--igt",
        "accent": "#F48924",
        "card_class": "blue",
    },
    "b2c": {
        "label": "B2C",
        "theme_class": "academy-hero--b2c",
        "accent": "#037ef3",
        "card_class": "b2c",
    },
    "b2b": {
        "label": "B2B",
        "theme_class": "academy-hero--b2b",
        "accent": "#0e33af",
        "card_class": "b2b",
    },
    "tm": {
        "label": "TM",
        "theme_class": "academy-hero--tm",
        "accent": "#35266A",
        "card_class": "purple",
    },
    "fl": {
        "label": "F&L",
        "theme_class": "academy-hero--fl",
        "accent": "#076D3E",
        "card_class": "green",
    },
}


def get_academy_theme(key):
    """Return theme dict for an academy key, with sensible defaults."""
    theme = ACADEMY_THEMES.get(key)
    if theme:
        return dict(theme)
    return {
        "label": (key or "").upper(),
        "theme_class": "academy-hero--default",
        "accent": "#037ef3",
        "card_class": "b2c",
    }


def academies_for_chooser(queryset):
    """Order published academies like the index carousel."""
    by_key = {a.key: a for a in queryset}
    ordered = []
    for key in ACADEMY_CHOOSER_ORDER:
        if key in by_key:
            academy = by_key[key]
            theme = get_academy_theme(key)
            ordered.append(
                {
                    "academy": academy,
                    "theme": theme,
                    "card_class": theme.get("card_class") or ACADEMY_CARD_CLASS.get(key, "b2c"),
                }
            )
    for academy in queryset:
        if academy.key not in ACADEMY_CHOOSER_ORDER:
            theme = get_academy_theme(academy.key)
            ordered.append(
                {
                    "academy": academy,
                    "theme": theme,
                    "card_class": theme.get("card_class") or "b2c",
                }
            )
    return ordered
