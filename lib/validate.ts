import { ApiError } from './errors';

export const isDate = (s: any) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);

export function assertGeometry(g: any) {
  const ok =
    g && g.type === 'LineString' && Array.isArray(g.coordinates) && g.coordinates.length >= 2 &&
    g.coordinates.every(
      (c: any) =>
        Array.isArray(c) && c.length >= 2 && isFinite(c[0]) && isFinite(c[1]) &&
        Math.abs(c[0]) <= 180 && Math.abs(c[1]) <= 90
    );
  if (!ok) throw new ApiError(400, 'INVALID_GEOMETRY', 'Provide a valid LineString geojson');
}

export function assertDates(start: any, end: any) {
  if (!isDate(start) || !isDate(end))
    throw new ApiError(400, 'VALIDATION', 'start_date and end_date must be YYYY-MM-DD');
  if (end < start)
    throw new ApiError(400, 'INVALID_DATES', 'End date cannot be before start date');
}

export function required(body: any, fields: string[]) {
  for (const f of fields)
    if (body[f] === undefined || body[f] === null || body[f] === '')
      throw new ApiError(400, 'VALIDATION', `Missing required field: ${f}`);
}