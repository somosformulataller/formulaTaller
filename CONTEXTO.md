# 🧭 Contexto del proyecto — Formula Taller

Documento de estado general del proyecto. Última actualización: **2026-07-01**.

---

## ¿Qué es?
**Formula Taller** es una **PWA** (aplicación web instalable) para la gestión de un taller
mecánico. Permite al **administrador** y a los **mecánicos** manejar órdenes de servicio, y a los
**clientes** hacer seguimiento del estado de su vehículo mediante un enlace público (sin login),
que se comparte por WhatsApp.

---

## Enlaces y cuentas
| Recurso | Valor |
|---|---|
| Sitio en producción | `https://formulataller.com` (con `www` redirigiendo a la raíz) |
| URL directa de Vercel | `https://formula-taller.vercel.app` |
| Repositorio GitHub | `github.com/somosformulataller/formulaTaller` |
| Proyecto Vercel | `formula-taller` (cuenta `somosformulataller`) |
| Supabase (project ref) | `tsvaagakjkemavhdcroy` |
| Dominio | `formulataller.com` (comprado en **Namecheap**, método A/CNAME) |
| Correo del negocio | `somosformulataller@gmail.com` |

**Auto-deploy:** cada `git push` a `main` en GitHub redespliega automáticamente en Vercel.

---

## Tecnología
- **Next.js 14** (App Router) + **React 18** + **TypeScript**
- **Supabase** (Postgres + Auth + Storage) con **RLS** activado
- **Tailwind** (parcial) + estilos inline
- Hosting en **Vercel** (plan gratuito, solo entorno Production)

---

## Modelo de datos (Supabase)
**Roles:** `admin` y `mechanic` (enum `user_role`).

| Tabla | Para qué |
|---|---|
| `profiles` | Datos de usuarios (nombre, teléfono, rol, activo). `id` = `auth.users.id`. El email vive en `auth.users`. |
| `orders` | Órdenes de servicio (cliente, vehículo, WhatsApp, mecánico asignado, estado, `public_token` único para el tracking). |
| `order_stages` | Etapas del servicio de cada orden (nombre, **descripción**, estado, posición). |
| `stage_attachments` | Adjuntos (fotos/documentos) de cada etapa. |

**Storage:** bucket **`stage-files`** (público) para las fotos/documentos.

**Estados de orden:** `sin_mecanico`, `con_mecanico`, `lista`.
**Estados de etapa:** `pending`, `in_progress`, `done`.

**Migraciones aplicadas en Supabase:**
1. `SETUP.sql` (tablas base, enums, triggers, RLS) — equivale a `0001` + `0002`.
2. `0003_stage_description.sql` (columna `description` en etapas).
3. `0004_stage_attachments.sql` (tabla de adjuntos + bucket `stage-files`).

---

## Variables de entorno (4)
| Variable | Nota |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://tsvaagakjkemavhdcroy.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | publishable key (pública) |
| `SUPABASE_SERVICE_ROLE_KEY` | secret key (¡privada! marcada como *Sensitive* en Vercel) |
| `NEXT_PUBLIC_SITE_URL` | `https://formulataller.com` |

> Las `NEXT_PUBLIC_*` se "hornean" en el build → tras cambiarlas hay que **Redeploy**.
> `.env.local` (local) está en `.gitignore` y nunca se sube al repo.

---

## Funcionalidades implementadas

### Roles y acceso
- Login por email/contraseña. El admin crea mecánicos; cada mecánico recibe su acceso.
- **Gestión de mecánicos** (admin): crear, **editar** (nombre/teléfono/email), **ver/copiar email**,
  **cambiar contraseña**, **enviar credenciales por WhatsApp**, botón **"Reenviar acceso"**,
  activar/desactivar.

### Órdenes
- **Admin y mecánico** pueden **ver todas las órdenes**, **crearlas** y **asignar mecánicos**.
- El mecánico puede **autoasignarse** una orden ("Asignarme") y, una vez asignado, **editarla**.
- **Filtro** en la vista del mecánico: **Mis órdenes / Todas** (+ por estado) y buscador.
- Solo el **admin** puede **eliminar** órdenes.

### Tracking del cliente (público, sin login)
- Enlace único por orden (`public_token`), que se puede **abrir**, **copiar** y **enviar por WhatsApp**.
- Muestra el progreso, las **etapas** con su **descripción** y los **adjuntos** (fotos/documentos).

### Etapas del servicio
- **Título editable** y **descripción opcional** (admin y mecánico asignado).
- **Marcar/desmarcar** estado (Iniciar/Completar/Reabrir) con **cambio de ícono instantáneo** (optimista).
- **Adjuntos multimedia** (una o varias a la vez): botón **"Agregar"** abre un modal con opciones:
  **foto/video desde galería**, **tomar foto** (cámara), **hacer video** (cámara),
  **grabar nota de voz** (micrófono, en la web), **adjuntar nota de voz** y **adjuntar documento**.
  Se muestran en una **cuadrícula uniforme** de miniaturas; al hacer clic se abre un **lightbox**
  (foto/video/audio en grande) con **descargar** y navegación entre elementos. Se pueden eliminar.
- Las **imágenes se comprimen en el navegador** antes de subir (máx. 1600px, JPEG 0.8).
- Los archivos se suben **directo a Storage con URL firmada** (evita el límite de ~4.5MB de Vercel;
  soporta videos/audios hasta **50MB**). En el tracking del cliente también se muestran video y audio.
- Botón **eliminar etapa** ubicado en la esquina inferior derecha (separado, con tinte rojo).

### Seguridad (autorización en API)
- Los endpoints validan rol y pertenencia: un mecánico solo gestiona etapas de sus órdenes asignadas.
- La clave secreta (service role) solo se usa en el servidor.

### WhatsApp
- Los enlaces usan `wa.me`: se envían **desde el celular de quien hace clic** (admin o mecánico),
  al destinatario del enlace. No hay un número emisor fijo (eso requeriría WhatsApp Business API).

---

## Documentos del proyecto (en la raíz)
| Archivo | Contenido |
|---|---|
| `CONTEXTO.md` | Este documento (estado general). |
| `PRODUCCION.md` | Bitácora de puesta en producción (GitHub, Vercel, Supabase). |
| `ACTUALIZAR-PRODUCCION.md` | Cómo subir cambios a producción (`git add/commit/push`). |
| `DNS-DOMINIO.md` | Cómo conectar el dominio (A/CNAME vs nameservers) en Namecheap. |
| `MIGRACION.md` | Cómo migrar a otra cuenta de Supabase y de Vercel. |
| `DEPLOY.md` | Guía original de despliegue. |
| `TECNOLOGIAS.md` | Detalle de la stack. |
| `CREDENCIALES.md` | Credenciales locales (en `.gitignore`, NO se sube). |
| `README.md` | Descripción del proyecto. |

---

## Cómo subir cambios a producción
```bash
git add .
git commit -m "describe el cambio"
git push        # Vercel redespliega solo en ~1 min
```
(Detalle en `ACTUALIZAR-PRODUCCION.md`.)

---

## Pendientes y recomendaciones
- 🔴 **Revocar el token de Vercel** que se compartió durante la configuración:
  https://vercel.com/account/tokens
- ✅ **Hecho:** compresión de imágenes en el navegador antes de subir (acelera subida y tracking).
- 💡 **Opcional:** aumentar el límite de tamaño del bucket `stage-files` en Supabase si se
  necesitan videos de más de 50MB (requiere plan de pago para superar el máximo por archivo).
- 💡 Cambiar la **contraseña del admin** tras el primer login si no se ha hecho.
- Para revisar consumo del plan Claude: comando `/usage`.
