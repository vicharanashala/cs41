# cs41 - Crowd Source FAQs

Community-driven Q&A platform for internship seekers.

## Features

- Ask and browse FAQs
- Community-driven question and answer platform
- AI-powered FAQ assistance
- Search and FAQ recommendations
- Insights and leaderboard pages
- React + Vite frontend
- Node.js backend with database support

## Project Structure

```text
client/     -> React frontend
server/     -> Node.js backend
research/   -> Research files and datasets
```

## Quick Start

### Backend

```bash
cd server
npm install
npm run seed
npm run dev
```

Backend runs on:

```text
http://localhost:3001
```

### Frontend

```bash
cd client
npm install
npm run dev
```

Frontend runs on:

```text
http://localhost:5173
```


## Demo Accounts

All demo users have password: `demo1234`

- priya@university.edu
- rahul@institute.edu
- sneha@college.org
- arjun@tech.edu
- zara@university.edu

## Faculty Dashboard

Access the faculty dashboard at: http://localhost:5173/faculty

Faculty account:

- **Email:** `probe@faculty.test`
- **Password:** `faculty`

> Note: This account was created via direct DB upgrade from the `intern` role. After each server restart, the `probe@faculty.test` role reset is persisted in the SQLite DB file (`server/db/faqs.db`), so it survives server restarts.

### Faculty Modules Implemented

| # | Module | Status |
|---|--------|--------|
| 1 | Dashboard — KPI cards, AI stats, recent activity | ✅ PASS |
| 2 | Review Queue — pending questions with approve/reject | ✅ PASS |
| 3 | Question Review — per-question detail + approve/reject | ✅ PASS |
| 4 | Moderation — flag queue, resolve actions, stats | ✅ PASS |
| 5 | Student SP Management — ledger, watchlist, anomalies, adjust, freeze | ✅ PASS |
| 6 | Tags Management — create, list, delete tags | ✅ PASS |
| 7 | Audit Log — user action history | ✅ PASS |
| 8 | Analytics — KPI, FAQ daily/monthly charts, status breakdown, throughput, moderation summary, SP distribution + leaderboard | ✅ PASS |
| 9 | Settings — threshold, workflow, moderation, SP rules, quality gates, notifications, faculty role management | ✅ PASS |

### Backend Routes Summary

- `server/routes/faculty.js` — 48 faculty endpoints
- `server/routes/analytics.js` — 11 analytics endpoints (new router)
- `server/routes/settings.js` — 5 settings endpoints (new router)
- **Total: 64 faculty API endpoints**

### Bugs Fixed During Implementation

| Bug | Fix | File |
|-----|-----|------|
| `sp_points` column doesn't exist (`users` has `reputation`) | 25 occurrences → `u.reputation` | `server/routes/faculty.js` |
| `flag_type` column doesn't exist (`content_flags` has `reason`) | → `reason as flag_type`; `reporter_id` → `flagged_by` | `server/routes/analytics.js` |
| `sw.id` in `sp_watchlist` (no `id` column) | → removed `sw.id` from SELECT | `server/routes/faculty.js` |
| `upsert()` throws `UNIQUE constraint failed` → crashes `analytics/refresh` | wrapped INSERT in try/catch | `server/routes/analytics.js` |
| `navItems` at module scope referencing component state (`openFlags`, `spBadges`) | Moved `navItems` inside `FacultyLayout` component | `client/src/components/FacultyLayout.jsx` |
| `setFrozen useState('')` missing `=` operator | → `const [frozen, setFrozen] = useState('')` | `client/src/pages/faculty/StudentManagementPage.jsx` |
| ExportModal `onClick` handler JSX syntax error (`}); }` wrong order) | Fixed to `})}` | `client/src/pages/faculty/StudentManagementPage.jsx` |

## Tech Stack

- React
- Vite
- Tailwind CSS
- Node.js
- Express
- SQLite
- JavaScript

## Repository

This repository contains the Crowd Source FAQs platform developed as part of the Vicharanashala internship project.

## License

Refer to the LICENSE file included in this repository.