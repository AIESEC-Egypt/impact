# Membership extract – source map

**Folder:** `/Users/mohamedwael/Downloads/aiesec_edm-master/membership-extract/`

## Concepts

| Concept | Meaning in this repo |
|--------|----------------------|
| **Member roster** | `EXPAPerson` rows (`is_member=True`) synced from EXPA – who is *allowed* to use the app |
| **Logged-in user** | `ExpaAuthIdentity` – who completed OAuth; `updated_at` ≈ last login |
| **IMPACT active check** | GIS `people/me` → `member_positions` with `status === "active"` |
| **EDM gate** | `login_or_link_expa_user` requires `EXPAPerson` exists for `expa_id` |

## Original files in repo

### Backend
| Extract file | Source |
|--------------|--------|
| `backend/expa_client.py` | `general/expa_client.py` |
| `backend/role_mapping.py` | `general/role_mapping.py` |
| `backend/function_mapping.py` | `general/function_mapping.py` |
| `backend/quiz_assignment.py` | `TMHub/quiz_assignment.py` |
| `backend/models-snippet.py` | `general/models.py` (EXPAPerson, ExpaAuthIdentity, ExpaConfig) |
| `backend/login_member_gate.py` | `general/expa_oauth.py` → `login_or_link_expa_user` |
| `backend/management-list-logged-in.py` | template from `ExpaAuthIdentity` admin |

### Commands (run in full Django project)
| Command | Purpose |
|---------|---------|
| `python manage.py sync_expa_people --sync` | Fetch member positions from EXPA → create/update `EXPAPerson` |
| `python manage.py sync_member_role_function` | Update role/function on existing `EXPAPerson` |
| Admin → **EXPA auth identities** | View who logged in |

### GraphQL (`TMHub/schema.py`)
| Query/Mutation | Auth | Purpose |
|----------------|------|---------|
| `me` | JWT | Current logged-in member profile |
| `completeExpaOauth` | no | Exchange OAuth code → JWT |
| `myAssignedQuizzes` | JWT | Quizzes for logged-in member |
| `recalculateAssignments` | JWT | Refresh quiz assignments |

### Frontend (original)
| File | Purpose |
|------|---------|
| `(New Frontend) impact.../login.html` | Active member check via GIS |
| `(New Frontend) impact.../Academy/academy-graphql.js` | `edm_token` + `me` query |
| `(Old Frontend) tmhub.../home.html` | `get_current_user` + JWT |
| `expa-login-extract/expa-login-impact.js` | OAuth + active member |

## Use in another project

### Browser only (IMPACT)
```html
<script src="frontend/member-session.js"></script>
<script src="frontend/member-profile-gis.js"></script>
<script>
  var token = MemberSession.getExpaAccessToken();
  MemberProfileGis.verifyActiveMember(token).then(function (r) {
    console.log(r.ok, r.profile);
  });
</script>
```

### With EDM Django backend
```html
<script src="frontend/member-session.js"></script>
<script src="frontend/member-graphql-client.js"></script>
<script>
  window.MEMBER_GRAPHQL_ENDPOINT = "https://your-api/graphql";
  MemberGraphQL.fetchMe().then(console.log);
</script>
```

### List logged-in members (server)
```python
from membership_extract.backend.models_snippet import list_logged_in_members
print(list_logged_in_members(limit=200))
```

Or in Django shell:
```python
from general.models import ExpaAuthIdentity
for i in ExpaAuthIdentity.objects.select_related("expa_person__person").order_by("-updated_at")[:50]:
    print(i.expa_id, i.user.username, i.updated_at)
```
