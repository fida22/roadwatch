# RoadWatch

**Public works, made transparent.** Departments log road projects, the system catches clashes between them, and residents track work, plan routes around closures and file complaints.

CivicTech Hackathon · IIITDM Kancheepuram

**Live demo:** https://roadwatch-swart.vercel.app · **Demo video:** _TODO: add to `/demo`_

> ⚠️ All data (departments, projects, complaints, users, road network, closures) is **simulated** for this hackathon demo. Not for real navigation.

## Features

**Residents**
- Map of ongoing and planned works, colour-coded by status, with a closures-only filter
- Dashboard: active and delayed projects, average delay, open complaints, most-dug roads (12-month re-dig counter)
- Route planner that avoids full closures active on the chosen date, shows the detour cost and works along the route
- Saved routes, re-checked automatically when closures change
- Complaints with GPS location, photo, duplicate check and public tracking ID
- Follow projects, get notifications, verify whether work is really happening

**Departments and admin**
- Add and edit projects with traffic impact (none / lane restriction / full closure)
- Conflict warning when work clashes with another project, with merge / shift dates / justify options
- Mandatory reason for every delay
- Merge or cancel projects, coordination calendar, complaint panel
- Admin: approve departments, moderate complaints, audit log

## What's novel

- **Closure-aware routing with our own engine.** Dijkstra in TypeScript (`lib/routing.ts`) removes closed road segments from the graph *before* searching, so "avoids this closure" is guaranteed, not guessed. No external routing API.
- **Clash detection.** PostGIS finds projects within 20 m and 180 days of each other, with High / Medium / Low severity.
- **Accountability loop.** Mandatory delay reasons, public delay history, re-dig counter, and an append-only audit log (a database trigger blocks updates and deletes).

## Tech stack

Next.js 15 · React 19 · TypeScript · Tailwind CSS · Supabase (Postgres + PostGIS, Auth, Storage) · postgres.js · Leaflet + react-leaflet · OpenStreetMap tiles · date-fns · Vitest · Vercel

Routing uses no external library or API.

## Run it

**Quick start (mock mode, no database needed)**

```bash
git clone https://github.com/fida22/roadwatch.git
cd roadwatch
npm install
npm run dev
```

Open http://localhost:3000 and sign in with `roads@demo.in` / `demo1234` (also `water@`, `electricity@`, `sewerage@`, `admin@`, `resident@` + `demo.in`).

Mock mode uses built-in sample data and nothing is saved. The route planner shows one fixed sample route instead of running the engine.

**Full mode (real database and routing engine)**

1. Create a Supabase project, then `cp .env.example .env.local` and fill in the keys. Set `NEXT_PUBLIC_USE_MOCK=false`.
2. In the Supabase SQL Editor run `db/schema.sql`, then this, then `db/seed.sql`:
   ```sql
   create policy "read own user row" on public.users for select to authenticated using (id = auth.uid());
   create policy "read departments" on public.departments for select to authenticated using (true);
   ```
3. In Supabase Storage create a public bucket named `photos`.
4. Create the demo users: `npx tsx --env-file=.env.local db/seed-users.ts`
5. `npm run dev`, then sign in with `roads@roadwatch.demo` / `Demo@1234` (also `water@`, `electricity@`, `sewerage@`, `telecom@`, `admin@`, `resident@` + `roadwatch.demo`).

**Tests:** `npm test`

**Deploy:** import the repo in Vercel, add the same environment variables, and redeploy after changing any `NEXT_PUBLIC_*` value.


