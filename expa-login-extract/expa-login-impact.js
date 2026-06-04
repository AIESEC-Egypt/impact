/**
 * IMPACT-style EXPA login – include after expa-oauth-config.js
 * Usage on any page: <button onclick="loginWithExpa()">Login with EXPA</button>
 */
(function () {
  var popup;

  function getStorage() {
    var cfg = window.EXPA_OAUTH;
    return cfg.useSessionStorage !== false ? sessionStorage : localStorage;
  }

  function persistToken(token) {
    var cfg = window.EXPA_OAUTH;
    var key = cfg.tokenStorageKey || "accessToken";
    getStorage().setItem(key, token);
  }

  function getStoredToken() {
    var cfg = window.EXPA_OAUTH;
    return getStorage().getItem(cfg.tokenStorageKey || "accessToken");
  }

  async function verifyActiveMember(token) {
    var cfg = window.EXPA_OAUTH;
    if (!cfg.requireActiveMember) return true;

    var url = (cfg.gisPeopleMeUrl || "https://gis-api.aiesec.org/v2/people/me") +
      "?access_token=" + encodeURIComponent(token);
    var profileResponse = await fetch(url);
    var profileData = await profileResponse.json();
    var positions = profileData.member_positions || [];
    return positions.some(function (pos) {
      return pos.status === "active";
    });
  }

  async function exchangeCodeForToken(authCode) {
    var cfg = window.EXPA_OAUTH;
    var response = await fetch(cfg.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildTokenRequestBody(authCode)),
    });
    var data = await response.json();

    if (!data.access_token) {
      alert("Login failed.");
      return;
    }

    var token = data.access_token;
    persistToken(token);

    try {
      var isActive = await verifyActiveMember(token);
      if (isActive) {
        window.location.href = cfg.afterLoginPath || "/";
      } else {
        alert("You are not an active member. Please contact your AIESEC team.");
      }
    } catch (err) {
      console.error("Error checking position status:", err);
      alert("Failed to verify member status.");
    }
  }

  function checkForAuthCode() {
    var urlParams = new URLSearchParams(window.location.search);
    var authCode = urlParams.get("code");
    if (authCode) {
      exchangeCodeForToken(authCode);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }

  function loginWithExpa() {
    var authUrl = buildAuthorizeUrl();
    popup = window.open(authUrl, "EXPA Login", "width=600,height=700");

    if (!popup || popup.closed || typeof popup.closed === "undefined") {
      alert("Popup blocked! Please allow popups.");
      return;
    }

    var interval = setInterval(function () {
      if (!popup || popup.closed) {
        clearInterval(interval);
        checkForAuthCode();
      } else {
        try {
          var popupUrl = popup.location.href;
          if (popupUrl.indexOf("?code=") !== -1) {
            var authCode = new URL(popupUrl).searchParams.get("code");
            if (authCode) {
              popup.close();
              clearInterval(interval);
              exchangeCodeForToken(authCode);
            }
          }
        } catch (e) {}
      }
    }, 1000);
  }

  window.loginWithExpa = loginWithExpa;
  window.exchangeCodeForToken = exchangeCodeForToken;
  window.checkForAuthCode = checkForAuthCode;
  window.getExpaAccessToken = getStoredToken;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", checkForAuthCode);
  } else {
    checkForAuthCode();
  }
})();
