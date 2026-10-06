'use client';

import { useEffect, useRef, useState } from 'react';
import { Image as ImageIcon, Plus, FileText, Sparkles, X } from 'lucide-react';
import Button from '@/components/ui/Button';
import CampoNotaDeVoz from '@/components/orders/CampoNotaDeVoz';
import type { NotifyOffset, Reminder, ReminderTag, ReminderTagColor } from '@/lib/types';
import { NOTIFY_OFFSETS, TAG_COLORS, TAG_COLOR_HEX, hoyVE } from '@/lib/recordatorios';
import { subirArchivoRecordatorio } from '@/lib/reminder-upload';

interface Props {
  clientId: string;
  /** Si se crea desde una orden, queda enlazado a ella. */
  orderId?: string | null;
  /** Para editar uno existente. */
  reminder?: Reminder | null;
  onSaved: (r: Reminder) => void;
  onCancel: () => void;
}

/** Suma meses a 'AAAA-MM-DD' sin pasar por zonas horarias. */
function sumarMeses(iso: string, meses: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const f = new Date(Date.UTC(y, m - 1 + meses, 1));
  const ultimo = new Date(Date.UTC(f.getUTCFullYear(), f.getUTCMonth() + 1, 0)).getUTCDate();
  f.setUTCDate(Math.min(d, ultimo));
  return f.toISOString().slice(0, 10);
}

const ATAJOS = [
  { meses: 1, label: 'En 1 mes' },
  { meses: 2, label: 'En 2 meses' },
  { meses: 3, label: 'En 3 meses' },
  { meses: 6, label: 'En 6 meses' },
];

/**
 * Formulario del recordatorio: título, texto o nota de voz (que se pasa a
 * texto quedándose solo con lo del recordatorio), imagen, etiqueta, fecha y cuándo
 * avisar. El aviso le llega al taller el día que toca, y desde ahí se le
 * manda al cliente por WhatsApp con un toque.
 */
export default function ReminderForm({ clientId, orderId, reminder, onSaved, onCancel }: Props) {
  const [title, setTitle] = useState(reminder?.title ?? '');
  // Título que sugiere la IA cuando el usuario ya había escrito uno.
  const [sugerido, setSugerido] = useState<string | null>(null);
  // La transcripción tarda: se compara con el título de ese momento, no con el de cuando se grabó.
  const titleRef = useRef(title);
  titleRef.current = title;
  const [body, setBody] = useState(reminder?.body ?? '');
  const [dueDate, setDueDate] = useState(reminder?.due_date ?? '');
  const [offset, setOffset] = useState<NotifyOffset>(reminder?.notify_offset ?? '3_dias');
  const [tagId, setTagId] = useState<string | null>(reminder?.tag_id ?? null);
  const [tags, setTags] = useState<ReminderTag[]>([]);


  // Imagen
  const [imagePath, setImagePath] = useState<string | null>(reminder?.image_path ?? null);
  const [imageUrl, setImageUrl] = useState<string | null>(reminder?.image_url ?? null);
  const [subiendoImagen, setSubiendoImagen] = useState(false);
  const inputImagen = useRef<HTMLInputElement>(null);

  // Etiqueta nueva
  const [creandoTag, setCreandoTag] = useState(false);
  const [nuevoTag, setNuevoTag] = useState('');
  const [nuevoColor, setNuevoColor] = useState<ReminderTagColor>('blue');

  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/reminder-tags', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : []))
      .then(setTags)
      .catch(() => setTags([]));
  }, []);

  async function alElegirImagen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setSubiendoImagen(true);
    setError(null);
    try {
      const path = await subirArchivoRecordatorio(file, 'image');
      setImagePath(path);
      setImageUrl(URL.createObjectURL(file));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo subir la imagen.');
    } finally {
      setSubiendoImagen(false);
    }
  }

  async function crearTag() {
    const label = nuevoTag.trim();
    if (!label) return;
    setError(null);
    const res = await fetch('/api/reminder-tags', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label, color: nuevoColor }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || 'No se pudo crear la etiqueta.');
      return;
    }
    setTags((prev) => [...prev, data as ReminderTag]);
    setTagId((data as ReminderTag).id);
    setNuevoTag('');
    setCreandoTag(false);
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!title.trim()) return setError('Escribe un título para el recordatorio.');
    if (!dueDate) return setError('Elige la fecha en el calendario.');
    if (subiendoImagen) return setError('Espera a que termine de subir el archivo.');

    const payload = {
      client_id: clientId,
      order_id: reminder ? undefined : orderId ?? null,
      title: title.trim(),
      body: body.trim() || null,
      image_path: imagePath,
      tag_id: tagId,
      due_date: dueDate,
      notify_offset: offset,
    };

    setGuardando(true);
    try {
      const res = await fetch(reminder ? `/api/reminders/${reminder.id}` : '/api/reminders', {
        method: reminder ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'No se pudo guardar el recordatorio.');
      onSaved(data as Reminder);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el recordatorio.');
    } finally {
      setGuardando(false);
    }
  }

  const etiquetaSel = { fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)' } as const;

  return (
    <form onSubmit={guardar} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Igual que en la orden: se dicta y queda solo lo del recordatorio.
          La IA sugiere el título: si está vacío lo llena; si no, lo propone debajo. */}
      <CampoNotaDeVoz
        titulo="Texto o nota de voz"
        modo="recordatorio"
        placeholder="Escribe o toca el micrófono y di los detalles del recordatorio…"
        vacio="No se escuchó nada sobre el recordatorio. Vuelve a grabar o escríbelo."
        Icono={FileText}
        value={body}
        onChange={setBody}
        onTitulo={(t) => {
          const actual = titleRef.current.trim();
          if (!actual) {
            setTitle(t);
            setSugerido(null);
          } else {
            setSugerido(t.trim() === actual ? null : t);
          }
        }}
        disabled={guardando}
      />

      <div className="form-field">
        <label className="form-label">Título</label>
        <input
          className="form-input"
          placeholder="Ej.: Mantenimiento próximo: en dos meses"
          maxLength={120}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
        {sugerido && (
          <button
            type="button"
            onClick={() => {
              setTitle(sugerido);
              setSugerido(null);
            }}
            title="Usar este título"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              alignSelf: 'flex-start',
              marginTop: 8,
              padding: '6px 11px',
              borderRadius: 999,
              fontSize: 12.5,
              fontWeight: 600,
              border: '1px dashed var(--color-brand-400)',
              background: 'rgba(245,158,11,0.1)',
              color: 'var(--color-brand-400)',
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            <Sparkles size={13} style={{ flexShrink: 0 }} />
            Sugerido: {sugerido}
          </button>
        )}
      </div>

      <div className="form-field">
        <label className="form-label">Imagen (opcional)</label>
        <input ref={inputImagen} type="file" accept="image/*" hidden onChange={alElegirImagen} />
        {imageUrl ? (
          <div style={{ position: 'relative', width: 96, height: 96 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl}
              alt="Imagen del recordatorio"
              style={{ width: 96, height: 96, objectFit: 'cover', borderRadius: 10, border: '1px solid var(--color-border)' }}
            />
            <button
              type="button"
              onClick={() => {
                setImagePath(null);
                setImageUrl(null);
              }}
              aria-label="Quitar imagen"
              style={{
                position: 'absolute',
                top: -6,
                right: -6,
                width: 22,
                height: 22,
                borderRadius: '50%',
                background: '#ef4444',
                border: '2px solid var(--color-surface)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                padding: 0,
              }}
            >
              <X size={12} />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => inputImagen.current?.click()}
            disabled={subiendoImagen}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 12px',
              background: 'var(--color-surface-2)',
              border: '1px solid var(--color-border)',
              borderRadius: 8,
              fontSize: 12.5,
              fontWeight: 600,
              color: 'var(--color-text-secondary)',
              cursor: 'pointer',
              alignSelf: 'flex-start',
            }}
          >
            <ImageIcon size={15} />
            {subiendoImagen ? 'Subiendo…' : 'Agregar imagen'}
          </button>
        )}
      </div>

      <div className="form-field">
        <label className="form-label">Etiqueta</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {tags.map((t) => {
            const activo = tagId === t.id;
            const color = TAG_COLOR_HEX[t.color] ?? TAG_COLOR_HEX.neutral;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTagId(activo ? null : t.id)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 11px',
                  borderRadius: 999,
                  fontSize: 12.5,
                  fontWeight: 600,
                  border: `1px solid ${activo ? color : 'var(--color-border)'}`,
                  background: activo ? `${color}26` : 'var(--color-surface-2)',
                  color: activo ? color : 'var(--color-text-secondary)',
                  cursor: 'pointer',
                }}
              >
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
                {t.label}
              </button>
            );
          })}
          {!creandoTag && (
            <button
              type="button"
              onClick={() => setCreandoTag(true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '6px 11px',
                borderRadius: 999,
                fontSize: 12.5,
                fontWeight: 600,
                border: '1px dashed var(--color-border)',
                background: 'transparent',
                color: 'var(--color-text-secondary)',
                cursor: 'pointer',
              }}
            >
              <Plus size={13} />
              Nueva etiqueta
            </button>
          )}
        </div>
        {creandoTag && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
            <input
              className="form-input"
              placeholder="Nombre de la etiqueta"
              maxLength={40}
              value={nuevoTag}
              autoFocus
              onChange={(e) => setNuevoTag(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  crearTag();
                }
              }}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {TAG_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`Color ${c}`}
                  onClick={() => setNuevoColor(c)}
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    background: TAG_COLOR_HEX[c],
                    border: nuevoColor === c ? '3px solid var(--color-text-primary)' : '2px solid transparent',
                    cursor: 'pointer',
                  }}
                />
              ))}
              <span style={{ flex: 1 }} />
              <Button type="button" variant="ghost" size="sm" onClick={() => setCreandoTag(false)}>
                Cancelar
              </Button>
              <Button type="button" variant="primary" size="sm" onClick={crearTag}>
                Crear
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="form-field">
        <label className="form-label">Fecha</label>
        <input
          type="date"
          className="form-input"
          value={dueDate}
          min={reminder ? undefined : hoyVE()}
          onChange={(e) => setDueDate(e.target.value)}
          required
        />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
          {ATAJOS.map((a) => (
            <button
              key={a.meses}
              type="button"
              onClick={() => setDueDate(sumarMeses(hoyVE(), a.meses))}
              style={{
                padding: '5px 10px',
                borderRadius: 999,
                fontSize: 12,
                fontWeight: 600,
                border: '1px solid var(--color-border)',
                background: 'var(--color-surface-2)',
                color: 'var(--color-text-secondary)',
                cursor: 'pointer',
              }}
            >
              {a.label}
            </button>
          ))}
        </div>
      </div>

      <div className="form-field">
        <label className="form-label">Recordarme</label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          {NOTIFY_OFFSETS.map((o) => {
            const activo = offset === o.value;
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => setOffset(o.value)}
                style={{
                  padding: '9px 10px',
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 600,
                  border: `1px solid ${activo ? 'var(--color-brand-400)' : 'var(--color-border)'}`,
                  background: activo ? 'rgba(245,158,11,0.15)' : 'var(--color-surface-2)',
                  color: activo ? 'var(--color-brand-400)' : 'var(--color-text-secondary)',
                  cursor: 'pointer',
                }}
              >
                {o.label}
              </button>
            );
          })}
        </div>
        <p style={etiquetaSel}>
          Ese día te aparece en la campana para enviárselo al cliente por WhatsApp.
        </p>
      </div>

      {error && <p style={{ color: 'var(--color-danger)', fontSize: 13 }}>{error}</p>}

      <div style={{ display: 'flex', gap: 10 }}>
        <Button type="button" variant="secondary" onClick={onCancel} disabled={guardando}>
          Cancelar
        </Button>
        <Button type="submit" variant="primary" fullWidth loading={guardando} style={{ flex: 1 }}>
          {reminder ? 'Guardar cambios' : 'Guardar recordatorio'}
        </Button>
      </div>
    </form>
  );
}
