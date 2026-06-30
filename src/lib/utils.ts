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

export function buildTrackingMessage(
  clientName: string,
  token: string,
  siteUrl: string
): string {
  const url = `${siteUrl}/tracking/${token}`;
  return (
    `Hola ${clientName}! 🔧 Tu vehículo está en Formula Taller.\n\n` +
    `Puedes hacer seguimiento a tu orden aquí:\n${url}\n\n` +
    `¡Cualquier duda estamos a tu disposición!`
  );
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

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}
