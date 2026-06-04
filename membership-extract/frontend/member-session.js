/**
 * Session helpers – who is logged in on the browser.
 * EDM uses cookie/localStorage "edm_token" (app JWT).
 * IMPACT uses sessionStorage "accessToken" (EXPA OAuth token).
 */
(function (global) {
  "use strict";

  var CONFIG = {
    jwtCookieName: "edm_token",
    jwtStorageKey: "edm_token",
    expaTokenKey: "accessToken",
    profileStorageKey: "expaMemberProfile",
    useSessionForExpa: true,
  };

  function storage() {
    return CONFIG.useSessionForExpa ? sessionStorage : localStorage;
  }

  function getCookie(name) {
    var prefix = name + "=";
    var parts = (document.cookie || "").split(";");
    for (var i = 0; i < parts.length; i++) {
      var c = parts[i].trim();
      if (c.indexOf(prefix) === 0) {
        return decodeURIComponent(c.slice(prefix.length));
      }
    }
    return "";
  }

  function setCookie(name, value, days) {
    var d = new Date();
    d.setTime(d.getTime() + (days || 7) * 86400000);
    document.cookie =
      name + "=" + encodeURIComponent(value) +
      ";expires=" + d.toUTCString() + ";path=/;SameSite=Lax";
  }

  function clearCookie(name) {
    document.cookie =
      name + "=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/";
  }

  /** App JWT after EDM / GraphQL completeExpaOAuth */
  function getAppJwt() {
    var t = getCookie(CONFIG.jwtCookieName);
    if (t) return t;
    try {
      return localStorage.getItem(CONFIG.jwtStorageKey) || "";
    } catch (e) {
      return "";
    }
  }

  function setAppJwt(token, days) {
    setCookie(CONFIG.jwtCookieName, token, days);
    try {
      localStorage.setItem(CONFIG.jwtStorageKey, token);
    } catch (e) {}
  }

  function clearAppJwt() {
    clearCookie(CONFIG.jwtCookieName);
    try {
      localStorage.removeItem(CONFIG.jwtStorageKey);
    } catch (e) {}
  }

  /** EXPA OAuth access token (IMPACT style) */
  function getExpaAccessToken() {
    try {
      return storage().getItem(CONFIG.expaTokenKey) || "";
    } catch (e) {
      return "";
    }
  }

  function setExpaAccessToken(token) {
    storage().setItem(CONFIG.expaTokenKey, token);
  }

  function clearExpaAccessToken() {
    storage().removeItem(CONFIG.expaTokenKey);
  }

  function isLoggedIn() {
    return !!(getAppJwt() || getExpaAccessToken());
  }

  function getAuthHeaderForGraphQL() {
    var jwt = getAppJwt();
    if (jwt) return { Authorization: "JWT " + jwt };
    return {};
  }

  function saveMemberProfile(profile) {
    try {
      storage().setItem(CONFIG.profileStorageKey, JSON.stringify(profile));
    } catch (e) {}
  }

  function getMemberProfile() {
    try {
      var raw = storage().getItem(CONFIG.profileStorageKey);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function logoutLocal() {
    clearAppJwt();
    clearExpaAccessToken();
    try {
      storage().removeItem(CONFIG.profileStorageKey);
    } catch (e) {}
  }

  global.MemberSession = {
    CONFIG: CONFIG,
    getCookie: getCookie,
    getAppJwt: getAppJwt,
    setAppJwt: setAppJwt,
    clearAppJwt: clearAppJwt,
    getExpaAccessToken: getExpaAccessToken,
    setExpaAccessToken: setExpaAccessToken,
    clearExpaAccessToken: clearExpaAccessToken,
    isLoggedIn: isLoggedIn,
    getAuthHeaderForGraphQL: getAuthHeaderForGraphQL,
    saveMemberProfile: saveMemberProfile,
    getMemberProfile: getMemberProfile,
    logoutLocal: logoutLocal,
  };
})(typeof window !== "undefined" ? window : global);
