// scripts/create-admin.mjs
// Run with: npm run seed:admin
// Requires: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY in .env.local
//
// Uses the Supabase Auth Admin REST API directly via fetch (no supabase-js),
// so it works on any Node version without a WebSocket polyfill.
// The handle_new_user trigger creates the matching admin profile automatically.

import { readFileSync } from 'fs';
import { resolve } from 'path';

// Load .env.local manually
try {
  const envPath = resolve(process.cwd(), '.env.local');
  const envContent = readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach((line) => {
    const [key, ...rest] = line.split('=');
    if (key && rest.length > 0 && !key.trim().startsWith('#')) {
      process.env[key.trim()] = rest.join('=').trim();
    }
  });
} catch {
  // .env.local may not exist in CI — rely on environment variables
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌  Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@formulataller.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin1234!';
const ADMIN_NAME = process.env.ADMIN_NAME || 'Administrador';
const WORKSHOP_NAME = process.env.WORKSHOP_NAME || 'Formula Taller';

const headers = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
};

// Multi-tenant: every user belongs to a workshop. Reuse one by name if it
// already exists, otherwise create it (via PostgREST).
async function ensureWorkshop() {
  const findRes = await fetch(
    `${SUPABASE_URL}/rest/v1/workshops?name=eq.${encodeURIComponent(WORKSHOP_NAME)}&select=id&limit=1`,
    { headers }
  );
  const found = await findRes.json().catch(() => []);
  if (Array.isArray(found) && found[0]?.id) return found[0].id;

  const res = await fetch(`${SUPABASE_URL}/rest/v1/workshops`, {
    method: 'POST',
    headers: { ...headers, Prefer: 'return=representation' },
    body: JSON.stringify({ name: WORKSHOP_NAME }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error('❌  Error creando taller:', JSON.stringify(data));
    process.exit(1);
  }
  return Array.isArray(data) ? data[0].id : data.id;
}

async function main() {
  console.log(`\n🏪  Ensuring workshop: ${WORKSHOP_NAME}`);
  const workshopId = await ensureWorkshop();
  console.log('✅  Workshop id:', workshopId);

  console.log(`\n🔧  Creating admin user: ${ADMIN_EMAIL}`);

  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: ADMIN_NAME, role: 'admin', workshop_id: workshopId },
    }),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const msg = data.msg || data.error_description || data.error || JSON.stringify(data);
    if (/registered|already/i.test(msg)) {
      console.log('⚠️   User already exists, skipping.');
    } else {
      console.error('❌  Error:', msg);
      process.exit(1);
    }
  } else {
    console.log('✅  Auth user created:', data.id);
  }

  console.log('✅  Admin user ready!');
  console.log(`   Email:    ${ADMIN_EMAIL}`);
  console.log(`   Password: ${ADMIN_PASSWORD}`);
  console.log('\n💡  Change the password via Supabase dashboard after first login.\n');
}

main();
