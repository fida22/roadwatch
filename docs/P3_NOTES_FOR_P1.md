# P3 screens: what they need from P1

All P3 screens run on `lib/mock/p3-fallbacks.ts` while `NEXT_PUBLIC_USE_MOCK=true`.
As each real endpoint goes live, add a line like `"GET /api/projects"` to `LIVE_ENDPOINTS` in that file.
Set `NEXT_PUBLIC_USE_MOCK=false` before submission.

## Things the doc does not spell out (please confirm or adjust, then tell P3)

1. **GET /api/roads** (new, public): `[{ id, name, ward, geojson: LineString }]`. Needed for the road dropdown in Add work (A2).
2. **resolutions[] item shape**, sent with POST /api/projects and POST /api/projects/:id/delays:
   `{ conflicting_project_id, severity, decision, justification? }`.
   Server re-runs the check and returns 409 CONFLICT_UNRESOLVED with `conflicts[]` if any clash has no matching resolution
   or a justification under 20 characters. Write each resolution to `conflict_resolutions` and `audit_log`.
3. **POST /api/projects/check-conflicts** returns `{ "conflicts": [...] }`.
4. **Auth header**: every call sends `Authorization: Bearer <supabase access token>` (see `lib/api.ts`).
5. **RLS**: a signed-in user must be able to read their own `users` row and its `departments` row (`lib/auth.tsx`).
6. **GET /api/projects** accepts `department_id` (used by the department home page).
7. **PATCH /api/projects/:id** with `status: "cancelled"` also receives `note` (the cancellation reason, required). Dates are rejected here.
8. **POST /api/projects/:id/updates** is multipart: `note`, optional `photo`.
9. **PATCH /api/complaints/:id** also accepts `project_id` (assign or unlink), as A7 requires. Returns the updated complaint.
10. **GET /api/departments?include_pending=true** (admin only) returns unapproved departments too, with `approved`.
11. **GET /api/audit-log** items: `{ id, actor_name, action, entity, entity_id, details, created_at }` (actor_name = joined users.full_name or email).
12. **GET /api/projects/:id** extra fields used: `purpose, budget, original_end_date, updates[], delays[], redig_count, follower_count, verifications{happening,not_happening}`.
13. **GET /api/dept/calendar** items are project summaries (must include `road_id`, used to flag overlaps).
14. **A project summary needs `department.id`** so the edit page can tell whether a project belongs to the signed-in department.

## Library lines to add to the README disclosure list
Next.js, React, Tailwind CSS, Supabase (supabase-js), date-fns, Leaflet, react-leaflet, OpenStreetMap tiles, IBM Plex Sans (Google Fonts via next/font).
leaflet-draw is NOT used: drawing is click-to-add points (allowed by the doc).

## v2 additions (traffic impact / closure_type)
15. **POST /api/projects** and **PATCH /api/projects/:id** receive `closure_type` (`none | lane_restriction | full_closure`, default `none`).
    Please write an `audit_log` entry when it changes (action `project.closure_type`, details `{from, to}`), as the v2 doc requires.
16. **GET /api/projects, /api/projects/:id and /api/dept/calendar** must return `closure_type` on every project (the UI shows a "Closed" badge).
17. A4 / A5 side-effects are server-side: extending a full closure moves the blocked window, and completing or cancelling lifts it.
    P3 only shows a note explaining this; it does not call any routing endpoint.
18. Conflict detection is unchanged and independent of `closure_type`.
