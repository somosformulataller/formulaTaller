import type { NotifyOffset, ReminderTagColor } from '@/lib/types';

// ============================================================================
// Recordatorios (0023) — helpers compartidos (servidor y navegador)
// ============================================================================

export const TAG_COLORS: ReminderTagColor[] = ['neutral', 'gold', 'green', 'red', 'blue'];

/** Color del punto y de la ficha de cada etiqueta. */
export const TAG_COLOR_HEX: Record<ReminderTagColor, string> = {
  neutral: '#9ca3af',
  gold: '#f59e0b',
  green: '#10b981',
  red: '#ef4444',
  blue: '#3b82f6',
};

export const NOTIFY_OFFSETS: { value: NotifyOffset; label: string }[] = [
  { value: 'mismo_dia', label: 'El mismo día' },
  { value: '3_dias', label: '3 días antes' },
  { value: '7_dias', label: '7 días antes' },
  { value: '1_mes', label: '1 mes antes' },
];

export function notifyLabel(v: NotifyOffset): string {
  return NOTIFY_OFFSETS.find((o) => o.value === v)?.label ?? v;
}

/**
 * Hoy en Venezuela como 'AAAA-MM-DD'. Las fechas de los recordatorios son días
 * sin hora; compararlas con la fecha UTC del servidor adelantaría el aviso
 * cuatro horas cada noche.
 */
export function hoyVE(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Caracas',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

/** '2026-10-05' → 'lun 5 oct 2026' sin que la zona horaria mueva el día. */
export function formatDia(iso: string, conAno = true): string {
  const [y, m, d] = iso.split('-').map(Number);
  const fecha = new Date(Date.UTC(y, m - 1, d, 12));
  return new Intl.DateTimeFormat('es-VE', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    ...(conAno ? { year: 'numeric' } : {}),
    timeZone: 'UTC',
  }).format(fecha);
}

/**
 * Mensaje que el taller le manda al cliente por WhatsApp, en tono cercano,
 * como si lo escribiera el mecánico. Es el de respaldo: normalmente lo redacta
 * la IA a partir del recordatorio (POST /api/reminders/:id/mensaje).
 */
export function mensajeRecordatorio(opts: {
  nombreCliente: string;
  taller: string;
  titulo: string;
  texto?: string | null;
  fecha: string;
}): string {
  const nombre = opts.nombreCliente.trim();
  const partes = [
    `Hola${nombre ? ` ${nombre}` : ''}, espero que estés muy bien. Te escribimos de ${opts.taller} para recordarte: ${opts.titulo.trim()} (para el ${formatDia(opts.fecha)}).`,
  ];
  const texto = (opts.texto ?? '').trim();
  if (texto) partes.push(texto);
  partes.push('Estamos por acá a tu orden, avísanos qué día te queda bien para traer el carro.');
  return partes.join('\n\n');
}
