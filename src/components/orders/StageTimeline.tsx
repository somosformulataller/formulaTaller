'use client';

import { useRef, useState } from 'react';
import type { OrderStage, StageStatus } from '@/lib/types';
import Button from '@/components/ui/Button';
import { CheckCircle2, Circle, Loader2, Plus, Trash2, Clock, Edit2, Save, GripVertical } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { uploadStageAttachment } from '@/lib/attachments';
import AttachmentPicker from './AttachmentPicker';
import AttachmentGallery from './AttachmentGallery';

interface StageTimelineProps {
  orderId: string;
  initialStages: OrderStage[];
  canEdit: boolean;
}

const STATUS_ICONS: Record<StageStatus, React.ReactNode> = {
  done: <CheckCircle2 size={20} color="#10b981" />,
  in_progress: <Loader2 size={20} color="#f59e0b" style={{ animation: 'spin 1.5s linear infinite' }} />,
  pending: <Circle size={20} color="var(--color-text-muted)" />,
};

export default function StageTimeline({ orderId, initialStages, canEdit }: StageTimelineProps) {
  const [stages, setStages] = useState<OrderStage[]>(
    [...initialStages].sort((a, b) => a.position - b.position)
  );
  const [newStageName, setNewStageName] = useState('');
  const [addingStage, setAddingStage] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [pickerStageId, setPickerStageId] = useState<string | null>(null);

  async function uploadAttachments(stageId: string, files: File[]) {
    setUploadingId(stageId);
    for (const file of files) {
      try {
        // Compress images, upload straight to Storage (signed URL), record row.
        const att = await uploadStageAttachment(orderId, stageId, file);
        // Append as soon as each file finishes so they appear progressively.
        setStages((prev) =>
          prev.map((s) =>
            s.id === stageId ? { ...s, attachments: [...(s.attachments ?? []), att] } : s
          )
        );
      } catch (err) {
        alert(err instanceof Error ? err.message : `No se pudo subir "${file.name}"`);
      }
    }
    setUploadingId(null);
  }

  async function deleteAttachment(stageId: string, attachmentId: string) {
    if (!confirm('¿Eliminar este adjunto?')) return;
    const res = await fetch(
      `/api/orders/${orderId}/stages/${stageId}/attachments?id=${attachmentId}`,
      { method: 'DELETE' }
    );
    if (res.ok) {
      setStages((prev) =>
        prev.map((s) =>
          s.id === stageId
            ? { ...s, attachments: (s.attachments ?? []).filter((a) => a.id !== attachmentId) }
            : s
        )
      );
    }
  }

  function startEdit(stage: OrderStage) {
    setEditingId(stage.id);
    setEditName(stage.name);
    setEditDesc(stage.description ?? '');
  }

  function cancelEdit() {
    setEditingId(null);
    setEditName('');
    setEditDesc('');
  }

  async function saveEdit(stageId: string) {
    if (!editName.trim()) return;
    setLoadingId(stageId);
    const res = await fetch(`/api/orders/${orderId}/stages/${stageId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editName.trim(), description: editDesc.trim() || null }),
    });
    setLoadingId(null);
    if (res.ok) {
      const updated: OrderStage = await res.json();
      // Merge (keep attachments, which the PATCH response doesn't include).
      setStages((prev) => prev.map((s) => (s.id === stageId ? { ...s, ...updated } : s)));
      cancelEdit();
    }
  }

  async function updateStage(stageId: string, newStatus: StageStatus) {
    // Optimistic: change the icon instantly, reconcile/revert with the server.
    const snapshot = stages;
    setStages((prev) =>
      prev.map((s) =>
        s.id === stageId
          ? {
              ...s,
              status: newStatus,
              completed_at: newStatus === 'done' ? new Date().toISOString() : null,
            }
          : s
      )
    );

    const res = await fetch(`/api/orders/${orderId}/stages/${stageId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    });

    if (res.ok) {
      const updated: OrderStage = await res.json();
      // Merge to keep attachments (not returned by the PATCH).
      setStages((prev) => prev.map((s) => (s.id === stageId ? { ...s, ...updated } : s)));
    } else {
      setStages(snapshot);
      alert('No se pudo actualizar la etapa');
    }
  }

  async function addCustomStage() {
    if (!newStageName.trim()) return;
    setLoadingId('new');
    const res = await fetch(`/api/orders/${orderId}/stages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newStageName.trim() }),
    });
    setLoadingId(null);
    if (res.ok) {
      const created: OrderStage = await res.json();
      setStages((prev) => [...prev, created]);
      setNewStageName('');
      setAddingStage(false);
    }
  }

  async function deleteStage(stageId: string) {
    if (!confirm('¿Eliminar esta etapa?')) return;
    setLoadingId(stageId);
    const res = await fetch(`/api/orders/${orderId}/stages/${stageId}`, {
      method: 'DELETE',
    });
    setLoadingId(null);
    if (res.ok) {
      setStages((prev) => prev.filter((s) => s.id !== stageId));
    }
  }

  function cycleStatus(current: StageStatus): StageStatus {
    const cycle: StageStatus[] = ['pending', 'in_progress', 'done'];
    const idx = cycle.indexOf(current);
    return cycle[(idx + 1) % cycle.length];
  }

  // --- Drag & drop reordering (pointer events: works on touch + mouse) ------
  const rowRefs = useRef<Array<HTMLDivElement | null>>([]);
  const dragRef = useRef<{ index: number; order: OrderStage[]; snapshot: OrderStage[] } | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  function startDrag(index: number, e: React.PointerEvent) {
    if (!canEdit) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { index, order: stages.slice(), snapshot: stages };
    setDragIndex(index);
  }

  function moveDrag(e: React.PointerEvent) {
    const st = dragRef.current;
    if (!st) return;
    e.preventDefault();
    const y = e.clientY;
    // Find the slot whose midpoint is just below the pointer.
    let target = st.order.length - 1;
    for (let i = 0; i < st.order.length; i++) {
      const el = rowRefs.current[i];
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (y < r.top + r.height / 2) {
        target = i;
        break;
      }
    }
    if (target !== st.index) {
      const next = st.order.slice();
      const [moved] = next.splice(st.index, 1);
      next.splice(target, 0, moved);
      st.order = next;
      st.index = target;
      setStages(next);
      setDragIndex(target);
    }
  }

  async function endDrag() {
    const st = dragRef.current;
    dragRef.current = null;
    setDragIndex(null);
    if (!st) return;

    const ids = st.order.map((s) => s.id);
    const unchanged = st.snapshot.every((s, i) => s.id === ids[i]);
    if (unchanged) return;

    // Persist; keep positions in sync locally.
    setStages((prev) => prev.map((s, i) => ({ ...s, position: i + 1 })));
    const res = await fetch(`/api/orders/${orderId}/stages/reorder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    });
    if (!res.ok) {
      setStages(st.snapshot);
      alert('No se pudo guardar el nuevo orden de las etapas');
    }
  }

  const done = stages.filter((s) => s.status === 'done').length;
  const progress = stages.length > 0 ? Math.round((done / stages.length) * 100) : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Progress bar summary */}
      <div
        className="card"
        style={{ background: 'var(--color-surface-2)', padding: '14px 16px' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>Progreso general</span>
          <span style={{ fontSize: 13, color: 'var(--color-brand-400)', fontWeight: 700 }}>
            {done}/{stages.length} etapas
          </span>
        </div>
        <div
          style={{
            height: 6,
            background: 'var(--color-surface-3)',
            borderRadius: 3,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${progress}%`,
              background: 'linear-gradient(90deg, var(--color-brand-500), var(--color-brand-400))',
              borderRadius: 3,
              transition: 'width 0.4s ease',
            }}
          />
        </div>
      </div>

      {/* Timeline */}
      <div style={{ position: 'relative' }}>
        {/* Vertical line */}
        <div
          style={{
            position: 'absolute',
            left: 9,
            top: 10,
            bottom: 10,
            width: 2,
            background: 'var(--color-border)',
            zIndex: 0,
          }}
        />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {stages.map((stage, index) => {
            const isLoading = loadingId === stage.id;
            return (
              <div
                key={stage.id}
                ref={(el) => {
                  rowRefs.current[index] = el;
                }}
                className="animate-fade-in"
                style={{
                  display: 'flex',
                  gap: 14,
                  alignItems: 'flex-start',
                  position: 'relative',
                  zIndex: dragIndex === index ? 2 : 1,
                  animationDelay: `${index * 50}ms`,
                  opacity: dragIndex === index ? 0.6 : 1,
                }}
              >
                {/* Icon */}
                <div style={{ marginTop: 12, flexShrink: 0 }}>
                  {isLoading ? (
                    <Loader2 size={20} color="var(--color-brand-400)" style={{ animation: 'spin 0.8s linear infinite' }} />
                  ) : (
                    STATUS_ICONS[stage.status]
                  )}
                </div>

                {/* Card */}
                <div
                  style={{
                    flex: 1,
                    background: stage.status === 'done'
                      ? 'rgba(16,185,129,0.06)'
                      : stage.status === 'in_progress'
                      ? 'rgba(245,158,11,0.06)'
                      : 'var(--color-surface)',
                    border: `1px solid ${
                      stage.status === 'done'
                        ? 'rgba(16,185,129,0.15)'
                        : stage.status === 'in_progress'
                        ? 'rgba(245,158,11,0.2)'
                        : 'var(--color-border)'
                    }`,
                    borderRadius: 10,
                    padding: '10px 14px',
                    marginBottom: 8,
                  }}
                >
                  {editingId === stage.id ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <input
                        className="form-input"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        placeholder="Nombre de la etapa"
                        autoFocus
                      />
                      <textarea
                        className="form-input"
                        value={editDesc}
                        onChange={(e) => setEditDesc(e.target.value)}
                        placeholder="Descripción (opcional)"
                        rows={2}
                      />
                      <div style={{ display: 'flex', gap: 8 }}>
                        <Button
                          variant="primary"
                          size="sm"
                          loading={isLoading}
                          onClick={() => saveEdit(stage.id)}
                        >
                          <Save size={13} />
                          Guardar
                        </Button>
                        <Button variant="ghost" size="sm" onClick={cancelEdit}>
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                        <span
                          style={{
                            fontSize: 14,
                            fontWeight: 600,
                            color: stage.status === 'done'
                              ? 'var(--color-text-secondary)'
                              : 'var(--color-text-primary)',
                            textDecoration: stage.status === 'done' ? 'line-through' : 'none',
                          }}
                        >
                          {stage.name}
                        </span>

                        {canEdit && (
                          <div style={{ display: 'flex', gap: 8, flexShrink: 0, alignItems: 'center' }}>
                            <button
                              onPointerDown={(e) => startDrag(index, e)}
                              onPointerMove={moveDrag}
                              onPointerUp={endDrag}
                              onPointerCancel={endDrag}
                              title="Mantén y arrastra para reordenar"
                              aria-label="Reordenar etapa"
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: 'var(--color-text-muted)',
                                cursor: 'grab',
                                touchAction: 'none',
                                padding: 2,
                                display: 'flex',
                                alignItems: 'center',
                              }}
                            >
                              <GripVertical size={16} />
                            </button>
                            <button
                              onClick={() => updateStage(stage.id, cycleStatus(stage.status))}
                              disabled={isLoading}
                              style={{
                                background: 'var(--color-surface-2)',
                                border: '1px solid var(--color-border)',
                                borderRadius: 6,
                                padding: '4px 10px',
                                color: 'var(--color-text-secondary)',
                                fontSize: 11,
                                fontWeight: 600,
                                cursor: 'pointer',
                                transition: 'all 0.15s',
                              }}
                            >
                              {stage.status === 'pending'
                                ? 'Iniciar'
                                : stage.status === 'in_progress'
                                ? 'Completar'
                                : 'Reabrir'}
                            </button>
                            <button
                              onClick={() => startEdit(stage)}
                              disabled={isLoading}
                              title="Editar título y descripción"
                              style={{
                                background: 'var(--color-surface-2)',
                                border: '1px solid var(--color-border)',
                                borderRadius: 6,
                                color: 'var(--color-text-secondary)',
                                cursor: 'pointer',
                                padding: 6,
                                display: 'flex',
                                alignItems: 'center',
                              }}
                            >
                              <Edit2 size={13} />
                            </button>
                          </div>
                        )}
                      </div>

                      {stage.description && (
                        <p
                          style={{
                            fontSize: 12,
                            color: 'var(--color-text-secondary)',
                            marginTop: 6,
                            whiteSpace: 'pre-wrap',
                          }}
                        >
                          {stage.description}
                        </p>
                      )}

                      {stage.completed_at && (
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                            marginTop: 4,
                            color: 'var(--color-text-muted)',
                            fontSize: 11,
                          }}
                        >
                          <Clock size={10} />
                          <span>{formatDate(stage.completed_at)}</span>
                        </div>
                      )}

                      {stage.attachments && stage.attachments.length > 0 && (
                        <AttachmentGallery
                          attachments={stage.attachments}
                          canEdit={canEdit}
                          onDelete={(id) => deleteAttachment(stage.id, id)}
                        />
                      )}

                      {canEdit && (
                        <button
                          onClick={() => setPickerStageId(stage.id)}
                          disabled={uploadingId === stage.id}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            marginTop: 10,
                            padding: '6px 12px',
                            background: 'var(--color-surface-2)',
                            border: '1px solid var(--color-border)',
                            borderRadius: 8,
                            fontSize: 12,
                            fontWeight: 600,
                            color: 'var(--color-text-secondary)',
                            cursor: uploadingId === stage.id ? 'default' : 'pointer',
                          }}
                        >
                          {uploadingId === stage.id ? (
                            <Loader2 size={13} style={{ animation: 'spin 0.8s linear infinite' }} />
                          ) : (
                            <Plus size={13} />
                          )}
                          {uploadingId === stage.id
                            ? 'Subiendo...'
                            : 'Agregar foto, video, nota de voz o documento'}
                        </button>
                      )}

                      {canEdit && (
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                          <button
                            onClick={() => deleteStage(stage.id)}
                            disabled={isLoading}
                            title="Eliminar etapa"
                            aria-label="Eliminar etapa"
                            style={{
                              background: 'rgba(239,68,68,0.1)',
                              border: '1px solid rgba(239,68,68,0.25)',
                              borderRadius: 6,
                              color: '#f87171',
                              cursor: 'pointer',
                              padding: 6,
                              display: 'flex',
                              alignItems: 'center',
                            }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Add custom stage */}
      {canEdit && (
        <div>
          {addingStage ? (
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                className="form-input"
                placeholder="Nombre de la nueva etapa..."
                value={newStageName}
                onChange={(e) => setNewStageName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addCustomStage()}
                autoFocus
                style={{ flex: 1 }}
              />
              <Button
                variant="primary"
                size="sm"
                loading={loadingId === 'new'}
                onClick={addCustomStage}
              >
                Agregar
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setAddingStage(false);
                  setNewStageName('');
                }}
              >
                Cancelar
              </Button>
            </div>
          ) : (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setAddingStage(true)}
            >
              <Plus size={14} />
              Agregar etapa personalizada
            </Button>
          )}
        </div>
      )}

      {/* Attachment picker modal (shared by all stages) */}
      {pickerStageId && (
        <AttachmentPicker
          onFiles={(files) => uploadAttachments(pickerStageId, files)}
          onClose={() => setPickerStageId(null)}
        />
      )}
    </div>
  );
}
