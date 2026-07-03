// scripts/create-superadmin.mjs
// Crea un SUPERADMIN de plataforma (acceso al panel /superadmin).
//
// Uso:
//   node scripts/create-superadmin.mjs <email> <password> ["Nombre"]
//   npm run seed:superadmin -- <email> <password> ["Nombre"]
//
// Requiere NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en .env.local.
// Usa la REST/Auth Admin API vía fetch (sin supabase-js), así funciona en
// cualquier versión de Node.
//
// El usuario se crea SIN workshop_id, por lo que el trigger handle_new_user NO
// le crea perfil de taller (ver migración 0009). Su acceso viene de la fila que
// insertamos en platform_admins.

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
  // .env.local puede no existir en CI — usar variables de entorno del sistema
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌  Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const EMAIL = (process.argv[2] || process.env.SUPERADMIN_EMAIL || '').trim().toLowerCase();
const PASSWORD = process.argv[3] || process.env.SUPERADMIN_PASSWORD || '';
const NAME = process.argv[4] || process.env.SUPERADMIN_NAME || 'Superadministrador';

if (!EMAIL || !PASSWORD) {
  console.error('❌  Uso: node scripts/create-superadmin.mjs <email> <password> ["Nombre"]');
  process.exit(1);
}
if (PASSWORD.length < 6) {
  console.error('❌  La contraseña debe tener al menos 6 caracteres.');
  process.exit(1);
}

const headers = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
};

// Busca el id de un usuario ya existente por correo (recorre la lista admin).
async function findUserIdByEmail(email) {
  for (let page = 1; page <= 20; page++) {
    const res = await fetch(
      `${SUPABASE_URL}/auth/v1/admin/users?page=${page}&per_page=200`,
      { headers }
    );
    const data = await res.json().catch(() => ({}));
    const users = data.users || [];
    const found = users.find((u) => (u.email || '').toLowerCase() === email);
    if (found) return found.id;
    if (users.length < 200) break; // última página
  }
  return null;
}

async function main() {
  console.log(`\n🛡️   Creando superadmin: ${EMAIL}`);

  // 1. Crear el usuario en Auth (sin workshop_id → sin perfil de taller).
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      email: EMAIL,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: NAME, role: 'superadmin' },
    }),
  });

  const data = await res.json().catch(() => ({}));
  let userId;

  if (res.ok) {
    userId = data.id;
    console.log('✅  Usuario Auth creado:', userId);
  } else {
    const msg = data.msg || data.error_description || data.error || JSON.stringify(data);
    if (/registered|already/i.test(msg)) {
      console.log('⚠️   El usuario ya existía; reutilizando su cuenta.');
      userId = await findUserIdByEmail(EMAIL);
      if (!userId) {
        console.error('❌  No se pudo encontrar el id del usuario existente.');
        process.exit(1);
      }
    } else {
      console.error('❌  Error creando usuario:', msg);
      process.exit(1);
    }
  }

  // 2. Registrar (o actualizar) la fila en platform_admins. user_id es PK →
  //    upsert idempotente con merge-duplicates.
  const paRes = await fetch(`${SUPABASE_URL}/rest/v1/platform_admins`, {
    method: 'POST',
    headers: { ...headers, Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify({ user_id: userId, email: EMAIL }),
  });
  const paData = await paRes.json().catch(() => ({}));
  if (!paRes.ok) {
    console.error('❌  Error registrando en platform_admins:', JSON.stringify(paData));
    process.exit(1);
  }

  console.log('✅  Superadmin listo.');
  console.log(`   Email:    ${EMAIL}`);
  console.log(`   Entrar en: /superadmin/login`);
  console.log('\n💡  Cambia la contraseña desde el panel de Supabase tras el primer ingreso.\n');
}

main();
