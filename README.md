# RoadWatch

> **CivicTech Hackathon: Improving Transparency and Coordination in Public Works Projects**  
> *Track: CivicTech (IIITDM Kancheepuram 24-hour web hackathon)*

Live Demo: [RoadWatch on Vercel](https://roadwatch.vercel.app) *(Deployment)*  
Demo Video: Committed under `/demo`

---

## ⚠️ Simulated Data Notice
**All data shown in this application — including departments, projects, complaints, users, and the road network and closures used for routing — is simulated and fictional for the purposes of this hackathon demo.** Unlogged closures, real-world accidents, and live traffic are not known to this system.

---

## The Problem
1. **Residents cannot find out** what a project is, who owns it, or when it ends.
2. **Departments plan separately**, so the same road is repeatedly dug up (water, electricity, sewage, telecom, roads).
3. **Stalled or poor work** has no easy follow-up, accountability, or duplicate management.
4. **Delays happen with no stated reason**, leaving residents and local businesses in the dark.

---

## Our Solution
1. **Transparency for residents**:
   - Roadwork-aware interactive map with status badges and full closure indicators.
   - Public works dashboard with metrics, delay tracking, and a 12-month re-dig counter per road.
   - Complaint filing with GPS auto-locate, duplicate pre-check within 30m, photo upload, and public tracking.
   - **Closure-Aware Route Planner (R10a & R10b)**: Calculates routes that strictly avoid active full closures on the selected travel date, showing avoided closures, detour distance/time costs, and works along the route.
   - Project follows and in-app notifications when status, dates, delays, or progress updates occur.
   - Recomputation of saved routes (R10c) with notifications when closure status changes.
2. **Coordination for authorities**:
   - Conflict detection engine: dry-run clash detection flagging overlaps within 20m and 180 days with High/Medium/Low severity and resolution options (*merge schedules*, *shift dates*, or *proceed with justification*).
   - Mandatory delay reasons: extending a completion date requires a categorised reason (`weather`, `material_shortage`, `utility_clash`, etc.) and note, immediately updating public timelines and notifying followers.
   - Progress updates with photos.
   - Joint project merges (A11) inheriting closure statuses.
   - Multi-department coordination calendar (A8).
3. **Accountability loop & Admin oversight**:
   - Public delay log and re-dig counters.
   - Resident progress verifications (*Work is happening* vs *Not happening*).
   - Immutable, append-only DB-level audit log recording all project changes, clashes, and moderation actions.
   - Department account approval and complaint moderation.

---

## Demo Credentials

All demo accounts use password: `Demo@1234`

| Role | Email | Scope / Department |
| :--- | :--- | :--- |
| **Resident** | `resident@roadwatch.demo` | Public citizen access, route planning, complaint filing & upvoting |
| **Department** | `roads@roadwatch.demo` | Roads Department |
| **Department** | `water@roadwatch.demo` | Water Board |
| **Department** | `electricity@roadwatch.demo` | Electricity Board |
| **Department** | `sewerage@roadwatch.demo` | Sewerage Board |
| **Department** | `telecom@roadwatch.demo` | Telecom Provider |
| **Admin** | `admin@roadwatch.demo` | Moderation, department approvals, audit log viewer |

---

## Roadwork-Aware Routing Engine (v2)

### Approach & Honesty Rules
- **Engine**: Pure Dijkstra algorithm implemented in TypeScript over our seeded road network graph (`road_nodes` and `road_edges`).
- **Closure Avoidance**: When calculating closure-free routes, active `full_closure` edges are removed from the search graph before running Dijkstra. A route only claims to "avoid" a closure when our engine has provenly excluded the blocked edge from the graph.
- **Alternative Routes (R10b)**: Returns up to 3 closure-free routes that differ by at least 20% in edge length.
- **Recomputation of Saved Routes (R10c)**: When a closure is created, delayed, or updated, saved routes are re-evaluated and subscribers receive a `route_update` notification.
- **Limits**:
  - The road network is simulated and simplified (Chennai demo corridor).
  - Evaluated on a daily basis (inclusive end date).
  - Driving-profile only; makes no accessibility, step-free, live-traffic, or fastest-route claims.

---

## Libraries & Third-Party Disclosure

In accordance with hackathon rules, all third-party libraries and APIs used in RoadWatch are disclosed below:
- **Next.js 15 / React**: Full-stack framework (App Router) and UI library.
- **Postgres (`postgres.js`)**: Direct PostgreSQL connection to Supabase pooler (port 6543) for fast database operations and PostGIS queries.
- **Supabase (`@supabase/supabase-js`)**: Supabase Auth (JWT session management) and Supabase Storage (public photo bucket for complaints and updates).
- **PostGIS**: Spatial database extension on PostgreSQL for geometric line matching, snapping, and distance calculations (`ST_DWithin`, `ST_Distance`, `ST_SetSRID`).
- **Leaflet & react-leaflet**: Interactive map rendering and click-to-draw geometry on the frontend.
- **OpenStreetMap**: Map tiles.
- **Tailwind CSS**: Styling and responsive design.
- **date-fns**: Date parsing, differences, and schedule overlap calculations.
- **Vitest & tsx**: Test runner and TypeScript execution tools for integration and unit test suites.
- **Routing Engine**: **0 external libraries or APIs**; built 100% in-house with custom graph and Dijkstra algorithms in TypeScript (`lib/routing.ts`).

---

## Setup & Local Development

### 1. Prerequisites
- Node.js 18+ (tested on Node 20 / 24)
- A Supabase project with PostGIS extension enabled

### 2. Environment Variables
Copy `.env.example` to `.env.local` and fill in your Supabase connection strings:
```bash
cp .env.example .env.local
```
Ensure the following variables are present:
```env
NEXT_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
DATABASE_URL=postgresql://postgres.<ref>:<password>@aws-0-ap-south-1.pooler.supabase.com:6543/postgres
NEXT_PUBLIC_USE_MOCK=false
```

### 3. Database Migration & Seed
Run `db/schema.sql` in the Supabase SQL Editor.
Run `db/seed.sql` in the Supabase SQL Editor to load the simulated road graph, demo projects, and complaints.
Seed demo users with:
```bash
npx tsx --env-file=.env.local db/seed-users.ts
```

### 4. Running the App
```bash
npm install
npm run dev
```
Open [http://localhost:3000](http://localhost:3000).

### 5. Running the Tests
```bash
# Run pure engine unit tests
npx vitest run lib/routing.test.ts

# Run all integration tests against the database
node --env-file=.env.local node_modules/vitest/vitest.mjs run lib/route.integration.test.ts
```
