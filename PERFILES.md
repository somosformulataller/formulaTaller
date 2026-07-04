# 👥 Perfiles y permisos — Formula Taller

Qué puede hacer cada perfil, qué tiene disponible y sus límites.
Última actualización: **2026-07-04**.

> **Aislamiento por taller:** el administrador y el mecánico solo ven y gestionan los datos de
> **su propio taller**. El superadmin está por encima de todos los talleres.
> Todos los permisos están **verificados en el servidor** (no solo ocultos en la interfaz):
> `canManageOrder` (órdenes/etapas), rol `admin` (gestión del taller) y `platform_admins` (superadmin).

---

## 🔧 Perfil: Mecánico

**Acceso:** inicia sesión con correo/contraseña → entra a **`/mecanico`**.
Lo crea el administrador del taller (recibe sus credenciales).

> **Mismo flujo que el administrador.** Sobre las órdenes de su taller, el mecánico gestiona igual
> que el admin (crear, ver, editar, cambiar estado, asignar mecánico, etapas y adjuntos). La **única**
> diferencia es **eliminar órdenes** (solo las suyas) y la administración del taller/plataforma.

### Puede hacer
- **Ver todas las órdenes** del taller. Filtros: **Mis órdenes / Todas / por estado** + buscador.
- **Crear órdenes** (con adjuntos iniciales: foto, video, nota de voz, documento).
- **Autoasignarse** una orden ("Asignarme").
- Sobre **cualquier orden del taller** (mismo flujo que el admin, desde el resumen de la orden):
  - **Editar** los datos de la orden.
  - **Cambiar el estado** y **asignar/reasignar mecánico** (selectores en el resumen).
  - **Gestionar las etapas**: iniciar/completar/reabrir, editar título y descripción, **reordenar**
    arrastrando, y **agregar/eliminar adjuntos** (en las etapas y en el resumen de recepción).
  - **Avisar al cliente por WhatsApp** (por etapa).
- **Eliminar** una orden **solo si es suya** (asignada a él o creada por él).
- **Enviar / copiar el enlace de tracking** al cliente.

### Límites / no puede
- ❌ Eliminar **órdenes de otros** (solo las suyas). *(Gestionarlas/editarlas sí puede.)*
- ❌ **Gestionar mecánicos** (crear, editar, contraseñas) — es del administrador.
- ❌ Entrar al **perfil del taller** (`/admin/taller`) ni a **`/admin/*`** ni al panel **`/superadmin`**.
- ❌ Cambiar el **límite de órdenes** o la **suscripción** del taller.
- ⚠️ **Comparte el límite del plan** del taller: si el taller llega a su tope de órdenes gratuitas,
  tampoco puede crear más (sale el aviso con los números de atención al cliente).

---

## 🏪 Perfil: Administrador del taller (dueño)

**Acceso:** inicia sesión con correo/contraseña → entra a **`/admin`**.
Se crea al **registrar el taller** en `/registro` (es el dueño / `owner_id`).

### Puede hacer
Todo lo del mecánico, **sin la restricción de "solo las mías"**, más la gestión del taller:

**Órdenes (cualquiera del taller):**
- Crear, **editar cualquier orden**, **cambiar estado**, **asignar mecánico**, **eliminar cualquier orden**.
- Gestión completa de **etapas** y **adjuntos** en cualquier orden.
- Avisar al cliente por WhatsApp y compartir el tracking.

**Mecánicos (`/admin/mecanicos`):**
- **Crear** mecánicos, **editar** (nombre/teléfono/correo), **ver/copiar correo**,
  **cambiar contraseña**, **enviar credenciales por WhatsApp**, **"Reenviar acceso"**,
  **activar/desactivar** y eliminar.

**Perfil del Taller (`/admin/taller`):**
- Editar **nombre**, **WhatsApp** y **logo** del taller.
- Ver/compartir su **enlace de login personalizado** (`/login/<slug>`).
- **Eliminar la cuenta** del taller (borra todo: usuarios, órdenes, adjuntos; pide confirmar el nombre).

### Límites / no puede
- ❌ Ver o gestionar **otros talleres** (aislamiento por tenant).
- ❌ Cambiar su **límite de órdenes** o marcarse como **suscrito** — eso lo hace el **superadmin**.
- ❌ Entrar al panel **`/superadmin`**.
- ⚠️ **Límite del plan gratuito:** puede crear hasta el límite del taller (**global 3 por defecto**, o el
  límite propio que le asigne el superadmin). Al alcanzarlo, aparece el aviso de suscripción con los
  **números de atención al cliente**. Si el superadmin lo marca **suscrito**, las órdenes son **ilimitadas**.

---

## 🛡️ Perfil: Superadministrador (administrador del sistema)

**Acceso:** inicia sesión con correo/contraseña → entra al panel **`/superadmin`**
(por `/superadmin/login` o por el login normal, que lo redirige solo).
**No** pertenece a ningún taller. Se crea **manualmente** (no hay registro público):
`npm run seed:superadmin -- <correo> <clave> ["Nombre"]`.

### Puede hacer (panel `/superadmin`)
- **Seguimiento de la plataforma:** total de **talleres registrados**, cuántos **suscritos** y total de **órdenes**.
- **Lista de todos los talleres** con: nombre, **dueño**, **correo de registro**, **teléfono**,
  nº de órdenes (**"X / límite"**) y fecha de alta. Con buscador.
- **Suscripción por taller:** interruptor **Suscrito** → le da **órdenes ilimitadas** (o quitárselo).
- **Límite del plan gratuito:**
  - Cambiar el **límite global** (afecta a todos los talleres sin límite propio).
  - Poner un **límite propio** a un taller (vacío = usa el global).
- **Números de atención al cliente:** agregar / editar / eliminar (salen en el aviso de suscripción).
- **Restablecer la contraseña** del dueño de un taller:
  - **Enviar enlace por correo** (el dueño la cambia en `/reset-password`).
  - **Generar contraseña temporal** y mostrarla para compartir.

### Límites / no puede
- ❌ **No gestiona órdenes, etapas ni mecánicos** de un taller directamente (no tiene perfil de taller);
  su rol es administración de la plataforma, no operación diaria de un taller.
- ❌ No entra a **`/admin`** ni **`/mecanico`** (no tiene perfil en ningún taller).
- ⚠️ **Creación manual:** las cuentas de superadmin se crean por script/SQL, nunca desde una página pública.
- ⚠️ **Correo de restablecimiento:** usa el envío integrado de Supabase (sin SMTP propio → límite de
  envíos por hora y posible spam); por eso existe la **contraseña temporal** como respaldo confiable.

---

## 🌐 Extra: Cliente (sin cuenta)

No es un perfil con login, pero es un nivel de acceso: cualquier persona con el **enlace de tracking**
(`/tracking/<token>`) puede **ver** el avance de su orden.
- Ve: estado, **etapas** con su descripción, y los **adjuntos** (fotos/videos/audios/documentos), **ordenados**.
- **Solo lectura**: no puede editar nada ni ver datos de otras órdenes (el token es un UUID imposible de adivinar).

---

## 📊 Resumen comparativo

| Acción | Mecánico | Admin del taller | Superadmin |
|---|:---:|:---:|:---:|
| Ver órdenes del taller | ✅ | ✅ | — |
| Crear órdenes | ✅ | ✅ | — |
| Editar / estado / asignar / etapas | ✅ (cualquiera del taller) | ✅ (cualquiera del taller) | — |
| Eliminar órdenes | Solo las **suyas** | ✅ (todas) | — |
| Autoasignarse órdenes | ✅ | — (asigna a cualquiera) | — |
| Gestionar mecánicos | ❌ | ✅ | — |
| Perfil / logo del taller | ❌ | ✅ | — |
| Eliminar la cuenta del taller | ❌ | ✅ | — |
| Ver **otros** talleres | ❌ | ❌ | ✅ |
| Cambiar límite / suscripción | ❌ | ❌ | ✅ |
| Números de atención al cliente | ❌ | ❌ | ✅ |
| Restablecer contraseña de talleres | ❌ | ❌ | ✅ |
| Sujeto al límite de órdenes del plan | ✅ | ✅ | No aplica |

> Más contexto en `CONTEXTO.md`; comandos en `COMANDOS.md`.
