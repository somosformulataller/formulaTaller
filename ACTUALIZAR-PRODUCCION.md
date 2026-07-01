# 🔄 Cómo subir cambios a producción

Tu proyecto está conectado: **GitHub → Vercel**. Cada vez que subes código a la rama `main`,
**Vercel redespliega solo**. No tienes que entrar a Vercel para nada en el día a día.

> Repo: `github.com/somosformulataller/formulaTaller` · Sitio: `https://formula-taller.vercel.app`

---

## El flujo normal (lo que harás casi siempre)

Después de editar y guardar tus archivos en el proyecto, abre una terminal **en la carpeta del proyecto** y corre estos 3 comandos:

```bash
git add .
git commit -m "describe el cambio que hiciste"
git push
```

Eso es todo. En segundos Vercel detecta el push y empieza a desplegar. En ~1 minuto tu cambio
está en vivo en `https://formula-taller.vercel.app` (y en `formulataller.com` cuando el DNS esté listo).

### Qué hace cada comando
- `git add .` → marca **todos** tus cambios para subir.
- `git commit -m "..."` → guarda esos cambios con un mensaje que describe qué hiciste.
- `git push` → los envía a GitHub. **Eso dispara el deploy automático en Vercel.**

> 💡 El mensaje del commit es para ti: pon algo claro como `"arreglo botón de WhatsApp"` o
> `"cambio color del menú"`. Así sabes qué hiciste en cada versión.

---

## Probar ANTES de subir (recomendado)

Para no subir algo roto, prueba en tu computadora primero:

```bash
npm run dev
```

Abre `http://localhost:3000`, revisa que tu cambio se vea bien, y cuando estés conforme,
detén el servidor (Ctrl + C) y haz el `git add / commit / push`.

Opcional, para asegurarte de que compila igual que en Vercel:

```bash
npm run build
```

Si `npm run build` termina sin errores, el deploy en Vercel también pasará.

---

## Ver si el deploy salió bien

1. Entra a [vercel.com](https://vercel.com) → tu proyecto **formula-taller** → pestaña **Deployments**.
2. El de arriba es el más reciente:
   - **Ready** (verde) → ✅ listo, ya está en vivo.
   - **Error** (rojo) → algo falló en el build. Haz clic para ver el log.
3. También puedes abrir el sitio directo y verificar tu cambio.

---

## Casos especiales

### Cambié una variable de entorno (no el código)
Si editaste algo en **Vercel → Settings → Environment Variables**, el push no aplica aquí.
Tienes que hacer **Redeploy** manual:
- Vercel → **Deployments** → menú **··· → Redeploy** del último.
- Si la variable empieza con `NEXT_PUBLIC_`, desmarca **"Use existing build cache"** al redesplegar.

### `git push` me pide usuario/contraseña o da error de permisos
Debes estar autenticada con la cuenta **`somosformulataller`** (la dueña del repo).
Si se abre el navegador, inicia sesión con esa cuenta. Si da error `403 / Permission denied`,
es que estás con otra cuenta de GitHub.

### "nothing to commit" al hacer commit
Significa que no hay cambios nuevos guardados. Asegúrate de **guardar los archivos** en tu editor
antes de correr `git add .`.

---

## Resumen de bolsillo

```bash
# 1. (opcional) probar local
npm run dev

# 2. subir a producción
git add .
git commit -m "describe el cambio"
git push
# → Vercel despliega solo en ~1 min
```
