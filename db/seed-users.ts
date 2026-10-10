import { createClient } from '@supabase/supabase-js';

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

const PASSWORD = 'Demo@1234'; // put in README demo logins
const users = [
  { email: 'resident@roadwatch.demo',    name: 'Demo Resident',       role: 'resident',   dept: null },
  { email: 'water@roadwatch.demo',       name: 'Water Officer',       role: 'department', dept: 'Water Board' },
  { email: 'electricity@roadwatch.demo', name: 'Electricity Officer', role: 'department', dept: 'Electricity Board' },
  { email: 'roads@roadwatch.demo',       name: 'Roads Officer',       role: 'department', dept: 'Roads Department' },
  { email: 'sewerage@roadwatch.demo',    name: 'Sewerage Officer',    role: 'department', dept: 'Sewerage Board' },
  { email: 'telecom@roadwatch.demo',     name: 'Telecom Officer',     role: 'department', dept: 'Telecom Provider' },
  { email: 'admin@roadwatch.demo',       name: 'Admin',               role: 'admin',      dept: null },
];

async function main() {
  for (const u of users) {
    const { data, error } = await admin.auth.admin.createUser({
      email: u.email,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: u.name },
    });
    let id = data?.user?.id;
    if (error) {
      // already exists: find it
      const list = await admin.auth.admin.listUsers({ perPage: 200 });
      id = list.data?.users.find((x) => x.email === u.email)?.id;
      if (!id) { console.error(u.email, error.message); continue; }
    }
    let department_id: string | null = null;
    if (u.dept) {
      const { data: d } = await admin.from('departments').select('id').eq('name', u.dept).single();
      department_id = d?.id ?? null;
    }
    // the signup trigger already inserted a resident row; upgrade it
    const { error: e2 } = await admin.from('users').upsert({
      id, email: u.email, full_name: u.name, role: u.role, department_id,
    });
    console.log(u.email, e2 ? e2.message : 'ok');
  }
}
main();