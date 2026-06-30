'use client';

import { cn } from '@/lib/utils';
import type { OrderStatus } from '@/lib/types';
import { ORDER_STATUS_LABELS } from '@/lib/utils';

interface BadgeProps {
  status: OrderStatus;
  className?: string;
}

const STATUS_STYLES: Record<OrderStatus, string> = {
  sin_mecanico: 'badge badge-neutral',
  con_mecanico: 'badge badge-warning',
  lista: 'badge badge-success',
};

export default function Badge({ status, className }: BadgeProps) {
  return (
    <span className={cn(STATUS_STYLES[status], className)}>
      {ORDER_STATUS_LABELS[status]}
    </span>
  );
}
