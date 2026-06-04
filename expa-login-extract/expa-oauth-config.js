/**
 * EXPA OAuth – IMPACT style (popup + in-browser token exchange).
 * Copy expa-oauth-config.js + expa-login-impact.js into your other frontend.
 */

const EXPA_OAUTH = {
  authUrl: "https://auth.aiesec.org/oauth/authorize",
  tokenUrl: "https://auth.aiesec.org/oauth/token",
  gisPeopleMeUrl: "https://gis-api.aiesec.org/v2/people/me",

  // IMPACT app credentials – change redirectUri to your page URL when reusing
  clientId: "r3qZe9CsfLt7nb0QxzV4wRX4pbAXSpuYoKfixg3zJB8",
  clientSecret: "CwXyg4vpalrH6NZZGH_T9cO3eh2R39ugg8hDriF4tFw",
  redirectUri: "https://impact.aiesec.org.eg/",
  responseType: "code",
  grantType: "authorization_code",

  flow: "frontend-popup",
  afterLoginPath: "/",
  requireActiveMember: true,

  tokenStorageKey: "accessToken",
  useSessionStorage: true,
};

function buildAuthorizeUrl() {
  return (
    EXPA_OAUTH.authUrl +
    "?client_id=" + encodeURIComponent(EXPA_OAUTH.clientId) +
    "&redirect_uri=" + encodeURIComponent(EXPA_OAUTH.redirectUri) +
    "&response_type=" + EXPA_OAUTH.responseType
  );
}

function buildTokenRequestBody(code) {
  return {
    client_id: EXPA_OAUTH.clientId,
    client_secret: EXPA_OAUTH.clientSecret,
    redirect_uri: EXPA_OAUTH.redirectUri,
    grant_type: EXPA_OAUTH.grantType,
    code: code,
  };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { EXPA_OAUTH, buildAuthorizeUrl, buildTokenRequestBody };
}
if (typeof window !== "undefined") {
  window.EXPA_OAUTH = EXPA_OAUTH;
  window.buildAuthorizeUrl = buildAuthorizeUrl;
  window.buildTokenRequestBody = buildTokenRequestBody;
}
