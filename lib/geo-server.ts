import { sql } from './db';

export const pointSql = (lat: number, lng: number) =>
  sql`st_setsrid(st_makepoint(${lng}::float8, ${lat}::float8), 4326)`;

// nearest ongoing/delayed project within 50 m
export async function nearestProject(lat: number, lng: number) {
  const pt = pointSql(lat, lng);
  const [p] = await sql`
    select id, title from projects
    where status in ('ongoing','delayed')
      and st_dwithin(geom::geography, ${pt}::geography, 50)
    order by st_distance(geom::geography, ${pt}::geography) limit 1`;
  return p ?? null;
}

// similar open complaint (same category) within 30 m
export async function findDuplicate(lat: number, lng: number, category: string) {
  const pt = pointSql(lat, lng);
  const [c] = await sql`
    select id, tracking_id, category, upvotes from complaints
    where category = ${category}::complaint_category and status <> 'resolved'
      and st_dwithin(geom::geography, ${pt}::geography, 30)
    order by st_distance(geom::geography, ${pt}::geography) limit 1`;
  return c ?? null;
}
