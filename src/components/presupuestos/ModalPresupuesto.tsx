'use client';

import Modal from '@/components/ui/Modal';
import QuoteForm from '@/components/presupuestos/QuoteForm';
import type { Quote } from '@/lib/presupuestos';

/** «Enviar presupuesto» en una ventana, con el mismo estilo que «Nueva orden». */
export default function ModalPresupuesto({
  abierto,
  quote,
  workshopName,
  onClose,
  onGuardado,
  onCrearOrden,
}: {
  abierto: boolean;
  /** Para editar o reenviar uno ya guardado. */
  quote?: Quote;
  workshopName: string;
  onClose: () => void;
  onGuardado?: (q: Quote) => void;
  onCrearOrden?: (q: Quote) => void;
}) {
  return (
    <Modal isOpen={abierto} onClose={onClose} title={quote ? 'Presupuesto' : 'Enviar presupuesto'}>
      <QuoteForm
        key={quote?.id ?? 'nuevo'}
        enModal
        quote={quote}
        workshopName={workshopName}
        onCerrar={onClose}
        onGuardado={onGuardado}
        onCrearOrden={onCrearOrden}
      />
    </Modal>
  );
}
