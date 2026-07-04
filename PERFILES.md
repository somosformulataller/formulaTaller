# 👥 Perfiles, funciones y cómo se ven — Formula Taller

Documentación de **todas las funciones de cada perfil** y **cómo se muestran visualmente**.
Última actualización: **2026-07-04**. Tema: oscuro, con acento **ámbar** (`brand`) y tipografía Inter.

**Perfiles:**
1. 🔧 **Mecánico** — operación diaria de las órdenes de su taller.
2. 🏪 **Administrador del taller** (dueño) — todo lo del mecánico + gestión de mecánicos y del taller.
3. 🛡️ **Superadministrador** (sistema) — administración de toda la plataforma.
4. 🌐 **Cliente** — sin cuenta; solo ve el seguimiento por enlace.

> **Reglas transversales**
> - **Aislamiento por taller:** admin y mecánico solo ven/gestionan datos de **su** taller.
> - **Login único:** todos entran por el mismo login; según el rol van a `/superadmin`, `/admin` o `/mecanico`.
> - **Permisos verificados en el servidor:** `canManageOrder` (gestionar orden/etapas/adjuntos = cualquier
>   staff de su taller), `canDeleteOrder` (eliminar orden), rol `admin`, `platform_admins` (superadmin).

---

## 🎨 Elementos visuales comunes (se reutilizan en varios perfiles)

- **Barra inferior (BottomNav):** fija abajo, fondo translúcido con desenfoque. Íconos + texto; el
  activo se resalta en **ámbar** con un puntito. Admin: 4 pestañas · Mecánico: 1 pestaña.
- **Barra superior (TopBar):** logo + nombre del taller.
- **Tarjeta (card):** bloque redondeado con borde sutil; es el contenedor base de casi todo.
- **Badge de estado:** píldora de color — gris "Sin mecánico", **ámbar** "En progreso", **verde** "Vehículo listo".
- **Botón WhatsApp:** píldora **verde** con ícono de mensaje (abre WhatsApp del que hace clic).
- **Selector desplegable (estado / mecánico):** campo tipo formulario con una **flecha ▼** a la derecha;
  al tocarlo despliega la lista.
- **Selector de teléfono (PhoneInput):** botón con **bandera + código (ej. 🇻🇪 +58)** y flecha, al lado
  del campo del número; al abrir muestra un **buscador de país** y la lista (bandera, nombre, código, ✔ el elegido).
- **Cuadrícula de adjuntos:** miniaturas cuadradas uniformes — foto (previsualización), video (con ▶),
  nota de voz (ícono de micrófono + "Voz"), documento (ícono + nombre). En modo edición, cada una tiene
  una **✕ roja** arriba a la derecha para eliminar.
- **Visor (lightbox):** al tocar una miniatura se abre a pantalla completa (fondo oscuro) con la foto/
  video/audio en grande, botones **descargar**, **eliminar** (si puede) y **flechas** para navegar.
- **Interruptor (toggle):** switch estilo móvil; **ámbar** encendido, gris apagado (usado en el panel superadmin).
- **Modal:** ventana centrada sobre un fondo oscurecido (crear/editar orden, crear mecánico, etc.).

---

## 🔧 Mecánico

**Acceso:** login → **`/mecanico`**. **Navegación:** 1 pestaña abajo — **Mis Órdenes**.

> Sobre las órdenes de su taller gestiona **igual que el admin**. Diferencias: **eliminar** solo las
> suyas, y **no** administra mecánicos ni el taller.

### Funciones y cómo se ven

**Listado de órdenes (`/mecanico`)**
- Encabezado "Hola, [nombre] 👋" con cuántas órdenes tiene asignadas. Botón **"Nueva"** (ámbar, con ➕) arriba a la derecha.
- **Buscador** (campo con lupa) y **pestañas de filtro** en píldoras: *Mis órdenes / Todas / Sin asignar / En progreso / Listas* (la activa en ámbar).
- Cada orden es una **tarjeta**: nombre del cliente (negrita) + fecha, **Badge** de estado, línea divisoria,
  datos (íconos de auto, teléfono, mecánico) y una fila de botones: **WhatsApp** (verde), **copiar enlace**,
  **"Ver orden"** (gris, con flecha ›), **"Asignarme"**, **"Marcar como lista"** (si es suya y en progreso) y
  **eliminar** (ícono de papelera rojo, solo si es suya).

**Crear / editar orden** — se abre en un **modal**:
- Campos: nombre y apellido, **WhatsApp** (con selector de país), modelo del vehículo, **mecánico asignado**
  (selector desplegable propio), notas.
- Al crear: bloque para **adjuntar archivos** con botón "＋ Agregar foto, video, nota de voz o documento"
  (abre un menú con opciones: galería, cámara foto, cámara video, grabar/adjuntar voz, documento); las
  pendientes se ven como miniaturas con ✕.

**Detalle de la orden (resumen)** — mismas secciones que el admin:
- **Tarjeta** con nombre del cliente (título), n.º de orden, **Badge** de estado y datos (auto, WhatsApp, mecánico, fecha).
- **"Cambiar estado"** — etiqueta + **selector desplegable** (Sin mecánico / En progreso / Vehículo listo).
- **"Asignar mecánico"** — etiqueta + **selector desplegable** con los mecánicos del taller.
- Fila de botones: **WhatsApp** (verde), **Ver tracking** (gris con ícono de enlace externo), **copiar enlace**,
  **Asignarme**, **Editar**, **Eliminar** (rojo, solo si es suya).
- **"Archivos adjuntos"** (Recepción) — tarjeta con ícono de clip: **cuadrícula** de miniaturas + botón para
  **agregar**; cada miniatura con ✕ para eliminar.

**Etapas del servicio** — **línea de tiempo vertical** (con una línea que conecta las etapas):
- Cada etapa es una tarjeta con su **ícono de estado** (✔ verde hecho / spinner ámbar en progreso / círculo gris pendiente).
- Botón que **cambia el estado** (Iniciar/Completar/Reabrir), botón **editar** (lápiz) para título/descripción,
  y un **asa (⋮⋮)** para **arrastrar y reordenar**.
- **Adjuntos** de la etapa en cuadrícula + botón **"Agregar…"**; botón verde **"Avisar al cliente"** (WhatsApp);
  botón **eliminar etapa** (papelera roja, abajo a la derecha).
- Abajo, botón **"Agregar etapa personalizada"**.

### Límites / no puede
- ❌ Eliminar **órdenes de otros** (solo las suyas). *(Editarlas/gestionarlas sí.)*
- ❌ Gestionar **mecánicos**; entrar a **`/admin/*`**, al **perfil del taller** o a **`/superadmin`**.
- ❌ Cambiar el **límite de órdenes** o la **suscripción**.
- ⚠️ Sujeto al **límite del plan** del taller.

---

## 🏪 Administrador del taller (dueño)

**Acceso:** login → **`/admin`**. **Navegación:** 4 pestañas abajo — **Inicio**, **Órdenes**,
**Mecánicos**, **Taller**.

### Funciones y cómo se ven

**Inicio (`/admin`)** — panel de resumen: tarjetas con **estadísticas** del taller (órdenes por estado)
y accesos rápidos.

**Órdenes (`/admin/ordenes`)** — misma pantalla y tarjetas que el mecánico (buscador, filtros, "Nueva"),
pero puede actuar sobre **cualquier** orden. La tarjeta añade botones de **editar** (lápiz) y **eliminar**
(papelera). El **detalle** es idéntico al del mecánico (Cambiar estado, Asignar mecánico, etapas, adjuntos),
sin la restricción de "solo las mías".

**Mecánicos (`/admin/mecanicos`)**
- Lista de **tarjetas** de mecánico (nombre, correo, estado activo/inactivo). Botón **"Nuevo mecánico"**.
- Crear/editar en **modal** (nombre, correo, contraseña, teléfono con selector de país).
- Tras crear/cambiar clave, aparece un **panel de credenciales** con botones **"Copiar datos"** y
  **"Enviar por WhatsApp"** (verde). Acciones: editar, cambiar contraseña, **reenviar acceso**,
  activar/desactivar, eliminar.

**Taller (`/admin/taller`)**
- Tarjeta de **logo** (previsualización + botón subir/cambiar).
- Tarjeta del **login personalizado** (`/login/<slug>`) con botones **copiar** y **abrir**.
- **Formulario** con nombre del taller y **WhatsApp** (selector de país) + "Guardar cambios" (con aviso verde al guardar).
- **Zona de peligro** (recuadro rojo): **"Eliminar cuenta del taller"** → abre un **modal** que pide
  escribir el nombre del taller para confirmar.

### Límites / no puede
- ❌ Ver/gestionar **otros talleres**.
- ❌ Cambiar su **límite** ni marcarse **suscrito** (lo hace el superadmin); entrar a **`/superadmin`**.
- ⚠️ **Límite del plan gratuito** (global 3 por defecto, o el propio que le ponga el superadmin). Al
  alcanzarlo aparece el **modal** de suscripción con los **números de atención** (botones de WhatsApp).
  Si lo marcan **suscrito** → **ilimitado**.

---

## 🛡️ Superadministrador (sistema)

**Acceso:** login → panel **`/superadmin`** (por `/superadmin/login` o el login normal). No pertenece a
ningún taller. Se crea manual: `npm run seed:superadmin -- <correo> <clave> ["Nombre"]`.

### Funciones y cómo se ven (panel `/superadmin`)
- **Encabezado:** "Panel de plataforma" + correo del superadmin + botón **"Salir"**.
- **Métricas:** 3 **tarjetas** en fila (ícono + número grande + etiqueta): **Talleres**, **Suscritos**, **Órdenes**.
- **"Límite del plan gratuito":** tarjeta con un **campo numérico** + botón **"Guardar"**.
- **"Números de atención al cliente":** tarjeta con una **lista** de campos (cada uno con selector de país +
  número y una **papelera** para quitarlo), botón **"Agregar número"** y **"Guardar números"**.
- **Buscador** de talleres.
- **Cada taller** es una tarjeta con:
  - Nombre + **etiqueta "PRO"** (ámbar) si está suscrito; línea con **dueño · "X / límite" órdenes · fecha**.
  - **Interruptor "Suscrito"** (toggle) a la derecha → órdenes ilimitadas al activarlo.
  - **Editor de límite** (campo + "Guardar"; vacío = usa el global).
  - **Datos de contacto:** ícono de sobre + **correo de registro**, ícono de teléfono + **teléfono**.
  - **Restablecer contraseña:** botón **"Enviar enlace por correo"** (envía a `/reset-password`) y botón
    **"Contraseña temporal"** (muestra la clave nueva en un recuadro con botón **Copiar**).

### Límites / no puede
- ❌ **No gestiona órdenes, etapas ni mecánicos** de un taller (no tiene perfil de taller); no entra a `/admin` ni `/mecanico`.
- ⚠️ Creación **manual** (script/SQL). El **correo de restablecimiento** usa el envío integrado de Supabase
  (límite de envíos / posible spam) → por eso está la **contraseña temporal** como respaldo.

---

## 🌐 Cliente (sin cuenta)

Con el **enlace de tracking** (`/tracking/<token>`) ve una página de seguimiento (solo lectura):
- **Encabezado** con logo/nombre del taller y **banner de estado** de color (en espera / en servicio / ¡listo!).
- Tarjeta de **información** (cliente, vehículo, mecánico, fecha) y, si hay, **"Fotos y archivos"** de recepción (cuadrícula).
- **Barra de progreso** (%) y **línea de tiempo** de etapas con su ícono de estado, descripción, fecha y **adjuntos** (cuadrícula + visor).
- Los adjuntos salen **ordenados** por fecha; se muestra **siempre el estado actual** (al abrir/recargar).
- Si el vehículo está listo, aparece un **mensaje verde** de "¡Tu vehículo está listo! 🎉".

---

## 📊 Resumen comparativo

| Función | Mecánico | Admin del taller | Superadmin |
|---|:---:|:---:|:---:|
| Ver órdenes del taller | ✅ | ✅ | — |
| Crear órdenes | ✅ | ✅ | — |
| Editar / estado / asignar / etapas / adjuntos | ✅ (cualquiera del taller) | ✅ (cualquiera del taller) | — |
| Autoasignarse una orden | ✅ | — (asigna a cualquiera) | — |
| Avisar al cliente por WhatsApp | ✅ | ✅ | — |
| Eliminar órdenes | Solo las **suyas** | ✅ (todas) | — |
| Gestionar mecánicos | ❌ | ✅ | — |
| Perfil / logo del taller | ❌ | ✅ | — |
| Eliminar la cuenta del taller | ❌ | ✅ | — |
| Ver **otros** talleres | ❌ | ❌ | ✅ |
| Suscripción / límite de órdenes | ❌ | ❌ | ✅ |
| Números de atención al cliente | ❌ | ❌ | ✅ |
| Restablecer contraseña de talleres | ❌ | ❌ | ✅ |
| Sujeto al límite del plan | ✅ | ✅ | No aplica |

> Más contexto en `CONTEXTO.md` · comandos en `COMANDOS.md` · notas de caché en `CACHE.md`.
