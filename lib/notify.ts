import type { DB } from './db';

export type NType =
  | 'status_change' | 'date_change' | 'delay' | 'update'
  | 'complaint_response' | 'route_update';

export const notifyFollowers = (db: DB, projectId: string, type: NType, message: string) =>
  db`insert into notifications (user_id, project_id, type, message)
     select user_id, ${projectId}, ${type}::notification_type, ${message}
     from follows where project_id = ${projectId}`;