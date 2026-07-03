# ❓ Preguntas y respuestas — Formula Taller

Documento de referencia sobre instalación (PWA), actualizaciones, entornos, estado del
proyecto, seguridad y aspectos legales. Última actualización: **2026-07-02**.

---

## 1. ¿La PWA ya se puede descargar/instalar en el celular?

**Sí.** El proyecto ya es una PWA instalable:

- Tiene `manifest.webmanifest` (nombre, íconos 192/512, modo `standalone`, colores) y
  un **service worker** (`public/sw.js`) que se registra en producción.
- En **Android/Chrome**: al abrir `https://formulataller.com` aparece la opción **"Instalar app" / "Agregar a pantalla de inicio"** (menú ⋮ o un aviso automático).
- En **iPhone/Safari**: botón **Compartir → "Agregar a inicio"**.
- Una vez instalada, se abre a pantalla completa (sin barra del navegador), como una app.

> ⚠️ Detalle: hoy la instalación depende del **aviso nativo del navegador**. No hay un botón
> propio dentro de la web que diga "Instalar app". Se puede agregar un botón/guía de instalación
> para que sea más obvio para los talleres (mejora sencilla, recomendada).

---

## 2. ¿Los cambios llegan a los usuarios existentes? / actualizaciones de la web app

**Sí, los cambios SÍ llegan automáticamente** — no hace falta reenviar nada ni pasar por una
tienda de apps. Así funciona:

- Al hacer `git push` a producción, **Vercel redespliega** y publica la versión nueva.
- El service worker está configurado en modo **"network-first"** para el HTML y **no cachea** los
  archivos de build (`/_next/`). Eso significa que, **la próxima vez que el usuario abre o recarga
  la app, obtiene la versión nueva** automáticamente.
- Si el service worker mismo cambia, además fuerza una recarga de las pestañas abiertas para
  auto-curarse.

**¿Por qué a veces parece que no se actualizó?** Porque si el usuario tiene la PWA **abierta** y no
la recarga/reabre, sigue viendo la versión vieja hasta que la vuelva a abrir. No existe (todavía)
un "empujón" que actualice una app abierta en segundo plano.

**Mejora recomendada (sencilla):** agregar un aviso dentro de la app tipo _"Hay una nueva versión
disponible, toca para actualizar"_ que aparezca automáticamente cuando se detecta un despliegue
nuevo. Así el usuario se entera al instante sin tener que recargar manualmente. *(Se puede
implementar cuando quieras.)*

---

## 3. Si la PWA se descarga, ¿cómo se envían actualizaciones después? ¿De cualquier tipo?

- **Cómo:** igual que siempre — `git push` → Vercel despliega → los usuarios reciben la versión
  nueva al reabrir/recargar. **No** se pasa por Google Play ni App Store, **no** hay revisión ni
  demoras de aprobación.
- **¿De cualquier tipo?** Sí para todo lo que sea **web**: cambios de interfaz, nuevas funciones,
  correcciones de errores, textos, estilos, lógica, base de datos, etc. Todo se actualiza por deploy.
- **Límites:** no se puede forzar la actualización de una app **abierta** sin que el usuario
  recargue (ver punto 2). Cambios de **ícono o nombre** de la app instalada a veces requieren
  reinstalar para verse reflejados en algunos teléfonos. No se accede a funciones nativas del
  celular más allá de las APIs web (cámara, micrófono, notificaciones web, etc. sí están disponibles).

---

## 4. Entorno de desarrollo, variables de entorno y despliegue a todos los clientes

**¿Puedo tener un ambiente de desarrollo antes de enviar a producción, sin pagar?** → **Sí.**

- **Vercel (plan gratuito):** ya incluye **Preview Deployments**. Cada rama o Pull Request genera
  una **URL de prueba propia** (ej. `formula-taller-git-develop.vercel.app`) separada de producción.
  Ahí puedes probar los cambios antes de mandarlos a `main`.
- **Supabase:** lo recomendable es crear un **segundo proyecto de Supabase para desarrollo**
  (base de datos aparte), así las pruebas no tocan los datos reales. El plan gratuito permite tener
  un proyecto adicional (ten en cuenta que los proyectos gratuitos **se pausan tras ~1 semana de
  inactividad**; se reactivan al entrar).

**¿A las variables de entorno de producción les puedo agregar la opción de desarrollo?** → **Sí.**
En Vercel cada variable puede tener **valores distintos por entorno**: `Production`, `Preview` y
`Development`. Se agregan las mismas claves (URL de Supabase, keys, `NEXT_PUBLIC_SITE_URL`) con los
valores del **Supabase de desarrollo** para Preview/Development, y los de producción para Production.

**Flujo recomendado (gratis):**
1. Trabajas en una rama `develop` → Vercel crea una Preview con el Supabase de pruebas.
2. Verificas que todo funciona en la Preview.
3. Haces merge a `main` → se publica a producción con el Supabase real.

**¿Todos los cambios que envío a producción están disponibles para todos los clientes?** → **Sí.**
Es **una sola aplicación compartida** por todos los talleres (multi-tenant). Un cambio en producción
actualiza la app para **todos los talleres a la vez**. Lo que está aislado por taller son los
**datos** (cada uno ve solo lo suyo), **no el código**: la funcionalidad es la misma para todos.

---

## 5. ¿El proyecto está óptimo? ¿Código y arquitectura optimizados?

**Estado general: bueno y ordenado para la etapa actual (MVP/lanzamiento), con puntos claros de
mejora para cuando crezca.** Es honesto decir que está **listo para producción a pequeña escala**,
pero **no "totalmente optimizado" para gran escala**.

**Fortalezas ✅**
- Arquitectura clara: separación servidor/cliente (Next.js App Router), autorización centralizada
  (`lib/api-auth.ts`), componentes reutilizables.
- Aislamiento multi-taller explícito + RLS por taller como segunda capa.
- Subida de archivos **directa a Storage** (evita límites del servidor, soporta videos).
- Compresión de imágenes en el navegador.
- Build y tipos (TypeScript) sin errores.

**Puntos a mejorar 🔧**
- `listMechanicsWithEmail` trae **todos** los usuarios de Auth en cada consulta (poco eficiente al
  crecer; conviene optimizar).
- **Sin pruebas automatizadas** (tests) — todo se valida a mano.
- **Sin límite de peticiones (rate limiting)** ni CAPTCHA en endpoints públicos (registro, tracking).
- **Sin monitoreo de errores** (ej. Sentry) para enterarte de fallos en producción.
- Estilos mayormente **inline** (funciona, pero es más difícil de mantener que Tailwind consistente).
- Los **archivos en Storage no se limpian** al eliminar una cuenta/orden (quedan huérfanos).
- El bucket de archivos es **público** (ver punto 7).

> Conclusión: la base es sólida y correcta; las mejoras de arriba son de **escalabilidad y robustez**,
> no arreglos urgentes.

---

## 6. Lista de mejoras para cuando tengamos planes pagos de Vercel y Supabase

### Habilitadas por **Supabase Pro**
- 🔒 **Backups diarios automáticos** y **recuperación a un punto en el tiempo** (hoy no hay backups).
- ⏰ **El proyecto ya no se pausa** por inactividad.
- 📧 **Correo confiable (SMTP propio)** → habilitar **verificación de email** al registrarse y
  **recuperación de contraseña** ("olvidé mi contraseña").
- 🎥 **Archivos más grandes** (subir videos de más de 50 MB) y más almacenamiento/ancho de banda.
- 👥 Más usuarios, más base de datos, réplicas de lectura.

### Habilitadas por **Vercel Pro**
- 📈 **Analytics** de uso y rendimiento.
- 🔐 **Previews protegidas por contraseña** (para mostrar cambios a clientes sin exponerlos).
- ⚙️ Funciones con **más tiempo/tamaño**, más ancho de banda y builds más rápidos.

### Mejoras de producto/código (algunas no requieren plan pago, otras se potencian con él)
- 💳 **Integrar pago real de suscripción** (ej. Stripe/MercadoPago) para automatizar el límite de
  órdenes en vez de subir `order_limit` a mano.
- 🔔 **Notificaciones push web** (avisar al cliente/mecánico sin depender solo de WhatsApp).
- ⚡ **Tiempo real** (Supabase Realtime): que el tracking del cliente se actualice solo, sin recargar.
- 🖼️ **Miniaturas/optimización de imágenes** y video (cargas aún más rápidas).
- 🧹 **Limpieza de archivos huérfanos** en Storage al borrar cuentas/órdenes.
- 🛡️ **Rate limiting + CAPTCHA** en registro y endpoints públicos (anti-spam).
- 🐞 **Monitoreo de errores** (Sentry) y logs.
- ✅ **Pruebas automatizadas** y un **entorno de staging** estable.
- 🔄 **Aviso de "nueva versión disponible"** dentro de la app.
- 🌐 Panel de **superadmin** para administrar talleres/suscripciones desde un solo lugar.

---

## 7. Seguridad — ¿cómo está el proyecto?

**Estado: razonable para un MVP, con puntos a endurecer antes de escalar.**

**Bien ✅**
- Autenticación con Supabase; **RLS activado y por taller** (defensa en profundidad).
- Autorización centralizada y **aislamiento de datos entre talleres** verificado en el código.
- La **clave secreta** (service role) se usa **solo en el servidor**, nunca en el navegador.
- El tracking del cliente usa un **token aleatorio (UUID)** imposible de adivinar.
- La app está marcada **`noindex`** (no aparece en buscadores).

**A endurecer 🔧**
- 🌐 **Registro abierto sin CAPTCHA ni verificación de correo** → riesgo de registros de spam/abuso.
- 🗑️ **Eliminar cuenta** solo pide escribir el nombre del taller (no la contraseña) → si alguien
  toma una sesión abierta, podría borrar datos. Recomendable **pedir la contraseña** antes de borrar.
- 📂 El bucket de archivos (`stage-files`) es **público**: cualquiera con la URL exacta puede ver un
  adjunto. Las URLs son difíciles de adivinar, pero para documentos sensibles conviene migrar a
  **acceso privado con URLs firmadas** temporales.
- 🚦 **Sin rate limiting** en endpoints (login, registro, tracking) → posible fuerza bruta/abuso.
- 🔑 Contraseña mínima de **6 caracteres** (se puede exigir más fuerza).
- 🧪 Archivos subidos **no se escanean** (antivirus).

> Ninguno es una brecha crítica hoy, pero **rate limiting + CAPTCHA + verificación de email +
> re-autenticación para acciones destructivas + Storage privado** son los pasos naturales de
> endurecimiento a medida que entren más talleres.

---

## 8. Términos y condiciones y documentos legales

**Sí, se deberían agregar.** El proyecto maneja **datos personales** (nombres y WhatsApp de clientes,
datos de vehículos, correos de usuarios), así que los documentos legales no son opcionales a medida
que crezca. Recomendado:

1. **Términos y Condiciones** (uso del servicio, responsabilidades, límites del plan, suscripción).
2. **Política de Privacidad** (qué datos se guardan, para qué, con quién se comparten —incluido
   WhatsApp—, cuánto se conservan y cómo se eliminan). **Es el más importante.**
3. **Política de Cookies** (la app usa cookies de sesión) — suele incluirse dentro de la de privacidad.
4. **Aviso / acuerdo de tratamiento de datos**: como el taller carga datos de **sus** clientes,
   conviene dejar claro que el taller es el responsable de esos datos y Formula Taller el proveedor.

**Cómo hacerlo de forma sencilla:**
- Usar un **generador** de documentos legales (ej. *Termly*, *iubenda*, *GetTerms*, *Enzuzo*) — tienen
  planes gratuitos/económicos y generan los textos base en español.
- O partir de **plantillas** y, si el negocio crece, hacerlas revisar por un abogado.

**Cómo implementarlo en la app (fácil):**
- Crear dos páginas simples: `/terminos` y `/privacidad` (rutas públicas que muestran el texto).
- Enlazarlas en el **pie de página** del login/registro y del tracking.
- En el **formulario de registro**, agregar un **checkbox obligatorio**: _"Acepto los Términos y la
  Política de Privacidad"_, y **guardar la fecha de aceptación** del taller.
- (Opcional) Mostrar un aviso de cookies breve la primera vez.

> Se puede implementar en poco tiempo: las páginas + el checkbox de aceptación + guardar la fecha.
> Avísame y lo dejo listo (con textos base que luego puedes ajustar/hacer revisar).

---

## Resumen rápido

| Pregunta | Respuesta corta |
|---|---|
| ¿Se instala en el celular? | **Sí**, ya es PWA instalable (Android e iPhone). |
| ¿Llegan las actualizaciones a los usuarios? | **Sí**, automáticamente al reabrir/recargar (se puede agregar aviso de nueva versión). |
| ¿Cómo se actualiza? ¿De cualquier tipo? | Por `git push` → Vercel; sí, cualquier cambio web, sin tiendas de apps. |
| ¿Ambiente de desarrollo sin pagar? | **Sí**: Previews de Vercel + Supabase de pruebas; variables por entorno. |
| ¿Los cambios aplican a todos los clientes? | **Sí**, código compartido; datos aislados por taller. |
| ¿Está óptimo? | Bueno para MVP; mejoras claras de escala/robustez pendientes. |
| ¿Seguridad? | Razonable; endurecer registro, borrado, Storage y rate limiting. |
| ¿Documentos legales? | Sí: Términos + Privacidad (+cookies); usar generador y páginas `/terminos` y `/privacidad`. |

Qué apliqué (gratis, sin plan pago)

1. Páginas legales: /terminos y /privacidad con texto base en español (revísalo/ajústalo a tu negocio). Enlazadas en el footer del login.
2. Aceptación en el registro: checkbox obligatorio "Acepto los Términos y la Política de Privacidad" — el botón "Crear taller" queda deshabilitado hasta marcarlo.
3. Botón "Instalar app": aparece automáticamente en el login cuando el navegador (Android/Chrome) ofrece instalar la PWA. En iPhone no aparece porque ahí se instala desde Compartir → "Agregar a inicio".

Lo que dejé para después (más adelante / requieren más trabajo o planes pagos)

- Aviso in-app de "nueva versión disponible".
- Endurecimiento de seguridad (rate limiting, CAPTCHA, Storage privado, pedir contraseña para borrar cuenta).
- Verificación de correo / recuperar contraseña (necesita SMTP).
- Pago real de suscripción (Stripe), backups, monitoreo, etc.
