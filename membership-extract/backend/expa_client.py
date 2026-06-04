"""
EXPA GraphQL client: fetches member positions using the access token stored in ExpaConfig.
Maps to the same API used by the Apps Script (MemberPositionList query).
"""
import logging
import time
from datetime import date

import requests

logger = logging.getLogger(__name__)

EXPA_GRAPHQL_URL_DEFAULT = "https://gis-api.aiesec.org/graphql"

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
      role { name }
      person {
        id
        full_name
        home_lc { id name }
        email
        dob
      }
      function { name }
      is_ixp
      no_of_ixps
    }
    paging {
      current_page
      total_pages
    }
  }
}
"""


def get_expa_config():
    """Return the first ExpaConfig row, or None if none exists or token is empty."""
    from general.models import ExpaConfig
    config = ExpaConfig.objects.first()
    if not config or not (config.access_token or "").strip():
        return None
    return config


def fetch_member_positions(
    access_token=None,
    graphql_url=None,
    office_id=None,
    date_from=None,
    date_to=None,
    per_page=2000,
    delay_between_pages=0.25,
):
    """
    Fetch all member positions from EXPA GraphQL API (same logic as the Apps Script).

    If access_token is None, reads from ExpaConfig (first row). Same for graphql_url,
    office_id, date_from, date_to if not provided.

    Returns:
        list of dicts, each with keys: member_position_id, role_name, person_id, full_name,
        home_lc_id, home_lc_name, email, dob, function_name, is_ixp, no_of_ixps
    """
    config = get_expa_config()
    if not config and not access_token:
        raise ValueError(
            "No EXPA access token. Set it in Django Admin under General > EXPA configs, "
            "or pass access_token=..."
        )

    token = (access_token or (config.access_token if config else "")).strip()
    if not token:
        raise ValueError("EXPA access token is empty.")

    url = graphql_url or (config.graphql_url if config else EXPA_GRAPHQL_URL_DEFAULT)
    oid = office_id if office_id is not None else (config.default_office_id if config else None)
    df = date_from or (config.date_from if config else None)
    dt = date_to or (config.date_to if config else None)

    if oid is None:
        raise ValueError("office_id is required. Set it in EXPA config or pass office_id=...")
    if not df:
        df = date(2025, 1, 1)
    if not dt:
        dt = date(2026, 2, 16)

    # EXPA often expects ISO date strings for DateTime
    date_from_str = df.isoformat() if hasattr(df, "isoformat") else str(df)
    date_to_str = dt.isoformat() if hasattr(dt, "isoformat") else str(dt)

    all_rows = []
    page = 1
    total_pages = 1

    while page <= total_pages:
        variables = {
            "perPage": per_page,
            "page": page,
            "officeId": oid,
            "dateFrom": date_from_str,
            "dateTo": date_to_str,
        }
        payload = {"query": MEMBER_POSITION_LIST_QUERY, "variables": variables}
        headers = {
            "Authorization": token,
            "Accept": "*/*",
            "Content-Type": "application/json",
        }

        resp = requests.post(url, json=payload, headers=headers, timeout=60)
        resp.raise_for_status()
        data = resp.json()

        if data.get("errors"):
            raise RuntimeError("EXPA GraphQL errors: " + str(data["errors"]))

        mp = data.get("data", {}).get("memberPositions") or {}
        items = mp.get("data") or []
        paging = mp.get("paging") or {}
        total_pages = int(paging.get("total_pages") or 1)

        for mp_item in items:
            person = mp_item.get("person") or {}
            home_lc = person.get("home_lc") or {}
            role = mp_item.get("role") or {}
            func = mp_item.get("function") or {}
            all_rows.append({
                "member_position_id": mp_item.get("id"),
                "role_name": role.get("name") or "",
                "person_id": person.get("id"),
                "full_name": person.get("full_name") or "",
                "home_lc_id": home_lc.get("id"),
                "home_lc_name": home_lc.get("name") or "",
                "email": person.get("email") or "",
                "dob": person.get("dob"),
                "function_name": func.get("name") or "",
                "is_ixp": mp_item.get("is_ixp"),
                "no_of_ixps": mp_item.get("no_of_ixps"),
            })

        logger.info("EXPA fetch page %s/%s — %s rows", page, total_pages, len(items))
        page += 1
        if page <= total_pages:
            time.sleep(delay_between_pages)

    return all_rows
