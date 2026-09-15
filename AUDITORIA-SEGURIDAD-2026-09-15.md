# 🔒 Auditoría de seguridad y calidad — Formula Taller

**Fecha:** 2026-09-15 · **Alcance:** backend del panel superadmin, base de datos (RLS), frontend/métricas.
**Método:** revisión de código (3 revisores) + comprobación empírica contra producción con cuenta de prueba desechable (creada y borrada; base intacta).

> Contexto: revisión pedida tras restaurar el proyecto en Supabase, aplicando las lecciones del
> proyecto **La Mejor Llave** (topes de PostgREST, totales sobre consultas limitadas, aislamiento
> multi-tenant).

---

## Resumen ejecutivo

La **autorización del panel superadmin está bien hecha** (ese era el foco de la pregunta). Los
problemas graves están un nivel más abajo, en las **políticas RLS de la base de datos**: el
aislamiento entre talleres tiene agujeros que permiten a cualquier usuario autenticado leer y
manipular datos de otros talleres. Son reparables con SQL, sin tocar la app.

| # | Hallazgo | Área | Gravedad | Estado |
|---|----------|------|----------|--------|
| 1 | Órdenes/etapas/adjuntos legibles por cualquiera con la anon key pública | RLS | 🔴 CRÍTICO | ✅ RESUELTO (0013 + 0014, verificado en vivo 15/09) |
| 2 | Un mecánico puede auto-ascenderse a admin o cambiarse de taller | RLS | 🔴 CRÍTICO | ✅ RESUELTO (0014, verificado en vivo 15/09) |
| 3 | Etapas y adjuntos sin aislamiento por taller (usuario autenticado) | RLS | 🔴 CRÍTICO | ✅ RESUELTO (0014, verificado en vivo 15/09) |
| 4 | UPDATE de orders/workshops sin `WITH CHECK` → bypass del paywall | RLS | 🟠 ALTO | ✅ RESUELTO (0014, verificado en vivo 15/09) |
| 5 | Métricas del panel sobre consultas truncadas a 1000 filas | Frontend | 🟠 ALTO | 🔧 Corregido en código (0015 + panel); pendiente correr 0015 y desplegar |
| 6 | **Signup público activo → toma de control de cualquier taller** | Auth | 🔴 CRÍTICO | ✅ RESUELTO 15/09 — signup desactivado; ataque da 422 y el registro legítimo sigue OK |
| 7 | Contraseña temporal: PRNG débil, sin caducidad, se queda en el DOM | Backend/Front | 🟡 MEDIO | ✅ RESUELTO (crypto.randomInt + auto-ocultar 90s + botón Ocultar) |
| 8 | Fetches del panel sin try/catch → interruptores que mienten | Frontend | 🟡 MEDIO | ✅ RESUELTO (try/catch/finally + rollback en los 6 fetch) |
| 9 | Server Components no revisan `.error` → un fallo se ve como "0 datos" | Frontend | 🟡 MEDIO | ✅ RESUELTO (LoadError en el panel y el detalle de taller) |
| 10 | Bucket `stage-files` público: fotos de clientes sin caducidad | Storage | 🟡 MEDIO | ✅ RESUELTO (fotos en bucket privado + URLs firmadas; logos en bucket público aparte) |
| 11 | INSERT sin filtro de taller; sin límites de rango; sin auditoría | Varios | 🔧 Casi todo resuelto (0016 + cotas + server-only); falta tabla de auditoría/rate-limit (recomendación) |

> **Actualización 15/09/2026:** hallazgos 1–4 cerrados con las migraciones `0013` y `0014`
> (corridas en Supabase y verificadas en vivo con cuentas de prueba desechables: una cuenta nueva
> con cero datos propios ahora ve 0 etapas / 0 adjuntos / 0 órdenes ajenas; un mecánico no puede
> hacerse admin ni mudarse de taller; un admin no puede ponerse `is_subscribed`). El hallazgo 5 está
> corregido en código (RPC `0015` + panel de superadmin usa conteo agregado y pagina los correos):
> falta correr `0015_order_counts_rpc.sql` y desplegar. El código degrada bien si 0015 aún no está
> (muestra 0 órdenes en vez de romperse).

---

## 🔴 CRÍTICOS

### 1 + 3. Cualquiera puede leer datos de todos los talleres

**Dos vías, misma raíz (políticas RLS demasiado abiertas):**

- **Sin sesión, solo con la anon key** (que es pública, va en el JS del sitio): antes de 0013 se
  leían las 21 órdenes de los 18 talleres, con `client_whatsapp` y `public_token`. Con el token se
  entra a la página de tracking, que sirve el historial y las **fotos del vehículo del cliente**.
  Cadena verificada de punta a punta el 15/09.
  → `0013_fix_anon_read_leak.sql` (ya escrita) cierra esto para `orders` y `order_stages`.

- **Con cualquier sesión** (un mecánico raso de cualquier taller): comprobado empíricamente el 15/09
  con una cuenta recién creada, **cero datos propios**, que aún así veía **126 etapas, 43 adjuntos y
  21 órdenes** — todas. Las políticas de `order_stages` y `stage_attachments` solo exigen `is_staff()`,
  nunca comparan el taller. Estas dos tablas no tienen ni columna `workshop_id`.
  Archivos: `SETUP.sql:258,264,270,287` · `supabase/migrations/0004_stage_attachments.sql:24,29,34`.

**Por qué 0013 no basta:** 0013 quita la lectura anónima, pero el acceso *autenticado* cross-tenant a
etapas y adjuntos sigue abierto. Hay que darle a esas dos tablas un `workshop_id` (o filtrar vía la
orden padre) y reescribir sus políticas. Ver `remediacion/0014` propuesta abajo.

### 2. Escalada de privilegios: mecánico → admin, o mecánico → otro taller

`SETUP.sql:200` — la política `mechanic can update own profile` tiene `USING` pero **no `WITH CHECK`**.
En Postgres eso significa: se comprueba qué fila puede tocar, pero **no se valida la fila resultante**.
Un mecánico puede entonces:

```sql
update profiles set role = 'admin' where id = auth.uid();          -- se vuelve admin
update profiles set workshop_id = '<uuid de otro taller>' where id = auth.uid();  -- se muda de taller
```

Tras cambiarse de taller, `current_workshop_id()` devuelve el taller ajeno y **todas** las políticas
de 0005 le abren ese taller completo. Misma falta de `WITH CHECK` en `admin can update any profile`
(`0005:130`). No pude ejecutar la prueba de escritura (el clasificador de seguridad la bloqueó, lo
cual es correcto), pero el comportamiento de Postgres ante `USING` sin `WITH CHECK` es determinista.

---

## 🟠 ALTOS

### 4. UPDATE sin `WITH CHECK` en orders y workshops → el paywall no es una frontera real

`0005_multi_tenant.sql:146,151` (orders) y `0005:119` (workshops). Un admin puede:

```sql
update workshops set is_subscribed = true where id = current_workshop_id();  -- órdenes ilimitadas gratis
update orders set workshop_id = '<otro taller>' where id = '<propia>';        -- mover órdenes entre talleres
```

El paywall (límite de órdenes) se puede saltar desde la API REST pública sin tocar el panel. Hoy no
es una barrera de seguridad, solo de interfaz.

### 5. Métricas del panel truncadas a 1000 filas (la lección de La Mejor Llave)

**Ningún número del panel usa `count: 'exact'`; todos cuentan arrays en JS.** PostgREST corta en 1000
filas sin avisar.

- `src/app/superadmin/page.tsx:34` — `service.from('orders').select('workshop_id')` trae TODAS las
  órdenes de la plataforma sin paginar. A partir de 1000 en total: la métrica "Órdenes" se congela y,
  peor, el `{order_count} / {límite}` por taller puede mostrar `0/3` a un taller que va por 40 → se
  decide a quién cobrar sobre un número falso. Arreglo: RPC/vista con `group by workshop_id`.
- `page.tsx:29` (talleres), `talleres/[id]/page.tsx:62` (órdenes del taller): mismo patrón.
- `page.tsx:72` — `listUsers({ page: 1, perPage: 1000 })`: con >1000 usuarios, dueños reales se pintan
  "Sin correo" y su botón de reset queda deshabilitado.

Contraste: el backend (`api/orders/route.ts:59`) SÍ cuenta con `count: 'exact'`. Panel y backend
pueden dar cifras distintas del mismo taller.

### 6. Signup público activo → toma de control de cualquier taller — CONFIRMADO 🔴

**Ya no es "pendiente de verificar": está confirmado en vivo (15/09).** Con solo la anon key pública
(la que va en el JS del sitio), un atacante externo llamó a `/auth/v1/signup` con
`data: { role: 'admin', workshop_id: '<id de un taller>' }` y el trigger `handle_new_user` (`0009:39`)
le creó un perfil de **admin dentro de ese taller**. Prueba hecha contra un taller señuelo propio: el
señuelo pasó de 1 perfil a 2, el segundo un "Intruso Externo" con rol admin que nadie del taller creó.
Todo borrado tras la prueba.

Impacto: cualquiera que conozca (o cosechara antes de 0013) el `workshop_id` de un taller se vuelve su
administrador — ve clientes, órdenes, fotos, y puede borrar. Los `workshop_id` no son secretos.

**Fix (definitivo, sin código, no rompe la app):** Supabase → Authentication → Sign In / Providers →
Email → **desactivar "Allow new users to sign up"**. La app NO usa el signup público: crea usuarios con
`service.auth.admin.createUser` (register y mechanics), que es la admin API y NO se ve afectada por ese
interruptor. Comprobado en el código (`api/register/route.ts:71`, `api/mechanics/route.ts`).

**Por qué el fix no puede ser solo de código:** el trigger no puede distinguir de forma fiable un
`admin.createUser` de confianza (service) de un `signup` público, porque ambos entran por el mismo rol
de base de datos (`supabase_auth_admin`). Por eso el control correcto es cerrar el signup. Una defensa
en profundidad a nivel de trigger es posible pero frágil (depende del momento en que se marca el correo
como confirmado) y necesita probarse sin romper el registro; se puede añadir después como refuerzo.

---

## 🟡 MEDIOS

- **7. Contraseña temporal** (`reset-password/route.ts:10-14`): usa `Math.random()` (no
  criptográfico), prefijo fijo `FT`, puede salir de menos de 6 chars; viaja en la respuesta, no
  caduca, no fuerza cambio al entrar, y se queda pintada en el DOM (`SuperadminClient.tsx:646`) hasta
  recargar, acumulándose. Usar `crypto.randomBytes`, forzar cambio, y borrarla del estado tras copiar.
- **8. Sin try/catch** en los 6 `fetch` de `SuperadminClient.tsx` (102,121,142,161,190,216): si la red
  falla, el interruptor queda mostrando el estado nuevo sin haberse guardado y bloqueado para siempre.
- **9. Server Components no revisan `.error`** (`page.tsx:48-49,61,72`; `talleres/[id]/page.tsx:74-79`):
  un fallo de base de datos se renderiza como "0 talleres, 0 órdenes" — un problema disfrazado de
  plataforma vacía.
- **10. Bucket `stage-files` público** (`0004:39`): las fotos de clientes son descargables por
  cualquiera con la URL, sin sesión y para siempre. Las URLs no son adivinables (2 UUID) pero tampoco
  secretas: viajan en cada tracking. Alternativa: bucket privado + `createSignedUrl` con expiración.

---

## ⚪ MENORES

- INSERT sin filtro de taller (`SETUP.sql:222` orders, `:189` profiles): staff puede crear filas en
  otro taller.
- Sin límites superiores en `free_order_limit`/`order_limit` (puede desbordar `int4` → 500).
- `support_phones` sin validar dígitos/longitud/cantidad.
- Sin rate-limiting ni tabla de auditoría en rutas sensibles (suscripción, límites, contraseñas).
- Falta `import 'server-only'` en `src/lib/supabase/server.ts` (defensa contra import accidental).
- Errores de PostgREST crudos en 500 cuando el `:id` no existe (debería ser 404 genérico).

---

## Lo que está BIEN (no tocar)

- Autorización del panel: las 4 rutas `/api/superadmin/*` llaman `getPlatformAdmin()` en la primera
  línea, con `auth.getUser()` (valida el JWT, no la cookie), sin cachear, sin confiar en el cliente.
- `service_role` nunca llega al cliente (solo `server.ts`, sin `NEXT_PUBLIC_`).
- Sin IDOR en reset-password (resuelve `owner_id` desde `workshops`, no del body).
- Validación por lista blanca (sin spread del body); `is_subscribed`/`is_test` exigen boolean.
- Funciones helper (`is_staff`, `is_admin`, `current_workshop_id`, `handle_new_user`) son
  SECURITY DEFINER con `set search_path = public` — sin riesgo de escalada por search_path.
- `platform_admins` con RLS y sin políticas → solo service_role.
- `is_test` bien excluido de las métricas; cálculo sobre `rows`, no sobre lo filtrado por el buscador.

---

## Plan de arreglo (orden sugerido)

1. **Correr `0013_fix_anon_read_leak.sql`** en Supabase (ya escrita). Tapa la fuga anónima. Inmediato.
2. **Verificar/ desactivar el signup público** en Supabase Auth. Inmediato, sin código.
3. **RLS de etapas y adjuntos + `WITH CHECK`** (migración `0014`, a redactar y revisar): dar
   aislamiento por taller a `order_stages`/`stage_attachments` y añadir `WITH CHECK` a todas las UPDATE
   de profiles/orders/workshops. Cierra hallazgos 2, 3, 4. **Revisar contra la app antes de aplicar.**
4. **Métricas con `count`/agregado en servidor** (RPC `group by`). Cierra hallazgo 5.
5. try/catch en el panel + revisar `.error` en los Server Components (8, 9).
6. Contraseña temporal robusta y efímera (7); evaluar bucket privado con signed URLs (10).
7. Límites de rango, `server-only`, auditoría (menores).

**Antes de aplicar 0014**, correr en el SQL Editor para ver el estado real de las políticas (por si
hay alguna creada a mano desde el dashboard que no está en las migraciones):

```sql
select tablename, policyname, cmd, qual, with_check
from pg_policies where schemaname in ('public','storage') order by 1,2;

select relname, relrowsecurity, relforcerowsecurity
from pg_class
where relname in ('workshops','profiles','orders','order_stages',
                  'stage_attachments','platform_admins','platform_settings');
```
