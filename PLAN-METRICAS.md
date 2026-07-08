# 📊 Plan: Métricas de uso de la plataforma

Propuesta para medir el uso de cada taller. **Documento de planificación** (aún no implementado).
Fecha: **2026-07-08**.

---

## 1. Objetivo (lo que quieres saber)

| Pregunta | Métrica que la responde |
|---|---|
| ¿Cuándo un taller **deja de usar** la plataforma? | **Última actividad** por taller → detección de inactividad / abandono (churn). |
| ¿Cuántas veces se **loguea** en el día? | Conteo de **inicios de sesión** por usuario/taller por día. |
| ¿Qué **flujo** usó para navegar? | Secuencia de **vistas de página / acciones** por sesión (recorrido y embudos). |

Foco: **el personal del taller** (admin y mecánicos). El cliente que ve el tracking se puede medir
solo de forma **agregada y anónima** (para no crear problemas de privacidad).

---

## 2. Opciones

### Opción A — Analítica **propia** en Supabase (recomendada para empezar)
Guardamos "eventos de uso" en una tabla nuestra y los mostramos en el **panel de superadmin**.
- ✅ **Sin costo extra** (usa Supabase que ya tienes), **control total** de los datos.
- ✅ Se integra en el **panel de superadmin** (junto al detalle de taller que ya existe).
- ✅ Privacidad: dato **first-party**, no se comparte con terceros.
- 🔧 Hay que construir la captura y los reportes. Los reportes ricos (embudos visuales) son más trabajo.
- 🔧 Requiere **retención/limpieza** (las vistas de página crecen rápido).

### Opción B — Herramienta de terceros
- **PostHog** (recomendado si se elige terceros): analítica de producto con **embudos, retención,
  grabación de sesión, autocaptura** de clics/vistas. Plan gratuito ~1M eventos/mes. Identificas al
  usuario por taller. Resuelve "flujo" y "churn" casi sin construir nada.
- **Vercel Web Analytics**: vistas de página simple y privado; **no** da conteo de logins ni embudos por usuario.
- **Plausible / Umami**: vistas de página livianas y privadas; no es analítica de producto por usuario.
- ✅ Dashboards potentes sin construirlos. ❌ Otro servicio, los datos **salen de Supabase**, costo al
  escalar, hay que **actualizar la política de privacidad**, y el panel es **aparte** (no en tu superadmin).

### 🏆 Recomendación
**Empezar con la Opción A (propia), por fases.** Cubre exactamente tus 3 preguntas, sin costo nuevo y
dentro de tu panel de superadmin. Si más adelante quieres embudos visuales / grabación de sesión,
**agregar PostHog** (Opción B) como capa complementaria.

---

## 3. Diseño recomendado (Opción A)

### Modelo de datos — nueva tabla `activity_events`
```
id           uuid pk
workshop_id  uuid  (taller; null para superadmin)
user_id      uuid  (auth.users)
role         text  ('admin' | 'mechanic' | 'superadmin')
type         text  ('login' | 'page_view' | 'order_created' | 'order_status_changed'
                    | 'stage_updated' | 'attachment_added' | 'mechanic_created' | ...)
path         text  (ruta, para page_view)
metadata     jsonb (datos extra: orderId, from/to estado, etc.)
created_at   timestamptz default now()
```
- Índices por `(workshop_id, created_at)` y `(type, created_at)`.
- **RLS**: bloqueada para todos; se escribe/lee solo con **service_role** (como `platform_admins`).

### Captura de eventos (dónde se registran)
1. **`login`** — en el login, tras `signInWithPassword` exitoso → `POST /api/events`.
2. **`page_view`** — un componente cliente en los layouts de **admin** y **mecánico** que, al cambiar de
   ruta (`usePathname` + `useEffect`), envía la ruta. Con **debounce** para no saturar.
3. **Acciones clave** (opcional, fase 2) — registrar en los endpoints existentes: crear orden, cambiar
   estado, subir adjunto, crear mecánico. Da un "flujo" más rico que solo vistas.

### API — `POST /api/events`
- Autenticado (`getCaller`): toma `workshop_id`, `user_id`, `role` del servidor (no confiar en el cliente).
- Inserta con `service_role`. Ligero y silencioso (si falla, no rompe la app).

### Métricas derivadas (cómo se calculan)
- **Última actividad del taller** = `max(created_at)` de sus eventos → "activo hoy / hace N días / inactivo".
- **Logins por día** = `count(*) where type='login'` agrupado por día (y por usuario).
- **Flujo de navegación** = lista ordenada de `page_view.path` por sesión/día (y, a futuro, embudos:
  % que pasa de "ver órdenes" → "crear orden" → "asignar mecánico").

### Dónde se ve (panel de superadmin)
- **Vista global** (`/superadmin`): por cada taller, un indicador de **última actividad** (semáforo:
  verde = activo, ámbar = 3-7 días, rojo = inactivo) y **ingresos hoy/semana**.
- **Detalle del taller** (`/superadmin/talleres/[id]`, que ya existe): sección "Actividad" con
  **última conexión**, **logins por día** (últimos 14 días), y **recorrido reciente** (últimas rutas/acciones).

### Retención y rendimiento
- Los `page_view` crecen rápido. Plan:
  - Guardar **crudo 60–90 días**; borrar lo más viejo con un **cron** (Supabase pg_cron o cron de Vercel).
  - Mantener una tabla de **agregados diarios** (`activity_daily`: workshop_id, día, logins, page_views,
    activo sí/no) para reportes rápidos y para conservar histórico sin guardar cada evento.
- Inserciones **no bloqueantes** (fire-and-forget) para no ralentizar la navegación.

---

## 4. Plan por fases

| Fase | Qué incluye | Resultado |
|---|---|---|
| **1** | Tabla `activity_events` (migración) + `POST /api/events` + captura de **login** y **page_view** + sección "Actividad" en el detalle del taller (última conexión, logins/día, últimas rutas). | Responde las **3 preguntas** con datos reales. |
| **2** | Semáforo de actividad/última conexión en la **lista** de talleres + eventos de **acciones clave** (crear orden, cambiar estado, etc.) para un flujo más rico. | Vista global de churn + embudos básicos. |
| **3** | **Agregados diarios** + **cron de limpieza** (retención) + panel con gráficos (logins por día, activos por semana). | Escalable y con histórico liviano. |
| **4** (opcional) | Integrar **PostHog** para embudos visuales, retención y grabación de sesión. | Analítica de producto avanzada. |

---

## 5. Consideraciones importantes

- **Privacidad:** es analítica **interna** del personal del taller (no de los clientes). Aun así, hay que
  **mencionarlo en la Política de Privacidad** ("registramos uso de la plataforma para mejorar el servicio").
  Del **cliente** (tracking) solo mediríamos agregados anónimos, o nada.
- **Rendimiento:** la captura debe ser liviana y tolerar fallos (nunca romper la navegación).
- **Costo/límites:** en el plan gratuito de Supabase (500 MB de BD) las vistas de página suman; por eso la
  **retención + agregados** son parte del plan, no un extra.
- **Multi-taller:** cada evento lleva `workshop_id`, así el aislamiento y los reportes por taller son directos.
- **No sobre-medir:** empezar con login + page_view (barato y suficiente para tus 3 preguntas) y ampliar solo si hace falta.

---

## 6. Decisiones para confirmar antes de implementar
1. **¿Propia (A) o terceros (B)?** → Recomiendo empezar con **A (Fase 1)**.
2. **¿Medimos también las acciones clave** (crear orden, etc.) desde el inicio, o solo login + page_view?
3. **¿Retención?** (sugerido: 60–90 días de eventos crudos + agregados diarios indefinidos).
4. **¿Actualizamos la Política de Privacidad** para mencionar la analítica de uso? (recomendado sí).

> Al aprobar, se implementa por fases. La **Fase 1** es la de mayor valor y menor esfuerzo.
