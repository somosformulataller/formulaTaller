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

const headers = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
};

async function main() {
  console.log(`\n🔧  Creating admin user: ${ADMIN_EMAIL}`);

  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: ADMIN_NAME, role: 'admin' },
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
