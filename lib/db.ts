import postgres from 'postgres';

export const sql = postgres(process.env.DATABASE_URL!, {
  ssl: 'require',
  prepare: false, // required for the Supabase transaction pooler (port 6543)
  max: 5,
  // keep Postgres `date` columns as plain 'YYYY-MM-DD' strings (no timezone surprises)
  types: {
    date: { to: 1082, from: [1082], serialize: (x: any) => x, parse: (x: string) => x },
  },
});

export type DB = typeof sql;