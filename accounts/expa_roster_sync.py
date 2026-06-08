"""Sync current EXPA member positions into MemberRoster (EDM-style roster)."""

import logging
import time
from datetime import date

import requests
from django.conf import settings
from django.utils import timezone

from .function_mapping import department_from_expa_fields
from .position_selection import pick_current_position_row
from .role_mapping import parse_expa_role
from .models import ExpaMemberSyncConfig, MemberRoster

logger = logging.getLogger("accounts.expa")

MEMBER_POSITION_LIST_QUERY = """
query MemberPositionList($perPage: Int!, $page: Int!, $officeId: Int!, $dateFrom: DateTime!, $dateTo: DateTime!) {
  memberPositions(
    per_page: $perPage
    page: $page
    filters: { office_id: $officeId, start_date: { from: $dateFrom, to: $dateTo } }
    sort: "created_at"
  ) {
    data {
      id
      status
      start_date
      end_date
      role { name }
      person {
        id
        full_name
        home_lc { id name }
        email
      }
      function { id name }
      committee_department { id name }
      office { name }
    }
    paging {
      current_page
      total_pages
    }
  }
}
"""

MEMBER_POSITION_DETAIL_QUERY = """
query memberPosition($id: Int!) {
  memberPosition(id: $id) {
    id
    status
    start_date
    end_date
    function { id name }
    committee_department { id name }
    role { id name }
    office { id name parent { id name } }
    person { id full_name email home_lc { id name } }
  }
}
"""


def _normalize_access_token(raw):
    """Strip whitespace and accidental quotes from Coolify/.env values."""
    token = (raw or "").strip()
    if len(token) >= 2 and token[0] == token[-1] and token[0] in "\"'":
        token = token[1:-1].strip()
    return token


def _parse_sync_date(value, default):
    if not value:
        return default
    if isinstance(value, date):
        return value
    return date.fromisoformat(str(value)[:10])


def _env_sync_config():
    token = _normalize_access_token(getattr(settings, "EXPA_SYNC_ACCESS_TOKEN", None))
    if not token:
        return None
    office_raw = getattr(settings, "EXPA_SYNC_OFFICE_ID", None)
    office_id = int(office_raw) if office_raw not in (None, "") else None
    return type(
        "EnvSyncConfig",
        (),
        {
            "access_token": token,
            "graphql_url": getattr(
                settings, "EXPA_SYNC_GRAPHQL_URL", "https://gis-api.aiesec.org/graphql"
            ),
            "office_id": office_id,
            "date_from": _parse_sync_date(
                getattr(settings, "EXPA_SYNC_DATE_FROM", None), date(2025, 1, 1)
            ),
            "date_to": _parse_sync_date(
                getattr(settings, "EXPA_SYNC_DATE_TO", None), date.today()
            ),
        },
    )()


def get_sync_config(*, prefer_admin=False):
    """Resolve sync credentials.

    When EXPA_SYNC_ACCESS_TOKEN is set in the environment (Coolify), it takes
    precedence over the admin row so production env vars are not shadowed by a
    stale admin configuration.
    """
    row = ExpaMemberSyncConfig.objects.filter(is_active=True).first()
    env = _env_sync_config()
    if prefer_admin and row:
        return row, "admin"
    if env:
        return env, "environment"
    if row:
        return row, "admin"
    return None, "none"


def describe_sync_config(*, prefer_admin=False):
    config, source = get_sync_config(prefer_admin=prefer_admin)
    if not config:
        return source, "no configuration"
    token = _normalize_access_token(getattr(config, "access_token", None))
    preview = f"{token[:8]}…" if len(token) > 8 else "(empty)"
    return source, (
        f"source={source}, office_id={getattr(config, 'office_id', None)}, "
        f"token_len={len(token)}, token_preview={preview}"
    )


def fetch_member_positions_from_expa(config=None):
    """Fetch all member positions for the configured MC office."""
    if config is None:
        config, _source = get_sync_config()
    if not config:
        raise ValueError(
            "No EXPA sync config. Add Expa member sync in admin or set EXPA_SYNC_ACCESS_TOKEN."
        )

    token = _normalize_access_token(config.access_token)
    if not token:
        raise ValueError("EXPA sync access token is empty.")

    office_id = config.office_id
    if office_id is None:
        raise ValueError("office_id is required (Egypt MC id in EXPA).")

    date_from = config.date_from or date(2025, 1, 1)
    date_to = config.date_to or date.today()
    url = config.graphql_url or "https://gis-api.aiesec.org/graphql"

    all_rows = []
    page = 1
    total_pages = 1

    while page <= total_pages:
        variables = {
            "perPage": 2000,
            "page": page,
            "officeId": int(office_id),
            "dateFrom": date_from.isoformat(),
            "dateTo": date_to.isoformat(),
        }
        resp = requests.post(
            url,
            json={"query": MEMBER_POSITION_LIST_QUERY, "variables": variables},
            headers={
                "Authorization": token,
                "Accept": "application/json",
                "Content-Type": "application/json",
            },
            timeout=120,
        )
        resp.raise_for_status()
        data = resp.json()
        if data.get("errors"):
            raise RuntimeError(f"EXPA GraphQL errors: {data['errors']}")

        mp = data.get("data", {}).get("memberPositions") or {}
        items = mp.get("data") or []
        paging = mp.get("paging") or {}
        total_pages = int(paging.get("total_pages") or 1)

        for item in items:
            person = item.get("person") or {}
            home_lc = person.get("home_lc") or {}
            role = item.get("role") or {}
            func = item.get("function") or {}
            committee = item.get("committee_department") or {}
            role_raw = role.get("name") or ""
            func_raw = func.get("name") or ""
            committee_raw = committee.get("name") or ""
            office = item.get("office") or {}
            all_rows.append({
                "member_position_id": item.get("id"),
                "status": item.get("status"),
                "start_date": item.get("start_date"),
                "end_date": item.get("end_date"),
                "role_raw": role_raw,
                "role_name": role_raw,
                "department_raw": func_raw,
                "committee_department_raw": committee_raw,
                "person_id": person.get("id"),
                "full_name": person.get("full_name") or "",
                "home_lc_id": home_lc.get("id"),
                "home_lc_name": home_lc.get("name") or "",
                "email": person.get("email") or "",
                "office_name": office.get("name") if isinstance(office, dict) else "",
            })

        logger.info("EXPA roster sync page %s/%s — %s rows", page, total_pages, len(items))
        page += 1
        if page <= total_pages:
            time.sleep(0.25)

    return all_rows


def fetch_member_position_from_expa(position_id, config=None):
    """Fetch one memberPosition by id (same shape as EXPA UI query)."""
    if config is None:
        config, _source = get_sync_config()
    if not config:
        raise ValueError("No EXPA sync config.")
    token = _normalize_access_token(config.access_token)
    if not token:
        raise ValueError("EXPA sync access token is empty.")
    url = config.graphql_url or "https://gis-api.aiesec.org/graphql"
    resp = requests.post(
        url,
        json={
            "operationName": "memberPosition",
            "query": MEMBER_POSITION_DETAIL_QUERY,
            "variables": {"id": int(position_id)},
        },
        headers={
            "Authorization": token,
            "Accept": "application/json",
            "Content-Type": "application/json",
        },
        timeout=60,
    )
    resp.raise_for_status()
    data = resp.json()
    if data.get("errors"):
        raise RuntimeError(f"EXPA GraphQL errors: {data['errors']}")
    item = (data.get("data") or {}).get("memberPosition")
    if not item:
        return None

    person = item.get("person") or {}
    home_lc = person.get("home_lc") or {}
    role = item.get("role") or {}
    func = item.get("function") or {}
    committee = item.get("committee_department") or {}
    office = item.get("office") or {}
    role_raw = role.get("name") or ""
    func_raw = func.get("name") or ""
    committee_raw = committee.get("name") or ""
    return {
        "member_position_id": item.get("id"),
        "status": item.get("status"),
        "start_date": item.get("start_date"),
        "end_date": item.get("end_date"),
        "role_raw": role_raw,
        "role_name": role_raw,
        "department_raw": func_raw,
        "committee_department_raw": committee_raw,
        "person_id": person.get("id"),
        "full_name": person.get("full_name") or "",
        "home_lc_id": home_lc.get("id"),
        "home_lc_name": home_lc.get("name") or "",
        "email": person.get("email") or "",
        "office_name": office.get("name") if isinstance(office, dict) else "",
    }


def _pick_best_row(rows):
    """Current active position for this person (latest start_date among active)."""
    return pick_current_position_row(rows)


def _parse_position_row(row):
    """Split EXPA role vs department; academy from committee_department then function."""
    role_raw = row.get("role_name") or ""
    role_parsed = parse_expa_role(role_raw)
    dept = department_from_expa_fields(
        row.get("department_raw") or "",
        row.get("committee_department_raw") or "",
    )
    return {
        "role_code": role_parsed[0] if role_parsed else "",
        "role_name": role_parsed[1] if role_parsed else role_raw[:255],
        "role_raw": role_raw[:255],
        "committee_department": dept["committee_department"],
        "department_code": dept["department_code"],
        "department_name": dept["department_name"],
        "department_raw": dept["department_raw"],
        "academy_key": dept["academy_key"],
    }


def sync_roster_from_expa(config=None, deactivate_missing=True, enrich_missing_committee=False):
    """
    Upsert MemberRoster from EXPA. Returns counts dict.
    One roster row per person_id (current active position).

    The bulk memberPositions query includes committee_department; do not call
    memberPosition(id) per person unless enrich_missing_committee=True (very slow).
    """
    rows = fetch_member_positions_from_expa(config)
    by_person = {}
    for row in rows:
        pid = row.get("person_id")
        if pid is None:
            continue
        pid = str(pid)
        by_person.setdefault(pid, []).append(row)

    seen_ids = set()
    created = updated = 0
    now = timezone.now()
    total_people = len(by_person)

    for index, (person_id, person_rows) in enumerate(by_person.items(), start=1):
        if index == 1 or index % 500 == 0 or index == total_people:
            logger.info("EXPA roster upsert %s/%s people", index, total_people)

        best = _pick_best_row(person_rows)
        if enrich_missing_committee:
            pos_id = best.get("member_position_id")
            if pos_id and not best.get("committee_department_raw"):
                try:
                    detailed = fetch_member_position_from_expa(pos_id, config)
                    if detailed:
                        best = {**best, **detailed}
                except Exception as exc:
                    logger.warning(
                        "Could not fetch memberPosition %s for person %s: %s",
                        pos_id,
                        person_id,
                        exc,
                    )
        position = _parse_position_row(best)

        defaults = {
            "full_name": best.get("full_name") or "",
            "email": best.get("email") or "",
            "role_code": position["role_code"],
            "role_name": position["role_name"],
            "role_raw": position["role_raw"],
            "committee_department": best.get("committee_department_raw") or "",
            "department_code": position["department_code"],
            "department_name": position["department_name"],
            "department_raw": position["department_raw"],
            "academy_key": position["academy_key"],
            "home_lc_name": best.get("home_lc_name") or "",
            "member_position_id": str(best.get("member_position_id") or ""),
            "is_active": True,
            "last_synced_at": now,
        }
        _obj, was_created = MemberRoster.objects.update_or_create(
            expa_id=person_id,
            defaults=defaults,
        )
        seen_ids.add(person_id)
        if was_created:
            created += 1
        else:
            updated += 1

    deactivated = 0
    if deactivate_missing and seen_ids:
        deactivated = (
            MemberRoster.objects.exclude(expa_id__in=seen_ids)
            .filter(is_active=True)
            .update(is_active=False, last_synced_at=now)
        )

    return {
        "fetched": len(rows),
        "people": len(seen_ids),
        "created": created,
        "updated": updated,
        "deactivated": deactivated,
    }
