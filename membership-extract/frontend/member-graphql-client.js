/**
 * EDM backend GraphQL – get the logged-in member linked in ExpaAuthIdentity (query `me`).
 * Token: edm_token cookie / JWT header (from EXPA login via Django).
 */
(function (global) {
  "use strict";

  var endpoint = global.MEMBER_GRAPHQL_ENDPOINT || "http://127.0.0.1:8000/graphql";

  function getHeaders() {
    var headers = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };
    if (global.MemberSession) {
      Object.assign(headers, global.MemberSession.getAuthHeaderForGraphQL());
    }
    return headers;
  }

  async function request(query, variables, requireAuth) {
    var headers = getHeaders();
    if (requireAuth && !headers.Authorization) {
      throw new Error("Not logged in: missing edm_token / JWT.");
    }
    var res = await fetch(endpoint, {
      method: "POST",
      headers: headers,
      body: JSON.stringify({ query: query, variables: variables || {} }),
    });
    var text = await res.text();
    var payload;
    try {
      payload = text ? JSON.parse(text) : {};
    } catch (e) {
      throw new Error("Invalid GraphQL JSON");
    }
    if (!res.ok) {
      throw new Error("GraphQL HTTP " + res.status);
    }
    if (payload.errors && payload.errors.length) {
      throw new Error(payload.errors.map(function (e) { return e.message; }).join("; "));
    }
    return payload;
  }

  var ME_QUERY = [
    "query LoggedInMember {",
    "  me {",
    "    expaId",
    "    fullName",
    "    personId",
    "    officeName",
    "    roleCode",
    "    roleName",
    "    functionCode",
    "    functionName",
    "  }",
    "}",
  ].join("\n");

  var COMPLETE_OAUTH = [
    "mutation CompleteExpaOAuth($code: String!, $state: String) {",
    "  completeExpaOauth(code: $code, state: $state) {",
    "    token",
    "    username",
    "    expaId",
    "  }",
    "}",
  ].join("\n");

  var MY_QUIZZES = [
    "query MyAssignedQuizzes($status: String) {",
    "  myAssignedQuizzes(status: $status) {",
    "    id status assignedAt quiz { id title }",
    "  }",
    "}",
  ].join("\n");

  async function fetchMe() {
    var payload = await request(ME_QUERY, {}, true);
    return payload.data ? payload.data.me : null;
  }

  /** Legacy shape used by old tmhub frontend */
  async function fetchCurrentUserLegacy() {
    var me = await fetchMe();
    if (!me) return { data: { CurrentUser: null } };
    var firstName = (me.fullName || "").trim().split(/\s+/)[0] || "";
    return {
      data: {
        CurrentUser: {
          id: me.expaId,
          profile: { firstName: firstName },
          _rawMe: me,
        },
      },
    };
  }

  async function completeExpaOauth(code, state) {
    var payload = await request(COMPLETE_OAUTH, { code: code, state: state || null }, false);
    var row = payload.data ? payload.data.completeExpaOauth : null;
    if (row && row.token && global.MemberSession) {
      global.MemberSession.setAppJwt(row.token);
    }
    return row;
  }

  async function fetchMyAssignedQuizzes(status) {
    var payload = await request(MY_QUIZZES, { status: status || null }, true);
    return payload.data ? payload.data.myAssignedQuizzes : [];
  }

  global.MemberGraphQL = {
    setEndpoint: function (url) { endpoint = url; },
    request: request,
    fetchMe: fetchMe,
    fetchCurrentUserLegacy: fetchCurrentUserLegacy,
    completeExpaOauth: completeExpaOauth,
    fetchMyAssignedQuizzes: fetchMyAssignedQuizzes,
    ME_QUERY: ME_QUERY,
    COMPLETE_OAUTH: COMPLETE_OAUTH,
  };
})(typeof window !== "undefined" ? window : global);
