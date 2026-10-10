# P3 handoff: what is built and where

| ID | Feature | File |
|----|---------|------|
| A1 | Login, role routing, department guard | `app/login/page.tsx`, `lib/auth.tsx`, `components/dept/RequireRole.tsx`, `DeptShell.tsx` |
| A2 | Add work form + map drawing | `app/dept/projects/new/page.tsx`, `components/dept/ProjectForm.tsx`, `MapDrawer.tsx` |
| A2/A5 (v2) | Traffic impact field (none / lane restriction / full closure) with helper text | `ProjectForm.tsx`, `app/dept/projects/[id]/page.tsx`, `ClosureBadge` in `ui.tsx` |
| A3 | Conflict warning UI (merge / shift / justify) | `components/dept/ConflictPanel.tsx`, `useConflicts.ts` |
| A4 | Delay modal with mandatory reason | `components/dept/DelayModal.tsx` |
| A5 | Edit project, change status | `app/dept/projects/[id]/page.tsx` |
| A6 | Progress updates with photo | same page, `UpdatesCard` |
| A7 | Complaint management panel | `app/dept/complaints/page.tsx` |
| A8 | Coordination calendar (Gantt) | `app/dept/calendar/page.tsx` |
| A9 / A10 | Admin panel + audit log viewer | `app/admin/page.tsx` |
| A11 | Merge or cancel project | project page, `MergeCard` and `StatusCard` |
| X3 / X4 | 390 px layouts, loading, empty and error states | all pages, `components/dept/ui.tsx` |

Mock logins (password `demo1234`): water@demo.in, electricity@demo.in, roads@demo.in, sewerage@demo.in, telecom@demo.in (unapproved), admin@demo.in, resident@demo.in.

Demo story with mock data (the Anna Salai pipeline is now a Full closure): sign in as electricity@demo.in, Add work, pick Anna Salai, start 2026-11-01, end 2026-12-15 -> High clash with the Water Board pipeline. Choose Shift my dates, save. Then sign in as water@demo.in, open the pipeline, Extend end date.

Not done by me (yours): GitHub repo, Vercel deploy, README, demo video, submission.

v2 README items for you (X6): routing limits from section 6.3, and the disclosure line that routing adds no external library or API. P3 builds no routing code; the planner is P2 and the engine is P1.
