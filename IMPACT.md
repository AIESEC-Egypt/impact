# IMPACT — AIESEC in Egypt Learning & National Hub

**URL:** [https://impact.aiesec.org.eg](https://impact.aiesec.org.eg)

This document describes what IMPACT is, what it offers to members and leaders, and how the learning system (LMS) behind it works. It is written for MC members, academy leads, content managers, and anyone onboarding to the platform.

---

## Table of contents

1. [What is IMPACT?](#what-is-impact)
2. [Who IMPACT is for](#who-impact-is-for)
3. [The site at a glance](#the-site-at-a-glance)
4. [Logging in with EXPA](#logging-in-with-expa)
5. [Member roster and academy routing](#member-roster-and-academy-routing)
6. [The LMS — learning management system](#the-lms--learning-management-system)
7. [Functional academies](#functional-academies)
8. [Materials and session videos](#materials-and-session-videos)
9. [Quizzes and exams](#quizzes-and-exams)
10. [Dreaming process and the Haweya certificate](#dreaming-process-and-the-haweya-certificate)
11. [The manage portal](#the-manage-portal)
12. [Django admin](#django-admin)
13. [Tracking, reporting, and exports](#tracking-reporting-and-exports)
14. [Public pages and national tools](#public-pages-and-national-tools)
15. [Roles and permissions](#roles-and-permissions)
16. [Technical overview](#technical-overview)
17. [Operations and deployment](#operations-and-deployment)
18. [Support](#support)

---

## What is IMPACT?

IMPACT is the official digital hub for **AIESEC in Egypt**. It brings together:

- **Functional education** — structured academies for each product line (oGV, iGV, oGT, iGT, B2C, B2B, BD, TM, F&L)
- **The Dreaming process** — culture, identity, and the El Haweya (Haweya) journey
- **National resources** — history, rankings, contract systems, conference links, and more
- **Assessment** — quizzes and exams with automatic grading and stored scores per member

The name reflects the platform’s purpose: **Learn · Lead · IMPACT**. Members use one trusted site instead of scattered Drive folders, forms, and legacy HTML pages.

IMPACT is built on **Django** (Python). The public marketing experience from the original static site is preserved in templates and static assets, while academies, login, quizzes, and scores run on a proper backend with a database.

---

## Who IMPACT is for

| Audience | What they use IMPACT for |
|----------|--------------------------|
| **Active AIESEC in Egypt members** | Log in with EXPA, access their function academy, take mandatory quizzes, complete the Haweya test |
| **Academy / function leads** | Add materials, session videos, and quizzes via the hidden manage portal |
| **MC / IM / national team** | Django admin, member roster sync, home promos, attempt history, Haweya export to Sheets |
| **Anyone (public)** | Home page, national history, membership ranking, contract submission links, ICX APDs |

Only **authenticated, eligible** members can open functional academies and the Dreaming process. Marketing and utility pages stay public.

---

## The site at a glance

```
impact.aiesec.org.eg
│
├── /                          Home (public; also EXPA OAuth callback)
├── /history/                  AIESEC in Egypt history (public)
├── /membership-ranking/       Membership ranking (public)
├── /icx-apds-submissions/     ICX APD submissions (public)
├── /b2b-contracts/            B2B contracts (public)
├── /presentation/             Presentation page (public)
│
├── /accounts/login/           EXPA login
├── /accounts/logout/          Sign out
│
├── /dreaming/                 Dreaming process (login required)
├── /academy/                  Academy chooser (login required)
├── /academy/<key>/            Function academy page (login required)
├── /academy/<key>/exam/<id>/  Take a quiz (login required)
│
├── /manage/                   Content manager hub (login + assignment)
├── /manage/<key>/             Per-academy dashboard
│
└── /admin/                    Django admin (staff)
```

Health checks for production: `/health/` and `/health/db/`.

---

## Logging in with EXPA

Members do **not** create a separate IMPACT password. They sign in with their **AIESEC EXPA (GIS)** account.

### Flow

1. Member visits **Login** → redirected to EXPA OAuth authorize
2. After approving, EXPA returns to IMPACT with an authorization code
3. The server (never the browser) exchanges the code for a token and calls the GIS API (`/v2/current_person`)
4. IMPACT checks eligibility (Egypt entity, active position, and optionally member roster)
5. A user record is created or updated; a **LoginEvent** is stored; a session starts
6. Member is redirected to their **functional academy** (e.g. `/academy/ogv/`)

### Security

- OAuth **client secret** lives only on the server (environment variables or admin config)
- Production hides technical error details from users; friendly messages point to support (**Wello** by default)
- Login attempts and profile data can be audited via admin and logs

### Configuration

EXPA settings can come from:

- Environment variables (`EXPA_CLIENT_ID`, `EXPA_CLIENT_SECRET`, `EXPA_REDIRECT_URI`, etc.), or
- **EXPA OAuth configuration** in Django admin (admin row takes precedence when present)

Key settings:

| Setting | Purpose |
|---------|---------|
| `allowed_entities` | Who may log in (default: Egypt) |
| `require_active_member` | Require an active EXPA position |
| `redirect_uri` | Must match the EXPA app registration (site root or `/accounts/expa/callback/`) |

---

## Member roster and academy routing

IMPACT can restrict login to members synced from EXPA’s member positions API (the same approach as the legacy EDM **membership-extract** flow).

When **member roster mode** is enabled (`EXPA_USE_MEMBER_ROSTER=True`, default):

1. MC runs `sync_expa_members` with a GIS API token and Egypt MC `office_id`
2. Active positions are stored in **EXPA member roster**
3. Only EXPA IDs on the roster may log in
4. Each member is mapped to a **functional academy** from their EXPA department/function:

| EXPA function (examples) | Academy key |
|------------------------|-------------|
| OGX / Outgoing Exchange | `ogv` |
| ICX / Incoming Exchange | `igv` |
| OGT / Outgoing Global Talent | `ogt` |
| IGT / Incoming Global Talent | `igt` |
| Marketing / B2C | `b2c` |
| BD / B2B | `b2b`, `bd` |
| TM / MXP / EWA | `tm` |
| Finance / F&L | `fl` |

After login, members land on `/academy/<their-key>/` automatically.

---

## The LMS — learning management system

The **LMS** is the `lms` application inside IMPACT. It is not a separate product; it powers all academy pages, content, and assessments.

### Core concepts

| Concept | Description |
|---------|-------------|
| **Academy** | A learning space — either a functional academy (`ogv`, `b2b`, …) or the Dreaming process (`dreaming`) |
| **Material** | A card linking to Google Slides, Drive, or another resource |
| **Session** | A recorded session with an embedded YouTube or Drive video |
| **Exam / Quiz** | A graded assessment attached to an academy |
| **Question** | A single exam item (single choice, multiple choice, or true/false) |
| **Choice** | An answer option; one or more marked correct |
| **Attempt** | One member submission for an exam; auto-graded with score and pass/fail |
| **Home promo** | A banner on the home page (e.g. Haweya certificate CTA) |

### Data relationships

```
Academy
 ├── Materials (many)
 ├── Sessions (many)
 ├── Exams (many)
 │    └── Questions (many)
 │         └── Choices (many)
 └── Attempts (via Exam → User)
```

Every submitted attempt stores:

- User and **EXPA ID** (stable across logins)
- Score, percentage, pass/fail
- Start and submit timestamps
- Per-question answers (for review when enabled)

---

## Functional academies

IMPACT ships with **nine functional academies**, seeded by `python manage.py seed_lms`:

| Key | Title |
|-----|-------|
| `ogv` | oGV Academy — Outgoing Global Volunteer |
| `igv` | iGV Academy — Incoming Global Volunteer |
| `ogt` | oGT Academy — Outgoing Global Talent / Teacher |
| `igt` | iGT Academy — Incoming Global Talent / Teacher |
| `b2c` | B2C Academy — Business to Customer |
| `b2b` | B2B Academy — Business to Business |
| `bd` | BD Academy — Business Development |
| `tm` | TM Academy — Talent Management |
| `fl` | F&L Academy — Finance & Legal |

Each academy page (`/academy/<key>/`) shows:

- Hero themed by function (colors and branding)
- **Materials** grouped by section (e.g. Consideration, IRs)
- **Session videos** in an embed-friendly layout
- **Quizzes & exams** with pass marks, mandatory badges, and the member’s best score if they already attempted

Academies require login. Unauthenticated visitors are sent to EXPA login with a return URL.

---

## Materials and session videos

### Materials

Content managers add **materials** as cards on the academy page. Each material can have:

- Title, subtitle, section group
- Card image (upload or static path)
- **URL** — Google Slides, Drive folder, or external link
- Optional legacy PDF reference

Cards open the linked resource in a new tab. Drive and Slides links can be embedded where appropriate.

### Sessions

**Sessions** are video resources:

- Paste a **YouTube** or **Google Drive** video URL
- IMPACT resolves an embed URL automatically
- Members watch inside the academy page layout

Both materials and sessions support ordering, publish/draft, and per-academy organization.

---

## Quizzes and exams

### Exam types

| Kind | Use case |
|------|----------|
| `exam` | Standard academy quiz or exam |
| `knowledge_quiz` | Dreaming / certificate-style knowledge tests |

### Exam settings

| Setting | What it does |
|---------|----------------|
| **Pass mark** | Minimum percentage to pass (default 60%) |
| **Time limit** | Minutes per attempt (0 = unlimited) |
| **Max attempts** | Cap retries (0 = unlimited) |
| **Questions per attempt** | Random subset from the bank (e.g. 15 of 30) |
| **Shuffle questions** | Randomize order each attempt |
| **Show correct answers after pass** | Review screen with right/wrong answers |
| **Mandatory** | Required for all layers, or specific layers (TM, LCVP, MM, …) |
| **Published** | Visible on the live academy page |

### Taking a quiz

1. Member opens **Start** on the academy page
2. Questions load (random subset if configured)
3. Member submits answers
4. IMPACT grades automatically
5. Result page shows percentage, pass/fail, and optional answer review

Attempts are tied to **EXPA ID** so scores persist even if the member’s Django user record changes.

### Question types

- **Single choice** — one correct answer
- **Multiple choice** — one or more correct answers (all must match to earn points)
- **True / false** — implemented as single choice

Points are configurable per question. Total score and percentage are computed on submit.

---

## Dreaming process and the Haweya certificate

The **Dreaming process** is a separate academy (`key=dreaming`, `kind=dreaming`). It covers AIESEC culture, identity, and El Haweya — not a product function like oGV.

### Dreaming page

`/dreaming/` is a rich, narrative page (team, values, process steps). It requires login like functional academies.

### Haweya knowledge test

The flagship assessment is **AIESEC in Egypt History & Identity Assessment** (seeded by `seed_dreaming_history_quiz`):

- **30 questions** in the bank
- **15 questions per attempt** (randomly selected)
- **60% pass mark** to earn the certificate path
- Published as a `knowledge_quiz` on the Dreaming academy

The home page can promote this via **Home promos** (admin): e.g. *“Obtain your Haweya certificate now”* with a button straight into the quiz.

### Who manages Dreaming content

- **Site admins** (staff) can open the Haweya quiz in `/manage/` under *Dreaming — Haweya certificate quiz*
- Functional academy content managers do **not** get Dreaming manage access by default
- All exam configuration remains available in **Django admin**

---

## The manage portal

The manage portal is a **hidden** UI at `/manage/`. It is not linked from the public navbar. Academy leads bookmark it after being assigned.

### Who can access

| User | Access |
|------|--------|
| **Site admin** (staff/superuser) | All functional academies + Dreaming Haweya quiz |
| **Academy content manager** | Only academies where their EXPA ID is assigned |

Assignment is done in admin: **Academy content managers** — link an EXPA person ID to an academy key.

### What managers can do

Per academy (`/manage/<key>/`):

- **Dashboard** — overview of materials, sessions, and exams
- **Materials** — create, edit, delete learning cards
- **Sessions** — add/edit video sessions
- **Exams** — two-step quiz builder:
  1. **Quiz settings** — title, pass mark, publish, advanced options
  2. **Questions** — inline question form + question bank table

### Quiz builder highlights

- Add questions with multiple choice rows without leaving the page
- **Members who answered** table on the questions step: name, EXPA ID, email, best %, pass/fail, last submitted, attempt count
- Preview link to the live quiz when published

Managers must log in with EXPA (same as members). If their EXPA ID is not assigned, they see a message to contact **Wello**.

---

## Django admin

`/admin/` is the full back-office for MC and IM.

### Main areas

| Model | Purpose |
|-------|---------|
| **Academies** | Create/edit academies; inline materials, sessions, exams |
| **Academy content managers** | Assign `/manage/` access by EXPA ID |
| **Materials / Sessions** | Standalone editing |
| **Exams / Questions / Choices** | Full quiz authoring |
| **Attempts** | Read-only attempt history with answers |
| **Home promos** | Home page banners |
| **EXPA OAuth configuration** | Live OAuth credentials |
| **EXPA member sync configuration** | GIS token + office for roster sync |
| **EXPA member roster** | Synced members and academy mapping |
| **Users / Login events** | Who logged in and when |

### Exam admin — respondents block

On each **Exam** change page, a **Respondents** section lists every member who submitted, with best score and a link to all attempts for that exam. This works for functional quizzes and the Haweya test.

---

## Tracking, reporting, and exports

### Login tracking

Every successful EXPA login creates a **LoginEvent**:

- User, timestamp, IP address, user agent

Combined with `User.profile_json`, `home_mc`, `current_office`, and `last_synced`, MC can analyze active usage.

### Quiz progress

- Per-member best attempts are aggregated by EXPA ID
- Mandatory quiz completion can be evaluated by role layer (TM, LCVP, etc.)
- Admin and manage portal show respondents per exam

### Haweya export API (Google Sheets)

For the Dreaming Haweya quiz, IMPACT exposes a token-protected JSON API:

| Endpoint | Description |
|----------|-------------|
| `GET /api/exports/haweya-respondents/` | All respondents for the Haweya quiz |
| `GET /api/exports/exam-respondents/?exam_id=<id>` | Any exam by ID |

Authentication: `Authorization: Bearer <QUIZ_EXPORT_API_TOKEN>` or `?token=`

The companion **Dreaming_Haweya_Export_Apps_Script.gs** pulls this data into a Google Sheet on demand or on a daily schedule.

---

## Public pages and national tools

These pages do **not** require login:

| Page | Purpose |
|------|---------|
| **Home** | Brand story, academy swiper, promos, video, memory section, photo footer |
| **History** | AIESEC in Egypt national history |
| **Membership ranking** | Ranking display and tooling |
| **ICX APDs** | Submission flow (Apps Script backend) |
| **B2B contracts** | Contract submission |
| **Presentation** | Academy presentation asset |

The navbar also links to external **Contracts** and **Conferences** (Google Drive folders) and internal tools where configured.

---

## Roles and permissions

| Role | Capabilities |
|------|----------------|
| **Anonymous visitor** | Public pages only |
| **Member** | Login, academies, Dreaming, take quizzes |
| **Content manager** | `/manage/<assigned-academy>/` |
| **Staff / superuser** | Django admin, all manage routes, Dreaming Haweya quiz |

There is no separate “teacher” role — managers are EXPA-identified volunteers assigned per academy in admin.

---

## Technical overview

IMPACT is a **Django 6** application deployed with **Gunicorn**, **PostgreSQL**, and **WhiteNoise** for static files.

### Main apps

| App | Responsibility |
|-----|----------------|
| `impact` | Settings, URLs, health checks, error pages |
| `accounts` | Custom user, EXPA OAuth, roster sync, login events |
| `lms` | Academies, content, exams, manage portal, export API |

### Notable commands

```bash
python manage.py seed_lms                    # Academies + Dreaming shell
python manage.py seed_dreaming_history_quiz  # Haweya 30-question bank
python manage.py seed_home_haweya_promo       # Home page Haweya banner
python manage.py sync_expa_members           # Pull EXPA roster
python manage.py sync_static_assets          # Legacy assets → static/
python manage.py collectstatic               # Production static bundle
```

### Production (Coolify)

- Multi-stage **Docker** image; static files baked at build
- Migrations and optional auto-seed on container start
- Environment-driven secrets (never committed to git)
- See `COOLIFY.md` and `.env.coolify.example` for deployment

---

## Operations and deployment

### First production setup

1. Deploy container with `DJANGO_SECRET_KEY`, `POSTGRES_*`, `EXPA_*`
2. Run release script: migrations, seeds, static
3. Create superuser
4. Configure EXPA OAuth in admin
5. Run `sync_expa_members`
6. Assign content managers per academy
7. Set `QUIZ_EXPORT_API_TOKEN` if using Sheets export

### Content workflow (typical)

1. Academy lead gets EXPA ID added as **content manager**
2. Lead opens `/manage/<key>/`, adds materials and sessions
3. Lead creates quiz → settings → questions → publish
4. Members take quiz from `/academy/<key>/`
5. Lead or MC reviews **Members who answered** in manage or admin
6. Optional: sync Haweya respondents to Google Sheets

### Idempotent seeds

Seed commands are safe to re-run. They update academies and refresh the Haweya question bank when `--replace` is passed.

---

## Support

For access issues, EXPA login problems, or academy manager assignment, members are directed to **Wello** (`SUPPORT_CONTACT_NAME` in production config).

Common member issues:

- **“You are not on the roster”** — MC needs to run `sync_expa_members` or add the member in EXPA
- **“Not assigned as content manager”** — EXPA ID must be added in admin for that academy
- **Quiz session expired** — Re-open the quiz to get a fresh question set (when using per-attempt randomization)

---

## Summary

IMPACT is AIESEC in Egypt’s **single front door** for learning and national digital resources. The LMS inside it gives every function a proper academy with materials, videos, and graded quizzes — while EXPA login, roster sync, and attempt tracking keep the experience secure and measurable.

**Learn · Lead · IMPACT** — [impact.aiesec.org.eg](https://impact.aiesec.org.eg)
