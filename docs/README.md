# NeuroBoost v0.1.1 (MVP)

Calendar‑first personal assistant. **Single‑user**. Postgres 16 (UTC source of truth). UI & scheduler aligned to **Europe/Moscow**. Obsidian export is **dry‑run only** in this build.

---

## Stack

* Node **20.15**  · pnpm **10.14**
* Express 4 · Prisma **6.0** · Postgres **16**
* React 18 + Vite 5 + Tailwind 3
* Electron shell (Windows) · Telegraf route **stub**

---

## Quick start (Windows, PowerShell)

```powershell
pnpm -v                 # 10.14.x
pnpm install
pnpm approve-builds     # allow esbuild if prompted

# API (http://localhost:3001)
$env:NB_ROUTE_PRIMARY="telegram-stub"
pnpm -F @nb/api dev

# Web (http://localhost:5173)
pnpm -F @nb/web dev

# Shell (optional native notifications)
$env:NB_ROUTE_PRIMARY="shell"
# optional: quiet hours in MSK — e.g. 23:00-08:00
$env:NB_QUIET="23:00-08:00"
pnpm -F @nb/shell dev
```

> DB: Postgres 16 on **port 5433**, UTC timezone.

---

## Features in this MVP

* Week grid (Mon–Sun) with hourly tracks (MSK) and current‑time red line
* Create via drag (editor on mouse‑up), move, resize (15‑min snap)
* Keyboard: `+`/`-` nudge ±15m, `Enter` edit, `Del` delete (confirm)
* Nudges status in header (route, dedupe, planner time)
* Export endpoint is **dry‑run** and confined to `NeuroBoost/` path (no deletions)

---

## API

Base URL: `http://localhost:3001`

### Events

* `GET /events?start=ISO&end=ISO` → expanded **occurrences** (UTC ISO)
* `POST /events` → create

  ```json
  { "title":"...", "startsAt":"ISO", "endsAt":"ISO", "allDay":false, "rrule":"FREQ=WEEKLY;COUNT=4" }
  ```
* `PATCH /events/:id` → move/resize; may also patch `title` and `rrule`

  ```json
  { "startsAt":"ISO", "endsAt":"ISO", "title":"..", "rrule":null }
  ```
* `DELETE /events/:id` → delete (MVP explicit cascade)

### Status / Export / Health

* `GET /status/nudges`
* `GET /export/dry-run` — preview planned files; never writes
* `GET /healthz/db` — DB ping

---

## Safety & Privacy

* Export is **dry‑run** and writes would be confined to `NeuroBoost/` should they be enabled later.
* No telemetry. Single‑user VPS model.

---

## Conventions

* Store all times in **UTC**; UI & scheduling in **Europe/Moscow**.
* Obsidian export tags: `#neuroboost` and `#calendar`.
* Settings split: **General** vs **Developer** (destructive toggles disabled in MVP).

---

## Repo layout

```
apps/
  api/     # Express + Prisma
  web/     # React + Vite + Tailwind
  shell/   # Electron wrapper (Windows)
```

---

## Version

* This README reflects **v0.1.1**.
