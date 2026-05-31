# Crowd Source FAQs — SPEC.md

## Concept

**Crowd Source FAQs** is a knowledge platform for the Vicharanashala Internship at IIT Ropar. It combines official FAQs (sourced from samagama.in) with community-driven Q&A and AI-powered insights — creating a single destination for every internship question.

---

## Stack

- **Frontend:** React 18 + Vite, React Router v6, Tailwind CSS v4, Framer Motion, Lucide React, Recharts
- **Backend:** Node.js + Express + sql.js (pure JS SQLite, no native deps)
- **Styling:** Tailwind CSS v4 with custom `@theme` design tokens

---

## Pages

### 1. Home (`/`) — Official FAQ Page
- Hero with animated headline, large search bar, glowing background
- **Two animated popup cards:** "Ask Community" and "Crowd Insights" buttons
- Category filter pills (About, NOC, Timing, Certificate, Work, Attendance, Rosetta, ViBe)
- Search (live filter across questions + answers)
- Two-column layout: FAQ list (left) + sidebar (right)
- Sidebar: Trending FAQs, Community Activity, Stats grid
- Glassmorphism cards with hover lift + glow effects
- Official FAQ badge on each card

### 2. Community Q&A (`/community`)
- Sidebar navigation
- Anonymous question posting (modal form)
- Upvote/downvote system with animated state changes
- Status badges: "Pending Approval" / "FAQ Candidate"
- Filter: All / Pending / Approved
- Real-time vote count updates
- Questions can be promoted to Official FAQ after enough votes + admin approval

### 3. Crowd Insights (`/insights`)
- Modern AI SaaS dashboard layout
- Stat cards: Total Questions, Answers, Answer Rate, Active Users
- Bar chart: Weekly activity (questions + answers by day)
- Pie chart: FAQ distribution by category
- Activity heatmap: Questions by hour/day of week
- Trending topics with progress bars and growth indicators
- AI Weekly Summary panel with gradient background

### 4. FAQ Detail (`/faq/:id`)
- Full official FAQ answer with rich formatting
- Vote + view stats
- Related FAQs in category
- Save and Share buttons

---

## Design System

### Colors
```
Deep:        #070710   (background)
Surface:     #0d0d1a   (elevated bg)
Primary:     #00d4ff   (cyan accent)
Secondary:   #a855f7   (purple accent)
Accent:      #00ff88   (green / success)
Warn:        #ff6b6b   (red / danger)
Gold:        #fbbf24   (gold / best answer)
```

### Typography
- Headings: **Outfit** (Google Fonts)
- Body: **DM Sans** (Google Fonts)
- Code/Mono: **JetBrains Mono** (Google Fonts)

### Effects
- Glassmorphism: `bg-white/[0.03] backdrop-blur-xl border border-white/[0.08]`
- Background grid: 60px CSS grid lines overlay
- Ambient glows: radial gradients from primary/secondary at key positions
- Hover lift: `translateY(-2px)` + border brightening
- Staggered fade-in animations via Framer Motion

---

## Components

| Component | Description |
|---|---|
| `Layout` | Full-page shell with Navbar + Sidebar + Outlet + FloatingAssistant |
| `Navbar` | Sticky, blurred on scroll, logo, nav links, search, CTA |
| `Sidebar` | Fixed left nav with icons + quick links + Vicharanashala badge |
| `FloatingAssistant` | Fixed bottom-right Yaksha chat bot with quick presets |
| `HomePage` | Hero, search, category filters, FAQ feed, sidebar |
| `CommunityPage` | Question feed with voting, ask modal, status filters |
| `InsightsPage` | Charts, heatmap, stats, AI summary |
| `FAQDetailPage` | Full answer view with related FAQs |

---

## Reference Content

All official FAQs sourced from [samagama.in](https://samagama.in) and [samagama.in/internship/faq](https://samagama.in/internship/faq) — Vicharanashala Internship at IIT Ropar.

Categories covered: About, NOC, Timing, Certificate, Work, Attendance, Rosetta, ViBe.

---

_Last updated: 2026-05-28_