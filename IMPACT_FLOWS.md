# IMPACT — Flowcharts

Visual maps of how members, managers, and the platform interact. Render these in GitHub, VS Code (Mermaid preview), or [mermaid.live](https://mermaid.live).

---

## 1. Platform overview

```mermaid
flowchart TB
  subgraph public [Public — no login]
    Home["/ — Home"]
    History["/history/"]
    Ranking["/membership-ranking/"]
    Contracts["/b2b-contracts/ · /icx-apds-submissions/"]
  end

  subgraph auth [Authentication]
    Login["/accounts/login/"]
    EXPA["EXPA OAuth"]
  end

  subgraph member [Member — login required]
    Academy["/academy/ogv · igv · …"]
    Dreaming["/dreaming/"]
    Quiz["/academy/…/exam/…"]
    Result["Quiz result + score saved"]
  end

  subgraph ops [Operations]
    Manage["/manage/ — content managers"]
    Admin["/admin/ — MC staff"]
    Sync["sync_expa_members"]
    Export["API → Google Sheets"]
  end

  Visitor((Visitor)) --> Home
  Visitor --> History
  Visitor --> Ranking
  Visitor --> Contracts

  Member((Member)) --> Login
  Login --> EXPA
  EXPA -->|eligible| Academy
  EXPA -->|eligible| Dreaming
  Academy --> Quiz
  Dreaming --> Quiz
  Quiz --> Result

  Manager((Academy lead)) --> Login
  Login --> Manage
  Staff((MC / IM)) --> Admin
  Staff --> Sync
  Staff --> Export
  Sync --> EXPA
  Result --> Export
```

---

## 2. EXPA login flow

```mermaid
flowchart TD
  Start([Member clicks Login]) --> LoginPage["/accounts/login/"]
  LoginPage --> ExpaStart["/accounts/expa/start/"]
  ExpaStart --> ExpaAuth["EXPA authorize screen"]
  ExpaAuth -->|user approves| Callback["Redirect with ?code"]
  Callback --> TokenExchange["Server: code → access token"]
  TokenExchange --> FetchProfile["GIS API: /v2/current_person"]
  FetchProfile --> CheckRoster{Roster mode on?}

  CheckRoster -->|yes| OnRoster{EXPA ID on roster?}
  CheckRoster -->|no| CheckEgypt{Egypt entity + active position?}

  OnRoster -->|no| Denied["Access denied — contact Wello"]
  OnRoster -->|yes| MapAcademy["Map function → academy key"]

  CheckEgypt -->|no| Denied
  CheckEgypt -->|yes| MapAcademy

  MapAcademy --> UpsertUser["Create / update User + LoginEvent"]
  UpsertUser --> Session["Start Django session"]
  Session --> Redirect["Redirect to /academy/ogv/ · igv/ · …"]
  Redirect --> Done([Member on their academy])
```

---

## 3. Member takes a quiz

```mermaid
flowchart TD
  Start([Open academy page]) --> PickQuiz["Click Start on a quiz"]
  PickQuiz --> LoggedIn{Logged in?}
  LoggedIn -->|no| Login["EXPA login → return to quiz"]
  Login --> PickQuiz
  LoggedIn -->|yes| CanAttempt{Attempts left?}
  CanAttempt -->|no| MaxMsg["Message: max attempts reached"]
  CanAttempt -->|yes| LoadQuestions["Select questions from bank"]
  LoadQuestions --> StoreSession["Store question IDs in session"]
  StoreSession --> ShowForm["Show quiz form"]
  ShowForm --> Submit["Member submits answers"]
  Submit --> ValidSession{Session IDs valid?}
  ValidSession -->|no| Expired["Session expired — reopen quiz"]
  ValidSession -->|yes| CreateAttempt["Create Attempt + Answers"]
  CreateAttempt --> Grade["Auto-grade: score % pass/fail"]
  Grade --> Save["Save expa_id, submitted_at"]
  Save --> ResultPage["Result page"]
  ResultPage --> Review{Show review?}
  Review -->|failed or setting on| ShowAnswers["Show correct / wrong per question"]
  Review -->|passed + hidden| ScoreOnly["Score only"]
```

---

## 4. Content manager — add a quiz

```mermaid
flowchart TD
  Start([Academy lead]) --> Login["Log in with EXPA"]
  Login --> Assigned{EXPA ID assigned in admin?}
  Assigned -->|no| NoAccess["/manage/ — contact Wello"]
  Assigned -->|yes| Hub["/manage/ → pick academy"]
  Hub --> Dashboard["/manage/ogv/ · b2b/ · …"]

  Dashboard --> NewQuiz["Create new quiz"]
  NewQuiz --> Step1["Step 1: Quiz settings"]
  Step1 --> Title["Title, pass mark, publish"]
  Title --> Step2["Step 2: Questions"]

  Step2 --> AddQ["Add question inline"]
  AddQ --> Choices["Add choices + mark correct"]
  Choices --> MoreQ{More questions?}
  MoreQ -->|yes| AddQ
  MoreQ -->|no| Publish["Publish on quiz settings"]

  Publish --> Live["Quiz appears on /academy/key/"]
  Live --> Respondents["Members who answered table on manage page"]

  Staff([Site admin]) --> DreamingQuiz["/manage/ → Haweya quiz"]
  DreamingQuiz --> Step2
```

---

## 5. Member roster sync

```mermaid
flowchart LR
  subgraph expa [EXPA GIS API]
    GraphQL["memberPositions GraphQL"]
  end

  subgraph server [IMPACT server]
    Cmd["manage.py sync_expa_members"]
    Roster["EXPA member roster table"]
    Mapping["function → academy_key"]
  end

  subgraph login [At login]
    Check["EXPA ID in roster?"]
    Route["Redirect to academy"]
  end

  MC([MC runs command]) --> Cmd
  Cmd --> GraphQL
  GraphQL --> Roster
  Roster --> Mapping

  Member([Member logs in]) --> Check
  Check -->|yes| Route
  Mapping --> Route
```

---

## 6. Haweya certificate path

```mermaid
flowchart TD
  Home([Home page]) --> Promo{Haweya promo published?}
  Promo -->|yes| CTA["Obtain your Haweya certificate now"]
  Promo -->|no| DreamingNav["Navbar → Dreaming"]
  CTA --> QuizStart["AIESEC History & Identity Assessment"]
  DreamingNav --> DreamingPage["/dreaming/"]
  DreamingPage --> QuizStart

  QuizStart --> Login{Logged in?}
  Login -->|no| EXPA["EXPA login"]
  EXPA --> QuizStart
  Login -->|yes| Attempt["15 random questions from bank of 30"]
  Attempt --> Submit["Submit"]
  Submit --> Grade{Score ≥ 60%?}
  Grade -->|yes| Pass["Passed — certificate path complete"]
  Grade -->|no| Retry["Retry if attempts remain"]
  Retry --> Attempt

  Pass --> AdminView["View in /admin/ or /manage/ respondents"]
  AdminView --> Sheets["Apps Script → Google Sheet export"]
```

---

## 7. Deploy and startup (production)

```mermaid
flowchart TD
  Push([Git push main]) --> Coolify["Coolify build Docker image"]
  Coolify --> Static["Build: sync_static_assets + collectstatic"]
  Static --> Runtime["Runtime container starts"]
  Runtime --> Repair["repair_ghost_migrations if needed"]
  Repair --> Migrate["migrate"]
  Migrate --> SeedEmpty{DB empty?}
  SeedEmpty -->|yes| AutoSeed["seed_lms + promos"]
  SeedEmpty -->|no| Gunicorn["Gunicorn :8000"]
  AutoSeed --> Gunicorn
  Gunicorn --> Health["/health/ passes"]
  Health --> Live([impact.aiesec.org.eg live])

  MC([First deploy only]) --> Release["docker-entrypoint.sh release"]
  Release --> Superuser["createsuperuser"]
  Superuser --> SyncMembers["sync_expa_members"]
```

---

## 8. Who sees what

```mermaid
flowchart LR
  subgraph roles [Role]
    V[Visitor]
    M[Member]
    C[Content manager]
    S[Staff / superuser]
  end

  subgraph access [Access]
    P[Public pages]
    A[Academies + Dreaming + quizzes]
    MG["/manage/ assigned academy"]
    AD["/admin/ everything"]
  end

  V --> P
  M --> P
  M --> A
  C --> P
  C --> A
  C --> MG
  S --> P
  S --> A
  S --> MG
  S --> AD
```

---

*See [IMPACT.md](IMPACT.md) for full written documentation.*
