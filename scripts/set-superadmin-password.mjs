// scripts/set-superadmin-password.mjs
// Cambia la contraseña de una cuenta por su correo (pensado para el superadmin).
//
// Uso:
//   node scripts/set-superadmin-password.mjs <email> <nueva_password>
//   npm run set:superadmin-password -- <email> <nueva_password>
//
// Requiere NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en .env.local.
// Usa la Auth Admin API vía fetch (sin supabase-js).

import { readFileSync } from 'fs';
import { resolve } from 'path';

// Cargar .env.local manualmente
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
  // .env.local puede no existir en CI — usar variables del sistema
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌  Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const EMAIL = (process.argv[2] || '').trim().toLowerCase();
const NEW_PASSWORD = process.argv[3] || '';

if (!EMAIL || !NEW_PASSWORD) {
  console.error('❌  Uso: node scripts/set-superadmin-password.mjs <email> <nueva_password>');
  process.exit(1);
}
if (NEW_PASSWORD.length < 6) {
  console.error('❌  La contraseña debe tener al menos 6 caracteres.');
  process.exit(1);
}

const headers = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
};

async function findUserIdByEmail(email) {
  for (let page = 1; page <= 20; page++) {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?page=${page}&per_page=200`, {
      headers,
    });
    const data = await res.json().catch(() => ({}));
    const users = data.users || [];
    const found = users.find((u) => (u.email || '').toLowerCase() === email);
    if (found) return found.id;
    if (users.length < 200) break;
  }
  return null;
}

async function main() {
  console.log(`\n🔑  Buscando cuenta: ${EMAIL}`);
  const userId = await findUserIdByEmail(EMAIL);
  if (!userId) {
    console.error('❌  No se encontró ninguna cuenta con ese correo.');
    process.exit(1);
  }

  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ password: NEW_PASSWORD }),
  });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const msg = data.msg || data.error_description || data.error || JSON.stringify(data);
    console.error('❌  Error cambiando la contraseña:', msg);
    process.exit(1);
  }

  console.log('✅  Contraseña actualizada para', EMAIL);
  console.log('   Ya puedes entrar en /superadmin/login (o el login normal).\n');
}

main();
