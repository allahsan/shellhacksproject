🛠 TeamDock – Complete Builder Plan (Updated)
Vision

TeamDock solves the biggest hackathon pain: team formation chaos. Instead of wasting hours figuring out who needs what, participants create/join teams instantly, roles update live, and organizers see traction during the event.

Phase 0 — Prep

Goals

Repo on GitHub, deploy target Vercel.

Create Supabase project (backend DB + realtime).

Lock MVP scope:

No OAuth/SSO.

No file uploads.

No complex chat.

Yes to realtime roles, flexible roles, member statuses, notifications.

Setup

Next.js App Router + TailwindCSS (frontend).

Supabase (DB + RPC + realtime).

Twilio SMS (optional) or WhatsApp deep-links for notifications.

QR code generator for onboarding.

Phase 1 — Day 1 MVP
Core Features

Landing Page

Hero: “Find a team in 5 minutes.”

CTA: View Teams, Create Team.

Teams List

Live feed of teams + open roles.

Filter by preset role (FE/BE/Designer/etc.) or free-text search.

Cards show: team name, summary, tags, open slots.

Create Team

Form: team name, 140-char summary, tags, owner name/contact.

Add roles: pick from preset list or type custom roles.

Each becomes a role slot.

Join Team

Tap role → enter name + contact → claim role.

Atomic check to prevent two people from grabbing same slot.

Success triggers:

Role slot updates to filled.

Confetti effect.

Owner notification (WhatsApp or SMS).

Member Status

Each filled role slot has a status (Available, Busy, Break, Offline).

Status is only visible to teammates, not public.

Defaults to “Available.”

Quick toggle via dropdown or emoji.

Realtime updates: teammates see instantly.

Backend (Supabase)

Tables

teams: id, name, summary, tags, owner_name, owner_contact, status (recruiting/closed).

role_slots: id, team_id, role_label (preset/custom), is_filled, filled_by_name, filled_by_contact, member_status.

joins_audit (optional for adoption metrics).

RPC

claim_role(slot_id, name, contact) → atomic join.

Realtime

Stream changes to teams and role_slots.

API Endpoints

POST /api/team → create team + slots.

GET /api/teams → list teams (filter by role/status).

POST /api/team/:id/role/:slotId/join → join role.

POST /api/team/:id/toggle → recruiting/closed.

PATCH /api/team/:id/member/:slotId/status → update member status.

Phase 2 — Polish for Demo
UX Polish

Recruiting teams glow visually.

Emoji badges on role chips (🖥 FE, ⚙️ BE, 🎨 Designer, 🎤 Presenter, ☕ Break, etc.).

Empty states: “No teams yet. Be the first.”

One-click “Copy Invite Link.”

QR panel for organizers.

Metrics Panel (for pitch)

Total teams created.

Total roles filled.

Breakdown of open roles by type.

Status counts (how many on break, busy, etc.).

Phase 3 — Gamification

Confetti burst when joining a role.

Live “recent activity” feed: “Team Phoenix filled Designer role.”

“Hot roles” counter: shows most in-demand skill.

First 50 teams badge.

Easter eggs (funny messages for quirky team names).

Phase 4 — Organizer Mode (Stretch)

Dashboard: see all recruiting teams, open roles.

CSV export for sponsors.

Big screen mode: auto-scroll through live teams.

Sponsor tags: filter by sponsor tech used.

Phase 5 — Post-Hackathon Scale

Turn on RLS (secure rows).

Light auth (magic link).

Rate limits.

Advanced notifications (Twilio verified sender).

Analytics with MotherDuck or PostHog.