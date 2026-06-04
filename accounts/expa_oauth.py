"""Server-side EXPA (AIESEC GIS) OAuth helpers.

All network calls and the client secret stay on the server. The browser only
ever sees the authorize redirect and our own session cookie.
"""

import json
import logging
from datetime import date, datetime
from urllib.parse import urlencode

import requests

logger = logging.getLogger("accounts.expa")
from django.conf import settings
from django.utils.dateparse import parse_date, parse_datetime

from .models import ExpaOAuthConfig

# GIS removed /v2/people/me; REST + GraphQL current_person are supported.
CURRENT_PERSON_URL = "https://gis-api.aiesec.org/v2/current_person.json"
LEGACY_PEOPLE_ME_URL = "https://gis-api.aiesec.org/v2/people/me"
GRAPHQL_URL = "https://gis-api.aiesec.org/graphql"

PROFILE_GRAPHQL_QUERY = """
query ImpactProfile {
  currentPerson {
    id
    full_name
    email
    is_aiesecer
    person_status
    status
    home_mc { id name full_name tag }
    home_lc { id name full_name tag parent { id name full_name } }
    lc_alignment { id name }
    current_office { id name full_name tag }
    member_positions {
      edges {
        node {
          id
          start_date
          end_date
          status
          title
          office { id name full_name tag parent { name } }
          role { id name }
          function { name }
          committee_department { name }
        }
      }
    }
    current_positions {
      id
      start_date
      end_date
      status
      title
      office { id name full_name tag }
      role
      function { name }
      committee_department { name }
    }
  }
}
"""

GET_PERSON_QUERY = """
query ImpactGetPerson($id: ID!) {
  getPerson(id: $id) {
    id
    full_name
    email
    is_aiesecer
    person_status
    status
    home_mc { id name full_name tag }
    home_lc { id name full_name tag parent { id name full_name } }
    lc_alignment { id name }
    current_office { id name full_name tag }
    member_positions {
      edges {
        node {
          id
          start_date
          end_date
          status
          title
          office { id name full_name tag parent { name } }
          role { id name }
          function { name }
          committee_department { name }
        }
      }
    }
    current_positions {
      id
      start_date
      end_date
      status
      title
      office { id name full_name tag }
      role
      function { name }
      committee_department { name }
    }
  }
}
"""


class ExpaConfig:
    """Resolved config: DB row if present, otherwise settings fallback."""

    def __init__(self, client_id, client_secret, auth_url, token_url,
                 people_me_url, redirect_uri, allowed_entities, require_active_member):
        self.client_id = client_id
        self.client_secret = client_secret
        self.auth_url = auth_url
        self.token_url = token_url
        self.people_me_url = people_me_url
        self.redirect_uri = redirect_uri
        self.allowed_entities = allowed_entities
        self.require_active_member = require_active_member


def get_config():
    row = ExpaOAuthConfig.objects.filter(is_active=True).first()
    if row:
        return ExpaConfig(
            client_id=row.client_id,
            client_secret=row.client_secret,
            auth_url=row.auth_url,
            token_url=row.token_url,
            people_me_url=row.people_me_url,
            redirect_uri=row.redirect_uri,
            allowed_entities=row.allowed_entities_list,
            require_active_member=row.require_active_member,
        )
    cfg = settings.EXPA_OAUTH
    return ExpaConfig(
        client_id=cfg["CLIENT_ID"],
        client_secret=cfg["CLIENT_SECRET"],
        auth_url=cfg["AUTH_URL"],
        token_url=cfg["TOKEN_URL"],
        people_me_url=cfg["PEOPLE_ME_URL"],
        redirect_uri=cfg["REDIRECT_URI"],
        allowed_entities=cfg["ALLOWED_ENTITIES"],
        require_active_member=cfg["REQUIRE_ACTIVE_MEMBER"],
    )


def build_authorize_url(config):
    query = urlencode({
        "client_id": config.client_id,
        "redirect_uri": config.redirect_uri,
        "response_type": "code",
    })
    return f"{config.auth_url}?{query}"


def exchange_code_for_token(config, code):
    """Exchange an authorization code for an access token."""
    payload = {
        "grant_type": "authorization_code",
        "code": code,
        "redirect_uri": config.redirect_uri,
        "client_id": config.client_id,
        "client_secret": config.client_secret,
    }
    resp = requests.post(
        config.token_url,
        json=payload,
        headers={"Content-Type": "application/json"},
        timeout=30,
    )
    resp.raise_for_status()
    return resp.json()


def _normalize_profile(data):
    """Unwrap GIS REST/GraphQL responses that nest the person under a key."""
    if not isinstance(data, dict):
        return data
    gql_data = data.get("data")
    if isinstance(gql_data, dict):
        for key in ("currentPerson", "getPerson", "person"):
            current = gql_data.get(key)
            if isinstance(current, dict):
                return current
    for key in ("person", "current_person", "currentPerson", "getPerson"):
        nested = data.get(key)
        if isinstance(nested, dict) and (
            "id" in nested
            or "member_positions" in nested
            or "current_positions" in nested
            or "email" in nested
            or "home_lc" in nested
            or "home_mc" in nested
        ):
            return nested
    return data


def _profile_fetch_urls(config):
    """URLs to try, newest GIS endpoint first."""
    urls = []
    configured = (config.people_me_url or "").rstrip("/")
    if configured and configured != LEGACY_PEOPLE_ME_URL.rstrip("/"):
        urls.append(config.people_me_url)
    urls.append(CURRENT_PERSON_URL)
    if configured == LEGACY_PEOPLE_ME_URL.rstrip("/"):
        urls.append(LEGACY_PEOPLE_ME_URL)
    seen = set()
    ordered = []
    for url in urls:
        if url and url not in seen:
            seen.add(url)
            ordered.append(url)
    return ordered


def _graphql_request(access_token, query, variables=None):
    body = {"query": query}
    if variables:
        body["variables"] = variables
    resp = requests.post(
        GRAPHQL_URL,
        params={"access_token": access_token},
        json=body,
        timeout=30,
    )
    resp.raise_for_status()
    return resp.json()


def _fetch_profile_graphql(access_token, person_id=None, sources=None):
    payload = _graphql_request(access_token, PROFILE_GRAPHQL_QUERY)
    if sources is not None:
        sources["graphql_current_person"] = payload
    profile = _normalize_profile(payload)
    if not profile and payload.get("errors"):
        raise RuntimeError(payload["errors"][0].get("message", "GraphQL profile error"))
    pid = person_id or profile.get("id")
    if pid:
        detail_payload = _fetch_get_person_graphql_raw(access_token, pid, sources=sources)
        profile = _merge_profiles(profile, _normalize_profile(detail_payload))
    return profile


def _fetch_get_person_graphql_raw(access_token, person_id, sources=None):
    payload = _graphql_request(
        access_token,
        GET_PERSON_QUERY,
        variables={"id": str(person_id)},
    )
    if sources is not None:
        sources["graphql_get_person"] = payload
    if payload.get("errors"):
        return {}
    return payload


def _fetch_profile_rest(config, access_token, sources=None):
    last_error = None
    for url in _profile_fetch_urls(config):
        try:
            rest_url = url if url.endswith(".json") else f"{url.rstrip('/')}.json"
            resp = requests.get(
                rest_url,
                params={"access_token": access_token},
                timeout=30,
            )
            if resp.status_code == 404:
                if sources is not None:
                    sources[f"rest_{rest_url}"] = {"status": 404}
                continue
            resp.raise_for_status()
            payload = resp.json()
            if sources is not None:
                sources["rest_current_person"] = payload
            return _normalize_profile(payload)
        except Exception as exc:
            last_error = exc
            if sources is not None:
                sources["rest_current_person_error"] = str(exc)
    if last_error:
        raise last_error
    raise RuntimeError("No GIS REST profile endpoint available")


def _merge_profiles(primary, secondary):
    """Merge GraphQL + REST profile payloads (positions from both)."""
    if not secondary:
        return primary or {}
    if not primary:
        return secondary
    merged = dict(primary)
    for field in ("member_positions", "current_positions"):
        combined = _extract_position_list(merged.get(field))
        combined.extend(_extract_position_list(secondary.get(field)))
        if combined:
            merged[field] = combined
    for key, value in secondary.items():
        if key not in merged or merged[key] in (None, "", [], {}):
            merged[key] = value
    return merged


def _fetch_person_rest(access_token, person_id, sources=None):
    if not person_id:
        return {}
    url = f"https://gis-api.aiesec.org/v2/people/{person_id}.json"
    resp = requests.get(url, params={"access_token": access_token}, timeout=30)
    if resp.status_code == 404:
        if sources is not None:
            sources["rest_person_by_id"] = {"status": 404, "url": url}
        return {}
    resp.raise_for_status()
    payload = resp.json()
    if sources is not None:
        sources["rest_person_by_id"] = payload
    return _normalize_profile(payload)


def fetch_profile(config, access_token):
    """Load profile via GraphQL (full fields) with REST fallback.

    Returns (merged_profile, raw_api_responses) for logging/debugging.
    """
    profile = {}
    sources = {}
    errors = []
    try:
        profile = _fetch_profile_graphql(access_token, sources=sources)
    except Exception as exc:
        sources["graphql_error"] = str(exc)
        errors.append(exc)
    try:
        rest_profile = _fetch_profile_rest(config, access_token, sources=sources)
        profile = _merge_profiles(profile, rest_profile)
    except Exception as exc:
        if "rest_current_person_error" not in sources:
            sources["rest_error"] = str(exc)
        errors.append(exc)
    if profile.get("id"):
        try:
            profile = _merge_profiles(
                profile,
                _fetch_person_rest(access_token, profile.get("id"), sources=sources),
            )
        except Exception as exc:
            sources["rest_person_by_id_error"] = str(exc)
            errors.append(exc)
    if not profile:
        if errors:
            raise errors[0]
        raise RuntimeError("No GIS profile endpoint available")
    return profile, sources


def log_expa_profile_responses(raw_sources, merged_profile, *, allowed=None, reason=None, summary=None):
    """Write full GIS/EXPA API payloads to logs/expa_oauth.log and the console."""
    lines = [
        "",
        "=" * 72,
        "EXPA / GIS profile response (full)",
        "=" * 72,
    ]
    for key, payload in raw_sources.items():
        lines.append(f"--- {key} ---")
        if isinstance(payload, (dict, list)):
            lines.append(json.dumps(payload, indent=2, default=str, ensure_ascii=False))
        else:
            lines.append(str(payload))
    lines.append("--- merged_profile (used for eligibility) ---")
    lines.append(json.dumps(merged_profile, indent=2, default=str, ensure_ascii=False))
    if summary is not None:
        lines.append("--- eligibility_summary ---")
        lines.append(json.dumps(summary, indent=2, default=str, ensure_ascii=False))
    if allowed is not None:
        lines.append(f"--- gate_result: allowed={allowed} reason={reason or 'n/a'} ---")
    lines.append("=" * 72)
    message = "\n".join(lines)
    logger.info(message)


# ---------------------------------------------------------------------------
# Eligibility / gate logic
# ---------------------------------------------------------------------------

def _extract_position_list(value):
    """Normalize GIS list / connection / edges shapes to a plain list."""
    if value is None:
        return []
    if isinstance(value, list):
        return [item for item in value if item]
    if isinstance(value, dict):
        if "edges" in value:
            nodes = []
            for edge in value.get("edges") or []:
                if isinstance(edge, dict) and edge.get("node"):
                    nodes.append(edge["node"])
            return nodes
        for key in ("data", "nodes", "results"):
            if key in value:
                return _extract_position_list(value[key])
    return []


def iter_positions(profile):
    """Yield member + legacy current positions without duplicates."""
    seen = set()
    for field in ("member_positions", "current_positions"):
        for pos in _extract_position_list(profile.get(field)):
            pos_id = (pos or {}).get("id")
            key = (field, pos_id) if pos_id is not None else (field, id(pos))
            if key in seen:
                continue
            seen.add(key)
            yield pos


def _coerce_date(value):
    if not value:
        return None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    parsed = parse_datetime(str(value))
    if parsed:
        return parsed.date()
    return parse_date(str(value))


def _role_name(position):
    role = (position or {}).get("role")
    if isinstance(role, dict):
        return role.get("name") or ""
    return role or ""


def _office_name(position):
    office = (position or {}).get("office") or {}
    if isinstance(office, dict):
        return office.get("full_name") or office.get("name") or ""
    return ""


def position_is_active(position):
    """True if GIS marks the position active or dates imply it is ongoing."""
    status = (position or {}).get("status")
    if status is not None:
        normalized = str(status).strip().lower()
        if normalized in {"active", "current", "open", "1", "true"}:
            return True
        if normalized in {"completed", "terminated", "inactive", "closed", "0", "false"}:
            return False
    end = _coerce_date((position or {}).get("end_date"))
    if end and end < date.today():
        return False
    start = _coerce_date((position or {}).get("start_date"))
    if start and start > date.today():
        return False
    # REST current_positions often omit status; treat ongoing date range as active.
    return True


def _append_committee_names(names, committee):
    """Add office/LC/MC names including parent MC on home_lc."""
    if isinstance(committee, str) and committee.strip():
        names.append(committee.strip())
        return
    if not isinstance(committee, dict):
        return
    for key in ("name", "full_name", "tag"):
        if committee.get(key):
            names.append(str(committee[key]))
    parent = committee.get("parent")
    if isinstance(parent, dict):
        _append_committee_names(names, parent)
    country = committee.get("country")
    if isinstance(country, dict) and country.get("name"):
        names.append(country["name"])


def _entity_names(profile):
    """Collect MC/LC/office names used to match allowed entities (e.g. egypt)."""
    names = []
    for key in ("home_mc_name", "home_lc_name", "person_mc", "person_lc"):
        if profile.get(key):
            names.append(str(profile[key]))

    for field in ("home_mc", "home_lc", "current_office", "lc_alignment"):
        _append_committee_names(names, profile.get(field))

    for pos in iter_positions(profile):
        _append_committee_names(names, (pos or {}).get("office"))
    return names


def is_entity_allowed(profile, allowed_entities):
    """True if home MC OR any office/entity matches an allowed entity name."""
    if not allowed_entities:
        return True
    haystack = " | ".join(n.lower() for n in _entity_names(profile) if n)
    return any(allowed in haystack for allowed in allowed_entities)


def _truthy(value):
    if value is True:
        return True
    if isinstance(value, str):
        return value.strip().lower() in {"true", "1", "yes"}
    return value in (1,)


def has_active_position(profile):
    """Active committee role, or flagged as current AIESEC member on EXPA."""
    if any(position_is_active(pos) for pos in iter_positions(profile)):
        return True
    if _truthy(profile.get("is_aiesecer")) or _truthy(profile.get("person_is_aiesecer")):
        return True
    person_status = str(profile.get("person_status") or profile.get("status") or "").lower()
    if person_status in {"member", "open", "active"}:
        return True
    return False


def evaluate_eligibility(profile, config):
    """Return (is_allowed, reason)."""
    from .member_roster import get_roster_member, roster_gate_enabled

    expa_id = str(profile.get("id") or "")
    if roster_gate_enabled():
        member = get_roster_member(expa_id)
        if not member:
            return False, "not_in_roster"
        return True, "ok"

    if config.require_active_member and not has_active_position(profile):
        return False, "no_active_position"
    if not is_entity_allowed(profile, config.allowed_entities):
        return False, "entity_not_allowed"
    return True, "ok"


def eligibility_summary(profile, config):
    """Human-readable breakdown for access-denied debugging."""
    positions = []
    for pos in iter_positions(profile):
        positions.append({
            "id": (pos or {}).get("id"),
            "status": (pos or {}).get("status"),
            "title": (pos or {}).get("title"),
            "role": _role_name(pos),
            "office": _office_name(pos),
            "start_date": (pos or {}).get("start_date"),
            "end_date": (pos or {}).get("end_date"),
            "counts_as_active": position_is_active(pos),
        })
    from .member_roster import get_roster_member, roster_gate_enabled

    entities = _entity_names(profile)
    home_lc = profile.get("home_lc") or {}
    home_mc = profile.get("home_mc") or {}
    expa_id = str(profile.get("id") or "")
    roster_member = get_roster_member(expa_id) if roster_gate_enabled() else None
    profile_department = ""
    profile_academy = ""
    profile_role = ""
    if not roster_member:
        from .profile_department import department_from_profile

        inferred = department_from_profile(profile)
        if inferred:
            code = inferred.get("department_code") or ""
            name = inferred.get("department_name") or ""
            profile_department = f"{code} — {name}" if code and name and name != code else (name or code)
            profile_academy = inferred.get("academy_key") or ""
            role_code = inferred.get("role_code") or ""
            role_name = inferred.get("role_name") or ""
            profile_role = f"{role_code} — {role_name}" if role_code and role_name and role_code != role_name else (role_name or role_code)
    return {
        "expa_id": profile.get("id"),
        "roster_gate": roster_gate_enabled(),
        "in_roster": bool(roster_member),
        "roster_role": roster_member.role_display if roster_member else "",
        "roster_department": roster_member.department_display if roster_member else "",
        "roster_department_code": roster_member.department_code if roster_member else "",
        "roster_academy": roster_member.academy_key if roster_member else "",
        "profile_role": profile_role,
        "profile_department": profile_department,
        "profile_academy": profile_academy,
        "full_name": profile.get("full_name"),
        "email": profile.get("email"),
        "is_aiesecer": profile.get("is_aiesecer"),
        "person_status": profile.get("person_status") or profile.get("status"),
        "home_lc": home_lc.get("name") if isinstance(home_lc, dict) else home_lc,
        "home_mc": home_mc.get("name") if isinstance(home_mc, dict) else home_mc,
        "entities_found": entities,
        "entity_allowed": is_entity_allowed(profile, config.allowed_entities),
        "has_active_position": has_active_position(profile),
        "positions": positions,
        "profile_field_count": len(profile.keys()),
        "profile_keys": sorted(profile.keys()),
    }


def home_mc_name(profile):
    home_mc = profile.get("home_mc") or {}
    if isinstance(home_mc, dict) and home_mc.get("name"):
        return home_mc["name"]
    home_lc = profile.get("home_lc") or {}
    if isinstance(home_lc, dict):
        parent = home_lc.get("parent") or {}
        if isinstance(parent, dict) and parent.get("name"):
            return parent["name"]
    return profile.get("home_mc_name") or ""


def current_office_name(profile):
    office = profile.get("current_office") or {}
    if isinstance(office, dict) and office.get("name"):
        return office["name"]
    last_active_office = ""
    for pos in iter_positions(profile):
        if position_is_active(pos):
            name = _office_name(pos)
            if name:
                last_active_office = name
    return last_active_office
