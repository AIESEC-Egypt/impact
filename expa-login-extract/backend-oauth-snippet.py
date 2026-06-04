# Minimal backend reference from general/expa_oauth.py + general/views.py
# Django Admin model: ExpaOAuthConfig (client_id, client_secret, auth_url, token_url, redirect_uri)

def build_authorize_url(config):
    return (
        f"{config.auth_url}"
        f"?client_id={config.client_id}"
        f"&redirect_uri={config.redirect_uri}"
        f"&response_type=code"
    )


def exchange_code_for_token(config, code):
    """POST application/x-www-form-urlencoded (EDM uses data=, not JSON)."""
    import requests
    resp = requests.post(
        config.token_url,
        data={
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": config.redirect_uri,
            "client_id": config.client_id,
            "client_secret": config.client_secret,
        },
        timeout=30,
    )
    resp.raise_for_status()
    return resp.json()  # access_token, refresh_token, expires_in

# Callback view (general/views.py expa_oauth_callback):
# GET ?code= → login_or_link_expa_user → redirect to /login/#access_token=<app_jwt>
