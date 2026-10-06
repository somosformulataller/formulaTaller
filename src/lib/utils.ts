import type { OrderStatus, StageStatus } from './types';

// ============================================================================
// Date / time
// ============================================================================
export function formatDate(dateStr: string): string {
  return new Intl.DateTimeFormat('es-VE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(dateStr));
}

export function formatDateShort(dateStr: string): string {
  return new Intl.DateTimeFormat('es-VE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(dateStr));
}

// ============================================================================
// WhatsApp
// ============================================================================
export function buildWhatsAppLink(phone: string, message: string): string {
  const clean = phone.replace(/\D/g, '');
  const encoded = encodeURIComponent(message);
  return `https://wa.me/${clean}?text=${encoded}`;
}

// Opens WhatsApp using the right target for the device.
// - Mobile: `wa.me` opens the installed app directly.
// - Desktop: go straight to WhatsApp Web (`web.whatsapp.com/send`), which
//   avoids the `wa.me` landing page that often hangs "loading" on a computer.
// Called from a click handler (browser only), so `navigator` is available.
export function openWhatsApp(phone: string, message: string): void {
  const clean = phone.replace(/\D/g, '');
  const encoded = encodeURIComponent(message);
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
  const url = isMobile
    ? `https://wa.me/${clean}?text=${encoded}`
    : `https://web.whatsapp.com/send?phone=${clean}&text=${encoded}`;
  window.open(url, '_blank', 'noopener,noreferrer');
}

// Los mensajes al cliente van en tono cercano, como si los escribiera el
// mecánico o el dueño del taller, no una empresa.

/** «tu Corolla» o, si no se sabe el modelo, «tu carro». */
function tuCarro(carModel?: string | null): string {
  const m = (carModel ?? '').trim();
  return m ? `tu ${m}` : 'tu carro';
}

export function buildTrackingMessage(
  clientName: string,
  token: string,
  siteUrl: string,
  workshopName = 'nuestro taller',
  carModel?: string | null
): string {
  const url = `${siteUrl}/tracking/${token}`;
  return (
    `Hola ${clientName}, ¿cómo estás? Te escribimos de ${workshopName}. Ya tenemos ${tuCarro(carModel)} con nosotros y vamos a estar pendientes de todo.\n\n` +
    `Por aquí puedes ver cómo va el trabajo, paso a paso:\n${url}\n\n` +
    `Cualquier duda nos escribes por acá, estamos a tu orden.`
  );
}

// Message sent to the client about how a specific service stage is going.
// `isFinal` = it's the last stage of the service (e.g. "Vehículo listo").
export function buildStageReminderMessage(
  clientFirstName: string,
  stageName: string,
  status: StageStatus,
  token: string,
  siteUrl: string,
  isFinal = false,
  carModel?: string | null
): string {
  const url = `${siteUrl}/tracking/${token}`;
  const name = clientFirstName;
  const carro = tuCarro(carModel);

  if (isFinal && status === 'done') {
    return (
      `Hola ${name}, ¡buenas noticias! ${carro.charAt(0).toUpperCase()}${carro.slice(1)} ya está listo. Terminamos todo el trabajo y puedes pasar a buscarlo cuando quieras.\n\n` +
      `Aquí puedes ver el detalle de lo que le hicimos:\n${url}\n\n` +
      `Avísanos a qué hora vienes y te esperamos.`
    );
  }
  if (status === 'done') {
    return (
      `Hola ${name}, ¿cómo estás? Te cuento que ya terminamos «${stageName}» en ${carro}. Vamos avanzando bien.\n\n` +
      `Puedes ver cómo va todo aquí:\n${url}\n\n` +
      `Cualquier cosa, estamos a tu orden.`
    );
  }
  if (status === 'in_progress') {
    return (
      `Hola ${name}, ¿cómo estás? Te cuento que ya estamos trabajando en «${stageName}» de ${carro}. Apenas tengamos novedades te avisamos.\n\n` +
      `Aquí puedes seguir el avance:\n${url}`
    );
  }
  return (
    `Hola ${name}, ¿cómo estás? Te aviso que el siguiente paso con ${carro} es «${stageName}» y estamos por empezarlo.\n\n` +
    `Aquí puedes seguir el avance:\n${url}\n\n` +
    `Cualquier duda, nos escribes.`
  );
}

export function buildCredentialsMessage(
  name: string,
  email: string,
  password: string,
  siteUrl: string,
  workshopName = 'el taller'
): string {
  return (
    `Hola ${name}! Estos son tus datos de acceso a ${workshopName}:\n\n` +
    `Usuario: ${email}\n` +
    `Contraseña: ${password}\n\n` +
    `Ingresa aquí:\n${siteUrl}/login\n\n` +
    `Por seguridad, cambia tu contraseña después del primer ingreso.`
  );
}

export function buildCredentialsText(
  email: string,
  password: string,
  siteUrl: string
): string {
  return `Usuario: ${email}\nContraseña: ${password}\nAcceso: ${siteUrl}/login`;
}

// ============================================================================
// Order status labels
// ============================================================================
export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  sin_mecanico: 'Sin mecánico',
  con_mecanico: 'En progreso',
  lista: 'Vehículo listo',
};

export const ORDER_STATUS_COLORS: Record<
  OrderStatus,
  { bg: string; text: string; dot: string }
> = {
  sin_mecanico: {
    bg: 'bg-ink-800',
    text: 'text-ink-200',
    dot: 'bg-ink-400',
  },
  con_mecanico: {
    bg: 'bg-amber-900/40',
    text: 'text-amber-300',
    dot: 'bg-amber-400',
  },
  lista: {
    bg: 'bg-emerald-900/40',
    text: 'text-emerald-300',
    dot: 'bg-emerald-400',
  },
};

// ============================================================================
// Stage status labels
// ============================================================================
export const STAGE_STATUS_LABELS: Record<StageStatus, string> = {
  pending: 'Pendiente',
  in_progress: 'En progreso',
  done: 'Completado',
};

// ============================================================================
// Misc
// ============================================================================
export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}

// Turns a workshop name into a URL-friendly slug (accents removed).
export function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip accents
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}
