import type { DB } from './db';

export const audit = (
  db: DB, actor: string, action: string, entity: string,
  entityId: string | null, details: unknown = {}
) =>
  db`insert into audit_log (actor_id, action, entity, entity_id, details)
     values (${actor}, ${action}, ${entity}, ${entityId}, ${db.json(details as any)})`;