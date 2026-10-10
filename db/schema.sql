create extension if not exists postgis;

create type user_role as enum ('resident','department','admin');
create type project_status as enum ('planned','ongoing','delayed','completed','cancelled');
create type closure_type as enum ('none','lane_restriction','full_closure');
create type delay_reason as enum ('weather','material_shortage','permit_pending','utility_clash','funds','contractor_issue','other');
create type complaint_category as enum ('pothole','unfinished_work','no_barricade','debris','other');
create type complaint_status as enum ('submitted','acknowledged','in_progress','resolved');
create type conflict_severity as enum ('high','medium','low');
create type conflict_decision as enum ('merge_schedules','shift_dates','proceed_with_justification');
create type verification_value as enum ('happening','not_happening');
create type notification_type as enum ('status_change','date_change','delay','update','complaint_response','route_update');

create table departments (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  color text not null default '#2563eb',
  approved boolean not null default false
);

create table users (
  id uuid primary key references auth.users(id),
  email text not null,
  full_name text,
  role user_role not null default 'resident',
  department_id uuid references departments(id),
  created_at timestamptz not null default now()
);

create table roads (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  ward text,
  geom geometry(LineString, 4326)
);

create table road_nodes (
  id uuid primary key default gen_random_uuid(),
  label text,
  geom geometry(Point, 4326) not null
);
create index road_nodes_geom_idx on road_nodes using gist (geom);

create table road_edges (
  id uuid primary key default gen_random_uuid(),
  road_id uuid references roads(id),
  from_node uuid not null references road_nodes(id),
  to_node uuid not null references road_nodes(id),
  geom geometry(LineString, 4326) not null,
  length_m numeric not null,
  speed_kmph numeric not null default 25,
  oneway boolean not null default false
);
create index road_edges_geom_idx on road_edges using gist (geom);
create index road_edges_from_idx on road_edges (from_node);
create index road_edges_to_idx on road_edges (to_node);

create table projects (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  purpose text,
  department_id uuid not null references departments(id),
  contractor text,
  status project_status not null default 'planned',
  closure_type closure_type not null default 'none',
  start_date date not null,
  end_date date not null,
  original_end_date date not null,
  budget numeric,
  road_id uuid references roads(id),
  geom geometry(LineString, 4326) not null,
  merged_into_id uuid references projects(id),
  created_by uuid references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date >= start_date)
);
create index projects_geom_idx on projects using gist (geom);
create index projects_dates_idx on projects (start_date, end_date);
create index projects_closure_idx on projects (closure_type) where closure_type = 'full_closure';

create table project_updates (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  author_id uuid references users(id),
  note text not null,
  photo_url text,
  created_at timestamptz not null default now()
);

create table delays (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  old_end_date date not null,
  new_end_date date not null,
  reason_category delay_reason not null,
  note text,
  created_by uuid references users(id),
  created_at timestamptz not null default now(),
  check (new_end_date > old_end_date)
);

create table conflict_resolutions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  conflicting_project_id uuid not null references projects(id),
  severity conflict_severity not null,
  decision conflict_decision not null,
  justification text,
  decided_by uuid references users(id),
  decided_at timestamptz not null default now()
);

create table complaints (
  id uuid primary key default gen_random_uuid(),
  tracking_id text not null unique,
  category complaint_category not null,
  description text,
  photo_url text,
  lat double precision not null,
  lng double precision not null,
  geom geometry(Point, 4326) not null,
  project_id uuid references projects(id),
  reporter_id uuid references users(id),
  contact text,
  status complaint_status not null default 'submitted',
  response text,
  upvotes integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index complaints_geom_idx on complaints using gist (geom);

create table complaint_upvotes (
  complaint_id uuid references complaints(id) on delete cascade,
  user_id uuid references users(id),
  primary key (complaint_id, user_id)
);

create table follows (
  user_id uuid references users(id),
  project_id uuid references projects(id) on delete cascade,
  primary key (user_id, project_id)
);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id),
  project_id uuid references projects(id) on delete cascade,
  type notification_type not null,
  message text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create table verifications (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  user_id uuid references users(id),
  value verification_value not null,
  photo_url text,
  created_at timestamptz not null default now()
);

create table audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references users(id),
  action text not null,
  entity text not null,
  entity_id uuid,
  details jsonb,
  created_at timestamptz not null default now()
);

-- append-only trigger on audit_log
create or replace function block_audit_changes() returns trigger language plpgsql as $$
begin raise exception 'audit_log is append-only'; end $$;
drop trigger if exists audit_no_update on audit_log;
create trigger audit_no_update before update or delete on audit_log
for each row execute function block_audit_changes();

create table saved_routes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id),
  name text,
  origin_lat double precision not null,
  origin_lng double precision not null,
  dest_lat double precision not null,
  dest_lng double precision not null,
  travel_date date,
  last_edge_ids uuid[],
  last_checked_at timestamptz,
  created_at timestamptz not null default now()
);

-- signup trigger: every new auth user becomes a resident
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.users (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

-- RLS on, no policies: the browser can't read tables directly.
do $$ declare t text; begin
  for t in select unnest(array['departments','users','roads','projects','project_updates','delays',
    'conflict_resolutions','complaints','complaint_upvotes','follows','notifications','verifications','audit_log','road_nodes','road_edges','saved_routes'])
  loop execute format('alter table public.%I enable row level security', t); end loop;
end $$;