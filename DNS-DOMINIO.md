# 🌐 Conectar el dominio `formulataller.com` a Vercel

Guía de los **dos métodos** para apuntar tu dominio (comprado en **Namecheap**) al sitio en Vercel.
Elige **solo uno**. Estado actual: dominio **verificado** en Vercel, falta configurar el DNS.

---

## Resumen rápido — ¿cuál elegir?

| | **Método A/CNAME** (recomendado) | **Método Nameservers** |
|---|---|---|
| ¿Quién maneja el DNS? | Namecheap | Vercel |
| ¿Afecta el correo del dominio (MX)? | **No, queda intacto** | Sí — habría que recrear los MX dentro de Vercel |
| Qué cambias | Solo 2 registros del sitio | Mueves TODO el DNS a Vercel |
| Nameservers de Namecheap | Se quedan igual (BasicDNS) | Se cambian a los de Vercel |
| Parecido a... | — | Lo que hacías con HostGator/GoDaddy |

➡️ **Si te importa el correo del dominio (ahora o a futuro), usa A/CNAME.** Es lo contrario al de
nameservers: con A/CNAME el correo NO se toca; con nameservers tendrías que migrarlo.

---

## Método 1 — A/CNAME (recomendado, no afecta el correo)

Los nameservers se quedan en Namecheap; solo apuntas dos registros del sitio web.

**Namecheap → Domain List → Manage `formulataller.com` → pestaña Advanced DNS → Host Records:**

1. **Borra solo** estos (son del parking, no del correo):
   - el registro `A` con Host `@` que apunta a `162.255.119.207`
   - cualquier "URL Redirect Record" o `CNAME` con Host `www` por defecto de Namecheap
2. **Agrega** estos dos:

| Type | Host | Value | TTL |
|---|---|---|---|
| **A Record** | `@` | `216.198.79.1` | Automatic |
| **CNAME Record** | `www` | `cname.vercel-dns.com.` | Automatic |

> Valor alternativo válido para el A Record: `76.76.21.21` (la IP clásica de Vercel).
> Namecheap no permite CNAME en la raíz, por eso la raíz va por A Record.

3. Los **nameservers de Namecheap los dejas como están** (Namecheap BasicDNS). NO los toques.

### ⚠️ Importante para el correo
**NO borres** ningún registro **MX** ni los **TXT** de correo. Esos son del email del dominio
y con este método quedan intactos. Solo quitas el `A @` del parking y el redirect por defecto.

---

## Método 2 — Nameservers (mueve todo el DNS a Vercel)

Es el método tipo HostGator/GoDaddy. Le entregas la gestión completa del DNS a Vercel.

**Namecheap → Domain List → Manage `formulataller.com` → sección NAMESERVERS:**

1. Cambia de "Namecheap BasicDNS" a **Custom DNS**.
2. Escribe los dos nameservers de Vercel:
   ```
   ns1.vercel-dns.com
   ns2.vercel-dns.com
   ```
3. Guarda (✓ verde).

Con este método **NO** se usan los registros A/CNAME: Vercel gestiona todo y emite el SSL solo.

### ⚠️ Importante para el correo
Al mover los nameservers, **Vercel controla TODO el DNS**. Si usas (o vas a usar) correo con tu
dominio (`algo@formulataller.com`), tendrás que **recrear los registros MX dentro de Vercel**.
Tu correo actual es `@gmail.com`, así que hoy no te afecta, pero tenlo en cuenta a futuro.

---

## Después de configurar (cualquiera de los dos métodos)

1. Espera la propagación (A/CNAME: minutos a un par de horas · Nameservers: hasta 24–48 h).
2. Vercel detecta el cambio y **emite el certificado SSL automáticamente**.
3. En Vercel → Settings → Environment Variables → `NEXT_PUBLIC_SITE_URL` = `https://formulataller.com` → Redeploy.
4. En Supabase → Auth → URL Configuration → Site URL y Redirect URLs con `https://formulataller.com/**`.

---

## Datos de referencia (de la API de Vercel)

- Dominio: `formulataller.com` — **verified: true**, serviceType: external, misconfigured: true (falta DNS).
- Nameservers actuales (Namecheap): `dns1.registrar-servers.com`, `dns2.registrar-servers.com`
- Nameservers de Vercel (si usas Método 2): `ns1.vercel-dns.com`, `ns2.vercel-dns.com`
- Registros A/CNAME (si usas Método 1): A `@` → `216.198.79.1` · CNAME `www` → `cname.vercel-dns.com.`
- Sitio en producción ya funcionando: `https://formula-taller.vercel.app`
