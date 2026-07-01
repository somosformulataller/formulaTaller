# 🚀 Registro de puesta en producción — Formula Taller

Bitácora de todo lo que se va haciendo para producción (GitHub · Vercel · Supabase).
Última actualización: 2026-06-30.

---

## Estado actual

| Paso | Estado |
|---|---|
| 1. Repo git local + commit inicial | ✅ Hecho |
| 2. Push a GitHub (`somosformulataller/formulaTaller`) | ✅ Hecho |
| 3. Base de datos en Supabase (`SETUP.sql`) | ⬜ Pendiente de confirmar |
| 4. Crear usuario admin (`npm run seed:admin`) | ⬜ Pendiente de confirmar |
| 5. Importar repo en Vercel + variables de entorno | ✅ Hecho |
| 5b. Fix: variable mal nombrada `..._ANON_K` → `..._ANON_KEY` + redeploy | ✅ Hecho (deploy READY, sitio responde) |
| 6. `NEXT_PUBLIC_SITE_URL` = `https://formulataller.com` + redeploy | ✅ Hecho |
| 7. Configurar URLs de auth en Supabase | ⬜ **Pendiente (recomendado)** |
| 8. Dominio propio `formulataller.com` (Namecheap) + redirección www | ✅ Hecho (DNS OK, SSL activo) |

**URLs:** principal `https://formulataller.com` (www redirige aquí) · directo de Vercel `https://formula-taller.vercel.app`.

---

## ¿Qué tokens necesito y dónde se consiguen?

### Para el flujo recomendado (conectar GitHub ↔ Vercel por el dashboard): **NINGÚN token**
Solo necesitas pegar las 4 variables de entorno (abajo) al importar el proyecto. Es lo más simple y seguro.

### Si quieres que yo automatice por CLI/API (opcional)
| Token | Dónde sacarlo | Para qué |
|---|---|---|
| **Vercel Access Token** | https://vercel.com/account/tokens → *Create Token* | Crear proyecto y subir env vars por API |
| **Supabase Personal Access Token** | https://supabase.com/dashboard/account/tokens | Usar la CLI de Supabase (migraciones) |

> ⚠️ Aun con el token de Vercel, **conectar el repo de GitHub a Vercel requiere autorizar
> la app de GitHub en el navegador** (OAuth). Por eso recomiendo hacerlo desde el dashboard:
> son 5 clics y no hay que compartir tokens secretos.

---

## Variables de entorno (pegar en Vercel)

En Vercel, al importar: sección **Environment Variables**. Marca *Production, Preview y Development*.

| Variable | Valor |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://tsvaagakjkemavhdcroy.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `sb_publishable_wN8Veq_Joy0d32RIVeeNvw_mTwCPYfo` |
| `SUPABASE_SERVICE_ROLE_KEY` | *(secreta — cópiala de tu `.env.local`, línea 4)* |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` por ahora → cambiar a la URL de Vercel tras el 1er deploy |

> 🔴 La `SERVICE_ROLE_KEY` es secreta: no la pongas como `NEXT_PUBLIC_*` ni en el código cliente.
> 🔴 `NEXT_PUBLIC_SITE_URL` debe ser tu dominio real de producción: de ahí salen los enlaces
> de seguimiento que se envían por WhatsApp.

---

## Paso 5 — Importar en Vercel (auto-deploy desde GitHub)

1. Entra a https://vercel.com/new (inicia sesión con GitHub).
2. **Import Git Repository** → elige `somosformulataller/formulaTaller`.
   - Si no aparece: *Adjust GitHub App Permissions* y dale acceso al repo.
3. Framework: **Next.js** (se detecta solo). No cambies Build ni Output.
4. Despliega **Environment Variables** y agrega las 4 de arriba.
5. **Deploy**.

➡️ A partir de aquí, **cada `git push` a `main` redespliega solo**. Eso es justo lo que querías.

---

## Paso 6 — Fijar la URL real

Tras el primer deploy, Vercel te da una URL tipo `https://formula-taller-xxxx.vercel.app`.

1. Vercel → Project → **Settings → Environment Variables**.
2. Edita `NEXT_PUBLIC_SITE_URL` y pon esa URL (con `https://`, sin barra final).
3. Vercel → **Deployments** → menú (···) del último → **Redeploy**.

---

## Paso 7 — Auth de Supabase para producción

https://supabase.com/dashboard/project/tsvaagakjkemavhdcroy/auth/url-configuration
- **Site URL:** tu URL de Vercel.
- **Redirect URLs:** agrega `https://TU-URL.vercel.app/**`.

---

## Paso 8 — DNS de `formulataller.com` en Namecheap (valores reales)

Estado: dominio **verificado** en Vercel, pero el DNS aún apunta al parking de Namecheap
(`162.255.119.207`) → por eso da error SSL. Hay que cambiar los registros:

**En Namecheap → Domain List → Manage (formulataller.com) → Advanced DNS → Host Records:**

1. **Borra** los registros existentes que apunten al parking (el `A @ 162.255.119.207` y
   cualquier "URL Redirect Record" o `CNAME www` por defecto de Namecheap).
2. **Agrega** estos dos:

| Type | Host | Value | TTL |
|---|---|---|---|
| A Record | `@` | `216.198.79.1` | Automatic |
| CNAME Record | `www` | `cname.vercel-dns.com.` | Automatic |

> Alternativa válida para el A: `76.76.21.21` (la IP clásica de Vercel). Namecheap **no**
> permite CNAME en la raíz, por eso la raíz va por A Record.

3. Guarda. La propagación tarda de minutos a un par de horas.
4. Vercel emite el **SSL automáticamente** cuando detecta el DNS correcto.

### Tras propagar el dominio
- Vercel → Settings → Environment Variables → `NEXT_PUBLIC_SITE_URL` = `https://formulataller.com` → Redeploy.
- Supabase → Auth → URL Configuration → Site URL y Redirect URLs con `https://formulataller.com/**`.

---

## Comandos para futuras actualizaciones

```bash
git add .
git commit -m "describe el cambio"
git push            # Vercel redespliega solo
```
