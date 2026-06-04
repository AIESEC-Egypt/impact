/**
 * End-to-end IMPACT-style login + membership gate + optional EDM me fetch.
 * Depends: member-session.js, member-profile-gis.js, (optional) member-graphql-client.js
 */
(function (global) {
  "use strict";

  async function afterExpaToken(accessToken, options) {
    var opts = options || {};
    var Session = global.MemberSession;
    var Gis = global.MemberProfileGis;
    if (!Session || !Gis) {
      throw new Error("Load member-session.js and member-profile-gis.js first.");
    }

    Session.setExpaAccessToken(accessToken);

    var result = await Gis.verifyActiveMember(accessToken, {
      allowCurrentPositions: !!opts.allowCurrentPositions,
    });

    if (!result.ok) {
      Session.clearExpaAccessToken();
      throw new Error(opts.inactiveMessage || "Not an active AIESEC member.");
    }

    var normalized = Gis.normalizeProfile(result.profile);
    Session.saveMemberProfile(normalized);

    if (opts.fetchEdmMe && global.MemberGraphQL) {
      try {
        var me = await global.MemberGraphQL.fetchMe();
        normalized.edmMe = me;
        Session.saveMemberProfile(normalized);
      } catch (e) {
        if (opts.requireEdmMe) throw e;
      }
    }

    return normalized;
  }

  function redirectAfterLogin(path) {
    window.location.href = path || "/";
  }

  global.MemberLoginFlow = {
    afterExpaToken: afterExpaToken,
    redirectAfterLogin: redirectAfterLogin,
  };
})(typeof window !== "undefined" ? window : global);
