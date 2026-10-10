-- ============================================================
-- RoadWatch seed (db/seed.sql)
-- SIMULATED DATA: all records below are fictional, for a hackathon demo.
-- Run AFTER db/schema.sql. Safe to re-run: it wipes project data first
-- (keeps departments and users).
-- ============================================================

truncate projects, roads, complaints, delays, project_updates, conflict_resolutions,
  notifications, follows, verifications, road_edges, road_nodes cascade;

-- ===== DEPARTMENTS =====
insert into departments (name, color, approved) values
  ('Water Board','#2563eb',true),
  ('Electricity Board','#f59e0b',true),
  ('Roads Department','#16a34a',true),
  ('Sewerage Board','#7c3aed',true),
  ('Telecom Provider','#db2777',true)
on conflict (name) do nothing;

-- ===== ROADS (names only; geometry is built from the graph edges below) =====
insert into roads (name, ward) values
  ('Anna Salai','Ward 112'),
  ('Service Lane (Anna Salai)','Ward 112'),
  ('GST Road','Ward 170'),
  ('Adyar Main Road','Ward 173'),
  ('Velachery Main Road','Ward 178'),
  ('Velachery Lane','Ward 178'),
  ('Mount Poonamallee Road','Ward 155');

-- ===== ROAD GRAPH (simulated, simplified; geometry is lng, lat) =====
-- 20 nodes demo every scenario. The doc asks for 25-40: add connector
-- nodes later, after everything below works.
insert into road_nodes (label, geom) values
  ('Anna Salai Jn 1 (west)', st_setsrid(st_makepoint(80.2610,13.0750),4326)),
  ('Anna Salai Jn 2', st_setsrid(st_makepoint(80.2650,13.0780),4326)),
  ('Anna Salai / Service Lane West', st_setsrid(st_makepoint(80.2680,13.0805),4326)),
  ('Anna Salai / Service Lane East', st_setsrid(st_makepoint(80.2707,13.0827),4326)),
  ('Anna Salai Jn 5', st_setsrid(st_makepoint(80.2750,13.0850),4326)),
  ('Anna Salai Jn 6 (east)', st_setsrid(st_makepoint(80.2800,13.0875),4326)),
  ('Service Lane mid', st_setsrid(st_makepoint(80.2700,13.0795),4326)),
  ('GST Road Jn 1', st_setsrid(st_makepoint(80.1900,12.9900),4326)),
  ('GST Road Jn 2', st_setsrid(st_makepoint(80.2050,13.0000),4326)),
  ('GST Road Jn 3', st_setsrid(st_makepoint(80.2200,13.0100),4326)),
  ('Adyar Main Rd Jn 1', st_setsrid(st_makepoint(80.2500,13.0000),4326)),
  ('Adyar Main Rd Jn 2', st_setsrid(st_makepoint(80.2560,13.0060),4326)),
  ('Velachery Main Rd Jn 1', st_setsrid(st_makepoint(80.2150,12.9780),4326)),
  ('Velachery Main Rd Jn 2', st_setsrid(st_makepoint(80.2200,12.9850),4326)),
  ('Velachery Main Rd Jn 3', st_setsrid(st_makepoint(80.2230,12.9900),4326)),
  ('Velachery Lane Jn', st_setsrid(st_makepoint(80.2240,12.9840),4326)),
  ('Velachery Lane end', st_setsrid(st_makepoint(80.2270,12.9820),4326)),
  ('Mount Poonamallee Jn 1', st_setsrid(st_makepoint(80.1800,13.0300),4326)),
  ('Mount Poonamallee Jn 2', st_setsrid(st_makepoint(80.1850,13.0325),4326)),
  ('Mount Poonamallee Jn 3', st_setsrid(st_makepoint(80.1900,13.0350),4326));

-- edge helper: straight line between two labelled nodes, length from PostGIS
create or replace function seed_edge(a text, b text, rname text, p_oneway boolean default false, p_speed numeric default 25)
returns void language sql as $$
insert into road_edges (road_id, from_node, to_node, geom, length_m, speed_kmph, oneway)
select r.id, na.id, nb.id, g.geom, st_length(g.geom::geography), p_speed, p_oneway
from road_nodes na, road_nodes nb, roads r,
  lateral (select st_setsrid(st_makeline(na.geom, nb.geom), 4326) as geom) g
where na.label = a and nb.label = b and r.name = rname;
$$;

-- Anna Salai spine. The West -> East edge is the one the pipeline closes.
select seed_edge('Anna Salai Jn 1 (west)','Anna Salai Jn 2','Anna Salai');
select seed_edge('Anna Salai Jn 2','Anna Salai / Service Lane West','Anna Salai');
select seed_edge('Anna Salai / Service Lane West','Anna Salai / Service Lane East','Anna Salai');
select seed_edge('Anna Salai / Service Lane East','Anna Salai Jn 5','Anna Salai');
select seed_edge('Anna Salai Jn 5','Anna Salai Jn 6 (east)','Anna Salai');
-- the real detour around the closed edge
select seed_edge('Anna Salai / Service Lane West','Service Lane mid','Service Lane (Anna Salai)');
select seed_edge('Service Lane mid','Anna Salai / Service Lane East','Service Lane (Anna Salai)');
-- other roads
select seed_edge('GST Road Jn 1','GST Road Jn 2','GST Road');
select seed_edge('GST Road Jn 2','GST Road Jn 3','GST Road', true);  -- one-way toward Jn 3
select seed_edge('Adyar Main Rd Jn 1','Adyar Main Rd Jn 2','Adyar Main Road');
select seed_edge('Velachery Main Rd Jn 1','Velachery Main Rd Jn 2','Velachery Main Road');
select seed_edge('Velachery Main Rd Jn 2','Velachery Main Rd Jn 3','Velachery Main Road');
select seed_edge('Velachery Main Rd Jn 2','Velachery Lane Jn','Velachery Lane');
select seed_edge('Velachery Lane Jn','Velachery Lane end','Velachery Lane');
select seed_edge('Mount Poonamallee Jn 1','Mount Poonamallee Jn 2','Mount Poonamallee Road');
select seed_edge('Mount Poonamallee Jn 2','Mount Poonamallee Jn 3','Mount Poonamallee Road');

-- road geometry = merged edges (so the map and the graph agree)
update roads r set geom = (select st_linemerge(st_collect(e.geom)) from road_edges e where e.road_id = r.id)
where exists (select 1 from road_edges e where e.road_id = r.id);

-- ===== PROJECT HELPERS =====
drop function if exists seed_project(text,text,text,text,project_status,int,int,int,closure_type);

-- whole-road project (use ONLY for closure_type 'none': a whole-road closure would block every edge)
create or replace function seed_project(
  p_title text, p_dept text, p_road text, p_contractor text, p_status project_status,
  p_start int, p_end int, p_orig_end int, p_closure closure_type default 'none'
) returns void language sql as $$
insert into projects (title, purpose, department_id, contractor, status, closure_type,
  start_date, end_date, original_end_date, road_id, geom)
select p_title, 'Simulated project', d.id, p_contractor, p_status, p_closure,
  current_date + p_start, current_date + p_end, current_date + p_orig_end, r.id, r.geom
from departments d, roads r where d.name = p_dept and r.name = p_road;
$$;

-- segment project: a short stretch in the MIDDLE of one edge (fractions f1..f2 along it).
-- A closure only blocks edges within 20 m, so it must stay >20 m away from junctions.
create or replace function seed_segment_project(
  p_title text, p_dept text, p_contractor text, p_status project_status, p_closure closure_type,
  p_start date, p_end date, p_orig_end date, node_a text, node_b text, f1 float, f2 float
) returns void language sql as $$
insert into projects (title, purpose, department_id, contractor, status, closure_type,
  start_date, end_date, original_end_date, road_id, geom)
select p_title, 'Simulated project', d.id, p_contractor, p_status, p_closure,
  p_start, p_end, p_orig_end, e.road_id, st_linesubstring(e.geom, f1, f2)
from departments d, road_edges e
join road_nodes na on na.id in (e.from_node, e.to_node) and na.label = node_a
join road_nodes nb on nb.id in (e.from_node, e.to_node) and nb.label = node_b
where d.name = p_dept;
$$;

-- ===== DEMO CLOSURE: water pipeline, full closure, ends 15 Nov 2026 (fixed dates) =====
select seed_segment_project('Water pipeline replacement, Anna Salai','Water Board','ABC Infra','ongoing','full_closure',
  date '2026-10-01', date '2026-11-15', date '2026-11-15',
  'Anna Salai / Service Lane West','Anna Salai / Service Lane East', 0.4, 0.6);

-- AC9: lane restriction ON the detour path (shows under "works along your route", never avoided)
select seed_segment_project('Lane restriction, Service Lane','Roads Department','RoadFix Ltd','ongoing','lane_restriction',
  current_date - 5, current_date + 25, current_date + 25,
  'Anna Salai / Service Lane West','Service Lane mid', 0.3, 0.7);

-- PAIR_NOROUTE: dead-end lane whose only connector is closed
select seed_segment_project('Sewer main works, Velachery Lane','Sewerage Board','CityWorkLink','ongoing','full_closure',
  current_date - 10, current_date + 40, current_date + 40,
  'Velachery Main Rd Jn 2','Velachery Lane Jn', 0.4, 0.6);

-- AC11 lifecycle trio on Mount Poonamallee Road (none of these may block today)
select seed_segment_project('Underground cabling, Mount Poonamallee Road','Electricity Board','VoltLine Co','planned','full_closure',
  current_date + 30, current_date + 60, current_date + 60,
  'Mount Poonamallee Jn 1','Mount Poonamallee Jn 2', 0.4, 0.6);
select seed_segment_project('Resurfacing, Mount Poonamallee Road','Roads Department','RoadFix Ltd','completed','full_closure',
  current_date - 120, current_date - 90, current_date - 90,
  'Mount Poonamallee Jn 2','Mount Poonamallee Jn 3', 0.4, 0.6);
select seed_segment_project('Drain works (cancelled), Mount Poonamallee Road','Sewerage Board','CityWorkLink','cancelled','full_closure',
  current_date - 30, current_date + 10, current_date + 10,
  'Mount Poonamallee Jn 2','Mount Poonamallee Jn 3', 0.7, 0.9);

-- ===== WHOLE-ROAD PROJECTS (closure none) =====
-- DELAYED project (gets 2 delay rows below)
select seed_project('Cable laying, GST Road','Telecom Provider','GST Road','NetBuild Ltd','delayed', -90, 30, -30);

-- ONE ROAD DUG 3x IN 12 MONTHS (Adyar Main Road) -> re-dig counter = 3. Do not add a 4th Adyar project.
select seed_project('Sewer line, Adyar Main Road','Sewerage Board','Adyar Main Road','CityWorkLink','completed', -300, -270, -270);
select seed_project('Power cable, Adyar Main Road','Electricity Board','Adyar Main Road','VoltLine Co','completed', -180, -150, -150);
select seed_project('Water connection, Adyar Main Road','Water Board','Adyar Main Road','ABC Infra','ongoing', -10, 20, 20);

-- COMPLETED project with timeline
select seed_project('Resurfacing, Velachery Main Road','Roads Department','Velachery Main Road','RoadFix Ltd','completed', -150, -100, -100);

-- more projects to fill the map
select seed_project('Drainage upgrade, GST Road','Sewerage Board','GST Road','CityWorkLink','planned', 20, 60, 60);
select seed_project('Street lights, Mount Poonamallee Road','Electricity Board','Mount Poonamallee Road','VoltLine Co','ongoing', -15, 25, 25);
select seed_project('Footpath repair, Anna Salai','Roads Department','Anna Salai','RoadFix Ltd','planned', 45, 75, 75);
select seed_project('Water main upgrade, Velachery Main Road','Water Board','Velachery Main Road','ABC Infra','planned', 60, 100, 100);
select seed_project('Manhole replacement, Velachery Lane','Sewerage Board','Velachery Lane','CityWorkLink','completed', -200, -170, -170);
select seed_project('Telecom ducts, Anna Salai','Telecom Provider','Anna Salai','NetBuild Ltd','completed', -250, -220, -220);
select seed_project('Road marking, GST Road','Roads Department','GST Road','RoadFix Ltd','completed', -120, -100, -100);
select seed_project('Pole shifting, Mount Poonamallee Road','Electricity Board','Mount Poonamallee Road','VoltLine Co','planned', 90, 120, 120);
-- moved off Adyar so the re-dig counter stays at 3
select seed_project('Kerb repair, Service Lane','Roads Department','Service Lane (Anna Salai)','RoadFix Ltd','planned', 30, 50, 50);

-- ===== DELAY HISTORY for the delayed project (weather, then material shortage) =====
insert into delays (project_id, old_end_date, new_end_date, reason_category, note)
select id, current_date - 30, current_date, 'weather', 'Heavy monsoon rains'
from projects where title = 'Cable laying, GST Road';

insert into delays (project_id, old_end_date, new_end_date, reason_category, note)
select id, current_date, current_date + 30, 'material_shortage', 'Cable supply delayed'
from projects where title = 'Cable laying, GST Road';

-- ===== TIMELINE for the completed project =====
insert into project_updates (project_id, note)
select id, 'Milling done, base layer laid' from projects where title like 'Resurfacing, Velachery%';
insert into project_updates (project_id, note)
select id, 'Final surfacing complete, road reopened' from projects where title like 'Resurfacing, Velachery%';

-- ===== COMPLAINTS =====
-- The first pair sits at the middle of the closure, ~20 m apart (duplicate demo).
insert into complaints (tracking_id, category, description, lat, lng, geom, status, response, upvotes) values
  ('RW-DEMO01','pothole','Deep pothole next to pipeline work',13.08160,80.26935, st_setsrid(st_makepoint(80.26935,13.08160),4326),'submitted',null,2),
  ('RW-DEMO02','pothole','Same pothole, other side',13.08178,80.26935, st_setsrid(st_makepoint(80.26935,13.08178),4326),'submitted',null,0),
  ('RW-DEMO03','unfinished_work','Trench left open',12.98500,80.22000, st_setsrid(st_makepoint(80.22000,12.98500),4326),'acknowledged',null,4),
  ('RW-DEMO04','no_barricade','No barricade around the dig',13.08000,80.26800, st_setsrid(st_makepoint(80.26800,13.08000),4326),'submitted',null,1),
  ('RW-DEMO05','debris','Construction debris on the road',13.08500,80.27500, st_setsrid(st_makepoint(80.27500,13.08500),4326),'in_progress',null,3),
  ('RW-DEMO06','pothole','Large pothole near the junction',13.00000,80.20500, st_setsrid(st_makepoint(80.20500,13.00000),4326),'submitted',null,1),
  ('RW-DEMO07','unfinished_work','Cable work left half done',12.99500,80.19750, st_setsrid(st_makepoint(80.19750,12.99500),4326),'acknowledged',null,3),
  ('RW-DEMO08','debris','Soil heaped on the roadside',13.00300,80.25300, st_setsrid(st_makepoint(80.25300,13.00300),4326),'submitted',null,0),
  ('RW-DEMO09','pothole','Pothole after the water connection work',13.00600,80.25600, st_setsrid(st_makepoint(80.25600,13.00600),4326),'submitted',null,2),
  ('RW-DEMO10','no_barricade','Open manhole with no barricade',12.98400,80.22400, st_setsrid(st_makepoint(80.22400,12.98400),4326),'in_progress',null,5),
  ('RW-DEMO11','other','Street light not working',13.03120,80.18250, st_setsrid(st_makepoint(80.18250,13.03120),4326),'submitted',null,1),
  ('RW-DEMO12','debris','Broken pavement slabs',13.03250,80.18500, st_setsrid(st_makepoint(80.18500,13.03250),4326),'submitted',null,0),
  ('RW-DEMO13','pothole','Pothole on the main road',12.98000,80.21700, st_setsrid(st_makepoint(80.21700,12.98000),4326),'resolved','Pothole filled and surface levelled.',2),
  ('RW-DEMO14','unfinished_work','Road left unfinished after resurfacing',13.07800,80.26500, st_setsrid(st_makepoint(80.26500,13.07800),4326),'acknowledged',null,1),
  ('RW-DEMO15','other','Waterlogging near the work site',13.08750,80.28000, st_setsrid(st_makepoint(80.28000,13.08750),4326),'submitted',null,0);

-- Link complaints to the nearest active project within 50 m
update complaints c set project_id = (
  select p.id from projects p
  where p.status in ('ongoing','delayed')
    and st_dwithin(p.geom::geography, c.geom::geography, 50)
  order by st_distance(p.geom::geography, c.geom::geography) limit 1)
where project_id is null;

-- ===== SANITY CHECKS (results show in the SQL Editor) =====
-- CHECK 1: every active or planned full closure must block exactly 1 edge.
-- 0 = geometry drifted off the edge; 2+ = closure too close to a junction
-- (shrink f1..f2 or move it away from the node).
select p.title, p.status, count(e.id) as blocked_edges
from projects p
left join road_edges e on st_dwithin(e.geom::geography, p.geom::geography, 20)
where p.closure_type = 'full_closure'
group by p.title, p.status
order by p.title;

-- CHECK 2: counts (expect 20 nodes, 16 edges, 20 projects, 15 complaints)
select (select count(*) from road_nodes) nodes,
       (select count(*) from road_edges) edges,
       (select count(*) from projects) projects,
       (select count(*) from complaints) complaints;

-- CHECK 3: re-dig counter must show 3 for Adyar Main Road
select r.name, count(*)::int as count_12m
from projects p join roads r on r.id = p.road_id
where p.status <> 'cancelled' and p.start_date >= current_date - interval '12 months'
group by r.name order by count_12m desc;