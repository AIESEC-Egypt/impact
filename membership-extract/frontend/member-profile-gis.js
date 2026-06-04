/**
 * EXPA GIS API – current member profile & active membership check (IMPACT style).
 * Requires EXPA access_token from OAuth (not the EDM JWT).
 */
(function (global) {
  "use strict";

  var GIS = {
    peopleMe: "https://gis-api.aiesec.org/v2/people/me",
    currentPerson: "https://gis-api.aiesec.org/v2/current_person",
    graphql: "https://gis-api.aiesec.org/graphql",
  };

  var CURRENT_PERSON_QUERY =
    "query { current_person { id full_name email home_lc { id name } home_mc { id name } current_positions { role title } roles member_positions { id status role { name } function { name } } } }";

  async function fetchPeopleMe(accessToken) {
    var url = GIS.peopleMe + "?access_token=" + encodeURIComponent(accessToken);
    var res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error("GIS people/me failed: " + res.status);
    return res.json();
  }

  async function fetchCurrentPerson(accessToken) {
    var url = GIS.currentPerson + "?access_token=" + encodeURIComponent(accessToken);
    var res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error("GIS current_person failed: " + res.status);
    return res.json();
  }

  async function fetchCurrentPersonGraphQL(accessToken) {
    var url = GIS.graphql + "?access_token=" + encodeURIComponent(accessToken);
    var res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ query: CURRENT_PERSON_QUERY }),
    });
    if (!res.ok) throw new Error("GIS GraphQL failed: " + res.status);
    var data = await res.json();
    if (data.errors && data.errors.length) {
      throw new Error(data.errors.map(function (e) { return e.message; }).join("; "));
    }
    return (data.data || {}).current_person || null;
  }

  /**
   * IMPACT rule: at least one member_positions entry with status === "active".
   */
  function hasActiveMemberPosition(profile) {
    var positions = profile.member_positions || [];
    return positions.some(function (pos) {
      return pos && pos.status === "active";
    });
  }

  /**
   * Alternative: current_positions with active status (some API shapes).
   */
  function hasActiveCurrentPosition(profile) {
    var positions = profile.current_positions || [];
    return positions.length > 0;
  }

  async function verifyActiveMember(accessToken, options) {
    var opts = options || {};
    var profile = await fetchPeopleMe(accessToken);
    var ok = hasActiveMemberPosition(profile);
    if (!ok && opts.allowCurrentPositions) {
      ok = hasActiveCurrentPosition(profile);
    }
    return { ok: ok, profile: profile };
  }

  function normalizeProfile(profile) {
    if (!profile) return null;
    return {
      expaId: profile.id || profile.person_id,
      fullName: profile.full_name,
      email: profile.email,
      homeLc: profile.home_lc,
      memberPositions: profile.member_positions || [],
      currentPositions: profile.current_positions || [],
      roles: profile.roles || [],
    };
  }

  global.MemberProfileGis = {
    GIS: GIS,
    CURRENT_PERSON_QUERY: CURRENT_PERSON_QUERY,
    fetchPeopleMe: fetchPeopleMe,
    fetchCurrentPerson: fetchCurrentPerson,
    fetchCurrentPersonGraphQL: fetchCurrentPersonGraphQL,
    hasActiveMemberPosition: hasActiveMemberPosition,
    hasActiveCurrentPosition: hasActiveCurrentPosition,
    verifyActiveMember: verifyActiveMember,
    normalizeProfile: normalizeProfile,
  };
})(typeof window !== "undefined" ? window : global);
