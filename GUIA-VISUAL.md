# 🎨 Guía visual — Formula Taller

Reglas de diseño e interfaz para mantener una **línea visual estable y consistente** en toda la app.
Última actualización: **2026-07-04**.

> **Principio central:** todo debe verse **acorde a la app**. No se cambia el aspecto de los
> componentes existentes ni se usan controles **nativos** del sistema. Ante una necesidad de UI,
> **se reutiliza** un componente que ya existe; solo si no existe se crea uno **nuevo que respete
> esta misma línea visual**.

---

## ✅ Reglas (obligatorias)

1. **No usar controles nativos del sistema a nivel visual.**
   - ❌ `<select>` nativo (abre el *picker* del sistema / "popup").
     ✅ Usar el desplegable propio de la app (**`MechanicSelect`** o un dropdown con las clases
     `.select-menu` / `.select-option`).
   - ❌ Campos de teléfono sueltos. ✅ **`PhoneInput`** (selector de país + número).
   - ❌ `alert()`/`confirm()` para flujos importantes cuando exista un **`Modal`** apropiado.
     *(Se toleran para confirmaciones simples ya existentes, pero preferir `Modal` en UI nueva.)*
2. **No cambiar el aspecto de los componentes existentes.** Si un componente compartido ya define
   un estilo (botón, tarjeta, badge, dropdown…), se usa **tal cual**. No se crean variantes visuales
   paralelas para lo mismo.
3. **Reutilizar antes de crear.** Antes de escribir UI nueva, buscar si ya existe el componente
   (ver "Componentes reutilizables"). Si hay que crear uno, debe:
   - Usar las **variables de diseño** (colores, radios) — nunca colores "a mano" fuera de la paleta.
   - Seguir el **mismo lenguaje** (tarjetas, espaciados, tipografía, iconografía Lucide).
   - Quedar **reutilizable** (props claras) si se va a usar en más de un lugar.
4. **Una sola fuente de verdad por patrón.** Un mismo patrón (ej. elegir mecánico) se implementa
   **una vez** en un componente compartido y se reutiliza; no se duplica con estilos distintos.
5. **Consistencia de comportamiento:** mismos íconos, mismos textos de acción y misma ubicación para
   la misma acción en distintas pantallas.

---

## 🎯 Tokens de diseño (usar SIEMPRE estas variables)

**Tipografía:** `Inter` (300–800). Fondo oscuro, texto claro.

**Colores (CSS variables en `globals.css`):**
- **Acento / marca:** `--color-brand-400` (#fbbf24) y `--color-brand-500` (#f59e0b) — ámbar.
- **Fondos:** `--color-bg` (#0D0F1A), `--color-surface` (#13151f), `--color-surface-2` (#1a1d2e),
  `--color-surface-3` (#21253a).
- **Bordes:** `--color-border` (blanco al 7%).
- **Texto:** `--color-text-primary` (#f0f2ff), `--color-text-secondary` (#8b8fa8),
  `--color-text-muted` (#545870).
- **Estados:** éxito `#10b981` (verde), advertencia/marca `#f59e0b`, peligro `--color-danger` (#ef4444).
- **WhatsApp:** verde `#25D366` (fondo `rgba(37,211,102,0.12)`).

**Radios:** `--border-radius` (14px, tarjetas), `--border-radius-sm` (8px, botones/inputs),
`--border-radius-lg` (20px). **Nunca** valores arbitrarios sueltos si hay una variable.

**Regla de oro:** si necesitas un color o medida, usa una **variable existente**. No introduzcas
colores hex nuevos fuera de la paleta.

---

## 🧩 Componentes reutilizables (qué usar para cada necesidad)

| Necesito… | Uso este componente | Dónde vive |
|---|---|---|
| Botón | **`Button`** (`variant`: primary/secondary/danger/ghost; `size`; `fullWidth`; `loading`) | `components/ui/Button.tsx` |
| Campo de texto | **`Input`** (label, icon, error) | `components/ui/Input.tsx` |
| Elegir de una lista (estado, etc.) | **`Select`** (lista propia; `options`, `compact`, `float`) | `components/ui/Select.tsx` |
| Elegir mecánico | **`MechanicSelect`** (capa sobre `Select`; `compact`, `float`, `includeNone`) | `components/orders/MechanicSelect.tsx` |
| Teléfono con código de país | **`PhoneInput`** | `components/ui/PhoneInput.tsx` |
| Ventana / diálogo | **`Modal`** | `components/ui/Modal.tsx` |
| Etiqueta de estado | **`Badge`** | `components/ui/Badge.tsx` |
| Galería/visor de adjuntos | **`AttachmentGallery`** (cuadrícula + lightbox) | `components/orders/AttachmentGallery.tsx` |
| Menú para adjuntar archivos | **`AttachmentPicker`** | `components/orders/AttachmentPicker.tsx` |
| Copiar un enlace | **`CopyLinkButton`** | `components/orders/CopyLinkButton.tsx` |
| Tarjeta de orden | **`OrderCard`** | `components/orders/OrderCard.tsx` |
| Navegación inferior / barra superior | **`BottomNav`** / **`TopBar`** | `components/layout/` |

**Clases utilitarias (en `globals.css`):** `card`, `form-input`, `form-field`, `form-label`,
`btn` + `btn-*`, `select-menu`, `select-option`, `empty-state`, `animate-fade-in`, `glass`.
Preferir estas clases antes que estilos inline nuevos para lo mismo.

---

## 🖼️ Especificaciones por patrón

- **Tarjetas (`card`):** contenedor base, fondo `--color-surface`, borde sutil, radio 14px.
- **Botones (`Button`):** ámbar = acción principal; gris = secundaria; rojo = destructiva; ghost = ícono.
  Ícono Lucide + texto. En modales, si dos acciones no caben lado a lado, **apilar verticalmente**.
- **Desplegables (elegir de una lista):** SIEMPRE lista propia (`.select-menu`), fondo `--color-surface-2`,
  opción resaltada con `--color-surface-3`, ✔ ámbar en la seleccionada. Flecha `ChevronDown` que rota al abrir.
- **Badge de estado:** píldora — gris "Sin mecánico", ámbar "En progreso", verde "Vehículo listo".
- **Interruptor (toggle):** switch estilo móvil; ámbar encendido, gris apagado.
- **Botón/enlace de WhatsApp:** píldora verde `#25D366` con ícono de mensaje.
- **Adjuntos:** cuadrícula de miniaturas cuadradas uniformes; al tocar, visor (lightbox) a pantalla completa.
- **Iconografía:** **Lucide** en toda la app (tamaños ~13–22px). No mezclar sets de íconos.
- **Animación de entrada:** `animate-fade-in` / `animate-slide-up` para bloques que aparecen.

---

## 🚫 Antipatrones (no hacer)

- Usar `<select>` nativo, date/color pickers nativos u otros controles del sistema para UI visible.
- Crear un segundo botón/tarjeta/dropdown con estilo distinto para algo que ya tiene componente.
- Colores hex nuevos fuera de la paleta, o radios/espaciados "a ojo" cuando hay variable.
- Duplicar un patrón (copiar-pegar un dropdown) en vez de extraer un componente compartido.
- Cambiar el look de un componente compartido "solo para esta pantalla".

---

## 🔍 Checklist antes de subir UI nueva

1. ¿Existe ya un componente para esto? → **Reutilízalo**.
2. Si creé algo nuevo: ¿usa las **variables de diseño** y el mismo lenguaje visual?
3. ¿Evité **controles nativos** (select, pickers)? ¿Usé el dropdown/list propio?
4. ¿Se ve **igual** que el resto de la app (tarjetas, botones, tipografía, íconos)?
5. ¿Es **reutilizable** si aplica en más de un sitio?
6. ¿Probé en **móvil** (la app es PWA, mobile-first)?

> Contexto general en `CONTEXTO.md` · perfiles y pantallas en `PERFILES.md` · caché en `CACHE.md`.
