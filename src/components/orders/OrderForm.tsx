'use client';

import { useEffect, useState } from 'react';
import type { Order, Profile, Mechanic, CreateOrderPayload, OrderStage } from '@/lib/types';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import PhoneInput from '@/components/ui/PhoneInput';
import SubscriptionModal from '@/components/orders/SubscriptionModal';
import AttachmentPicker from '@/components/orders/AttachmentPicker';
import MechanicSelect from '@/components/orders/MechanicSelect';
import { cambioDeAsignacion, valorDeAsignacion } from '@/lib/asignacion';
import MechanicForm from '@/components/mechanics/MechanicForm';
import BudgetList, { totalDe, type Renglon } from '@/components/orders/BudgetList';
import { uploadStageAttachment } from '@/lib/attachments';
import { formatUsd, parseAmount } from '@/lib/budget';
import {
  User,
  Car,
  Plus,
  X,
  Mic,
  Receipt,
  Video as VideoIcon,
  FileText,
} from 'lucide-react';

interface OrderFormProps {
  mechanics: Profile[];
  order?: Order; // if editing
  onSuccess: (order: Order) => void;
  onCancel: () => void;
  /** Solo el admin puede crear mecánicos: habilita la opción "Agregar mecánico". */
  canCreateMechanic?: boolean;
  /** Nombre del taller (para el mensaje de credenciales del mecánico nuevo). */
  workshopName?: string;
  /** Se llama al crear un mecánico, para que el padre actualice su lista compartida. */
  onMechanicCreated?: (m: Mechanic) => void;
  /**
   * Si quien usa el formulario puede decidir el mecánico de la orden. Solo el
   * administrador (0019). Con `false` no se muestra el selector Y no se manda
   * `assigned_mechanic_id`: el endpoint lo rechazaría con un 403 y el mecánico
   * vería un error al guardar un cambio que ni siquiera pidió.
   */
  canAssign?: boolean;
}

const EMPTY: CreateOrderPayload = {
  client_first_name: '',
  client_last_name: '',
  client_whatsapp: '',
  car_model: '',
  assigned_mechanic_id: null,
  notes: '',
};

interface PendingFile {
  file: File;
  url: string | null; // object URL for image previews
}

export default function OrderForm({
  mechanics,
  order,
  onSuccess,
  onCancel,
  canCreateMechanic = false,
  workshopName,
  onMechanicCreated,
  canAssign = true,
}: OrderFormProps) {
  const isEdit = !!order;
  // Lista local de mecánicos: al crear uno nuevo desde aquí, se agrega y se selecciona.
  const [mechanicsList, setMechanicsList] = useState<Profile[]>(mechanics);
  const [showAddMechanic, setShowAddMechanic] = useState(false);
  const [form, setForm] = useState<CreateOrderPayload>(
    order
      ? {
          client_first_name: order.client_first_name,
          client_last_name: order.client_last_name,
          client_whatsapp: order.client_whatsapp,
          car_model: order.car_model,
          assigned_mechanic_id: order.assigned_mechanic_id,
          show_workshop_as_mechanic: order.show_workshop_as_mechanic,
          notes: order.notes ?? '',
        }
      : { ...EMPTY }
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paywall, setPaywall] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingFile[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [phase, setPhase] = useState<'idle' | 'creating' | 'uploading' | 'budget'>('idle');
  const [showBudget, setShowBudget] = useState(false);
  // Al CREAR, la orden todavía no existe, así que el presupuesto se arma aquí
  // en memoria y se manda entero apenas hay order_id. Al EDITAR no hace falta:
  // la lista se guarda sola contra la orden (ver BudgetList).
  const [budget, setBudget] = useState<Renglon[]>([]);
  const [budgetTotal, setBudgetTotal] = useState(0);

  // Release image preview URLs when the form unmounts.
  useEffect(() => {
    return () => {
      pending.forEach((p) => p.url && URL.revokeObjectURL(p.url));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Al editar, el presupuesto ya vive en la base: se pide el total para
  // poder mostrarlo en el botón sin tener que abrir la lista.
  useEffect(() => {
    if (!order) return;
    let vivo = true;
    (async () => {
      try {
        const res = await fetch(`/api/orders/${order.id}/budget`, { cache: 'no-store' });
        if (!res.ok) return;
        const items: Array<{ amount: number }> = await res.json();
        if (!vivo) return;
        setBudgetTotal(items.reduce((a, i) => a + Math.round(Number(i.amount) * 100), 0) / 100);
      } catch {
        /* sin total en el botón; la lista se abre igual */
      }
    })();
    return () => {
      vivo = false;
    };
  }, [order]);

  function set(field: keyof CreateOrderPayload, value: string | null) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  // Mecánico creado desde el propio formulario: agregarlo a la lista, seleccionarlo
  // y avisar al padre para que actualice su lista compartida.
  function handleMechanicCreated(m: Mechanic) {
    setMechanicsList((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
    set('assigned_mechanic_id', m.id);
    onMechanicCreated?.(m);
  }

  function addFiles(files: File[]) {
    setPending((prev) => [
      ...prev,
      ...files.map((f) => ({
        file: f,
        url: f.type.startsWith('image/') ? URL.createObjectURL(f) : null,
      })),
    ]);
  }

  function removePending(index: number) {
    setPending((prev) => {
      const p = prev[index];
      if (p?.url) URL.revokeObjectURL(p.url);
      return prev.filter((_, i) => i !== index);
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    setPhase('creating');

    const url = isEdit ? `/api/orders/${order.id}` : '/api/orders';
    const method = isEdit ? 'PATCH' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        // Quien no puede asignar ni siquiera manda el campo (0019).
        ...(canAssign
          ? {
              assigned_mechanic_id: form.assigned_mechanic_id || null,
              show_workshop_as_mechanic: !!form.show_workshop_as_mechanic,
            }
          : { assigned_mechanic_id: undefined, show_workshop_as_mechanic: undefined }),
        notes: form.notes || null,
      }),
    });

    if (!res.ok) {
      setLoading(false);
      setPhase('idle');
      const data = await res.json().catch(() => ({}));
      if (res.status === 402 || data.limitReached) {
        setPaywall(data.error || null);
        return;
      }
      setError(data.error || 'Error al guardar la orden');
      return;
    }

    const saved: Order = await res.json();

    // El presupuesto armado antes de que la orden existiera: se manda entero
    // de un viaje. Los renglones sin nombre se descartan (quedaron vacíos).
    if (!isEdit) {
      const items = budget
        .map((r) => ({ description: r.description.trim(), amount: parseAmount(r.amount) ?? 0 }))
        .filter((r) => r.description !== '');
      if (items.length > 0) {
        setPhase('budget');
        try {
          const r = await fetch(`/api/orders/${saved.id}/budget`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(items),
          });
          if (!r.ok) {
            const d = await r.json().catch(() => ({}));
            // La orden YA se creó: no se tira abajo por el presupuesto. Se
            // avisa y se puede volver a cargar desde la orden.
            alert(d.error || 'La orden se creó, pero no se pudo guardar el presupuesto.');
          }
        } catch {
          alert('La orden se creó, pero no se pudo guardar el presupuesto.');
        }
      }
    }

    // Upload the initial attachments to the first stage (intake). They then
    // show up in the stage timeline (admin/mechanic) and the client tracking.
    if (!isEdit && pending.length > 0) {
      setPhase('uploading');
      const stages = ((saved.stages ?? []) as OrderStage[])
        .slice()
        .sort((a, b) => a.position - b.position);
      const target = stages[0];
      if (target) {
        const uploaded = [];
        for (const p of pending) {
          try {
            uploaded.push(await uploadStageAttachment(saved.id, target.id, p.file));
          } catch (err) {
            alert(err instanceof Error ? err.message : `No se pudo subir "${p.file.name}"`);
          }
        }
        target.attachments = [...(target.attachments ?? []), ...uploaded];
      }
    }

    setLoading(false);
    setPhase('idle');
    pending.forEach((p) => p.url && URL.revokeObjectURL(p.url));
    onSuccess(saved);
  }

  const submitLabel = isEdit
    ? 'Guardar cambios'
    : phase === 'budget'
    ? 'Guardando presupuesto...'
    : phase === 'uploading'
    ? 'Subiendo archivos...'
    : phase === 'creating'
    ? 'Creando orden...'
    : 'Crear orden';

  // Al crear, el total sale del borrador; al editar, de lo guardado.
  const totalPresupuesto = isEdit ? budgetTotal : totalDe(budget);
  const itemsPresupuesto = isEdit
    ? null
    : budget.filter((r) => r.description.trim() !== '').length;

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {paywall !== null && (
        <SubscriptionModal
          message={paywall || undefined}
          onClose={() => {
            setPaywall(null);
            onCancel();
          }}
        />
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Input
          label="Nombre"
          placeholder="Juan"
          value={form.client_first_name}
          onChange={(e) => set('client_first_name', e.target.value)}
          required
          icon={<User size={15} />}
        />
        <Input
          label="Apellido"
          placeholder="Pérez"
          value={form.client_last_name}
          onChange={(e) => set('client_last_name', e.target.value)}
          required
        />
      </div>

      <PhoneInput
        label="WhatsApp"
        value={form.client_whatsapp}
        onChange={(v) => set('client_whatsapp', v)}
        required
      />

      <Input
        label="Modelo del vehículo"
        placeholder="Toyota Corolla 2019"
        value={form.car_model}
        onChange={(e) => set('car_model', e.target.value)}
        required
        icon={<Car size={15} />}
      />

      {/* Mechanic selector — solo para quien puede asignar (el admin) */}
      {canAssign && (
      <div className="form-field">
        <label className="form-label">Mecánico asignado</label>
        <MechanicSelect
          mechanics={mechanicsList}
          workshopName={workshopName ?? order?.workshop?.name}
          value={valorDeAsignacion(form)}
          onChange={(elegido) => {
            // Las dos entradas del dueño (el taller y él) guardan la misma
            // persona; lo que cambia es el nombre que verá el cliente.
            const cambio = cambioDeAsignacion(elegido, mechanicsList);
            setForm((prev) => ({ ...prev, ...cambio }));
          }}
          disabled={loading}
          onAddNew={canCreateMechanic ? () => setShowAddMechanic(true) : undefined}
        />
      </div>
      )}

      {/* Notes */}
      <div className="form-field">
        <label className="form-label">Notas adicionales</label>
        <textarea
          className="form-input"
          placeholder="Observaciones, descripción del problema..."
          value={form.notes ?? ''}
          onChange={(e) => set('notes', e.target.value)}
          rows={3}
        />
      </div>

      {/* Presupuesto — repuestos y servicios con su precio.
          Está aquí, en el alta, porque es cuando el taller acuerda el precio
          con el cliente. Se puede seguir editando después desde la orden o
          desde la pantalla Presupuestos. */}
      <div className="form-field">
        <label className="form-label">Presupuesto</label>
        <button
          type="button"
          onClick={() => setShowBudget(true)}
          disabled={loading}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
            width: '100%',
            padding: '12px 14px',
            background: 'var(--color-surface-2)',
            border: '1px solid var(--color-border)',
            borderRadius: 8,
            cursor: 'pointer',
            textAlign: 'left',
          }}
        >
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--color-text-secondary)',
            }}
          >
            <Receipt size={16} />
            {totalPresupuesto > 0 || (itemsPresupuesto ?? 0) > 0
              ? 'Ver o editar presupuesto'
              : 'Agregar repuestos y servicios'}
          </span>
          <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--color-brand-400)' }}>
            {formatUsd(totalPresupuesto)}
          </span>
        </button>
      </div>

      {/* Initial attachments (create only) */}
      {!isEdit && (
        <div className="form-field">
          <label className="form-label">
            Fotos, video, nota de voz o documentos (opcional)
          </label>

          {pending.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
              {pending.map((p, i) => (
                <PendingTile key={i} file={p} onRemove={() => removePending(i)} />
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={() => setShowPicker(true)}
            disabled={loading}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 12px',
              background: 'var(--color-surface-2)',
              border: '1px solid var(--color-border)',
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 600,
              color: 'var(--color-text-secondary)',
              cursor: 'pointer',
            }}
          >
            <Plus size={14} />
            Agregar foto, video, nota de voz o documento
          </button>
        </div>
      )}

      {error && <p style={{ color: 'var(--color-danger)', fontSize: 13 }}>{error}</p>}

      <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
        <Button type="button" variant="secondary" fullWidth onClick={onCancel} disabled={loading}>
          Cancelar
        </Button>
        <Button type="submit" variant="primary" fullWidth loading={loading}>
          {submitLabel}
        </Button>
      </div>

      {showPicker && (
        <AttachmentPicker onFiles={addFiles} onClose={() => setShowPicker(false)} />
      )}

      {showBudget && (
        <Modal
          isOpen={showBudget}
          onClose={() => setShowBudget(false)}
          title="Presupuesto"
        >
          <BudgetList
            orderId={isEdit ? order.id : null}
            borrador={isEdit ? undefined : budget}
            onBorradorChange={isEdit ? undefined : setBudget}
            onTotalChange={setBudgetTotal}
          />
          <div style={{ marginTop: 16 }}>
            <Button type="button" variant="primary" fullWidth onClick={() => setShowBudget(false)}>
              Listo
            </Button>
          </div>
        </Modal>
      )}

      {showAddMechanic && (
        <Modal
          isOpen={showAddMechanic}
          onClose={() => setShowAddMechanic(false)}
          title="Nuevo mecánico"
        >
          <MechanicForm
            workshopName={workshopName}
            onSaved={handleMechanicCreated}
            onClose={() => setShowAddMechanic(false)}
          />
        </Modal>
      )}
    </form>
  );
}

function PendingTile({ file, onRemove }: { file: PendingFile; onRemove: () => void }) {
  const type = file.file.type;
  const isImage = type.startsWith('image/');
  const isVideo = type.startsWith('video/');
  const isAudio = type.startsWith('audio/');

  return (
    <div style={{ position: 'relative', width: 64, height: 64 }}>
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: 8,
          overflow: 'hidden',
          border: '1px solid var(--color-border)',
          background: isImage ? '#000' : 'var(--color-surface-2)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--color-text-secondary)',
        }}
      >
        {isImage && file.url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={file.url}
            alt={file.file.name}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : isVideo ? (
          <VideoIcon size={22} />
        ) : isAudio ? (
          <Mic size={22} />
        ) : (
          <FileText size={22} />
        )}
      </div>
      <button
        type="button"
        onClick={onRemove}
        aria-label="Quitar"
        style={{
          position: 'absolute',
          top: -6,
          right: -6,
          width: 20,
          height: 20,
          borderRadius: '50%',
          background: '#ef4444',
          border: '2px solid var(--color-surface)',
          color: '#fff',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 0,
        }}
      >
        <X size={11} />
      </button>
    </div>
  );
}
