'use client';

import { useMemo, useState } from 'react';
import type { CrmTag, CrmTagColor, SalesClientRow } from '@/lib/types';
import { formatDate } from '@/lib/utils';
import { shareTutorialVideo, TUTORIAL_VIDEO_PATH } from '@/lib/whatsapp';
import {
  Search,
  Send,
  Tag as TagIcon,
  Plus,
  Trash2,
  Check,
  X,
  Video,
  Save,
  ClipboardList,
  Users,
  CheckCircle2,
  ChevronDown,
  Download,
} from 'lucide-react';

const TAG_STYLES: Record<CrmTagColor, { bg: string; border: string; fg: string; dot: string }> = {
  neutral: { bg: 'var(--color-surface-3)', border: 'var(--color-border)', fg: 'var(--color-text-secondary)', dot: '#8b8fa8' },
  gold: { bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.3)', fg: 'var(--color-brand-400)', dot: '#fbbf24' },
  green: { bg: 'rgba(52,211,153,0.12)', border: 'rgba(52,211,153,0.3)', fg: '#34d399', dot: '#34d399' },
  red: { bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.25)', fg: '#f87171', dot: '#f87171' },
  blue: { bg: 'rgba(59,130,246,0.12)', border: 'rgba(59,130,246,0.3)', fg: '#60a5fa', dot: '#60a5fa' },
};
const COLOR_OPTS: { key: CrmTagColor; label: string }[] = [
  { key: 'neutral', label: 'Gris' },
  { key: 'gold', label: 'Dorado' },
  { key: 'green', label: 'Verde' },
  { key: 'red', label: 'Rojo' },
  { key: 'blue', label: 'Azul' },
];

type SortKey = 'recent' | 'old' | 'orders_desc' | 'orders_asc';

interface Props {
  initialRows: SalesClientRow[];
  initialTags: CrmTag[];
  message: string;
}

export default function VentasClient({ initialRows, initialTags, message }: Props) {
  const [rows, setRows] = useState<SalesClientRow[]>(initialRows);
  const [tags, setTags] = useState<CrmTag[]>(initialTags);

  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortKey>('recent');
  const [hideTest, setHideTest] = useState(true);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [tagPanelFor, setTagPanelFor] = useState<string | null>(null);
  const [manageOpen, setManageOpen] = useState(false);
  const [bulk, setBulk] = useState<{ ids: string[]; index: number } | null>(null);

  // Configuración del onboarding (mensaje). El video va incluido en la app.
  const [msg, setMsg] = useState(message);
  const [cfgOpen, setCfgOpen] = useState(false);
  const [savingCfg, setSavingCfg] = useState(false);
  const [cfgSaved, setCfgSaved] = useState(false);

  const tagById = useMemo(() => {
    const m = new Map<string, CrmTag>();
    for (const t of tags) m.set(t.id, t);
    return m;
  }, [tags]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let arr = rows;
    if (hideTest) arr = arr.filter((r) => !r.is_test);
    if (q) {
      arr = arr.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          (r.owner_name ?? '').toLowerCase().includes(q) ||
          (r.whatsapp ?? '').toLowerCase().includes(q)
      );
    }
    const sorted = [...arr];
    switch (sort) {
      case 'recent': sorted.sort((a, b) => b.created_at.localeCompare(a.created_at)); break;
      case 'old': sorted.sort((a, b) => a.created_at.localeCompare(b.created_at)); break;
      case 'orders_desc': sorted.sort((a, b) => b.order_count - a.order_count); break;
      case 'orders_asc': sorted.sort((a, b) => a.order_count - b.order_count); break;
    }
    return sorted;
  }, [rows, search, sort, hideTest]);

  const metrics = useMemo(() => {
    const real = rows.filter((r) => !r.is_test);
    return {
      total: real.length,
      sent: real.filter((r) => r.tutorial_sent_at).length,
      active: real.filter((r) => r.order_count > 0).length,
    };
  }, [rows]);

  // ---- Envío del video + mensaje --------------------------------------------
  // En el teléfono comparte el ARCHIVO del video con el mensaje de leyenda (Web
  // Share): WhatsApp lo recibe como video y eliges el contacto ahí. En PC
  // descarga el video y abre el chat del número para adjuntarlo.
  async function shareToClient(row: SalesClientRow): Promise<boolean> {
    if (!msg.trim()) {
      alert('Primero escribe el mensaje (sección "Video y mensaje" arriba).');
      setCfgOpen(true);
      return false;
    }
    await shareTutorialVideo(row.whatsapp, msg.trim());
    return true;
  }

  async function markSent(id: string) {
    try {
      const res = await fetch(`/api/superadmin/workshops/${id}/tutorial-sent`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setRows((prev) =>
          prev.map((r) =>
            r.id === id
              ? {
                  ...r,
                  tutorial_sent_at: data.tutorial_sent_at ?? new Date().toISOString(),
                  tag_ids:
                    data.video_tag_id && !r.tag_ids.includes(data.video_tag_id)
                      ? [...r.tag_ids, data.video_tag_id]
                      : r.tag_ids,
                }
              : r
          )
        );
      }
    } catch {
      /* no bloquear el flujo de envío si falla el marcado */
    }
  }

  async function sendSingle(row: SalesClientRow) {
    if (await shareToClient(row)) markSent(row.id);
  }

  // ---- Envío masivo (stepper) ----------------------------------------------
  function startBulk() {
    const ids = filtered.filter((r) => selected.has(r.id)).map((r) => r.id);
    if (ids.length === 0) return;
    if (!msg.trim()) {
      alert('Primero escribe el mensaje (sección "Video y mensaje" arriba).');
      setCfgOpen(true);
      return;
    }
    setBulk({ ids, index: 0 });
  }
  function bulkCurrent(): SalesClientRow | null {
    if (!bulk) return null;
    return rows.find((r) => r.id === bulk.ids[bulk.index]) ?? null;
  }
  function bulkAdvance() {
    setBulk((b) => {
      if (!b) return null;
      if (b.index + 1 >= b.ids.length) {
        setSelected(new Set());
        return null;
      }
      return { ...b, index: b.index + 1 };
    });
  }
  async function bulkSendCurrent() {
    const cur = bulkCurrent();
    if (!cur) return;
    if (await shareToClient(cur)) markSent(cur.id);
    bulkAdvance();
  }

  // ---- Etiquetas ------------------------------------------------------------
  async function toggleTag(row: SalesClientRow, tagId: string) {
    const has = row.tag_ids.includes(tagId);
    setRows((prev) =>
      prev.map((r) =>
        r.id === row.id
          ? { ...r, tag_ids: has ? r.tag_ids.filter((t) => t !== tagId) : [...r.tag_ids, tagId] }
          : r
      )
    );
    try {
      const res = has
        ? await fetch(`/api/superadmin/workshops/${row.id}/tags?tag_id=${tagId}`, { method: 'DELETE' })
        : await fetch(`/api/superadmin/workshops/${row.id}/tags`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tag_id: tagId }),
          });
      if (!res.ok) throw new Error();
    } catch {
      // revertir
      setRows((prev) =>
        prev.map((r) =>
          r.id === row.id
            ? { ...r, tag_ids: has ? [...r.tag_ids, tagId] : r.tag_ids.filter((t) => t !== tagId) }
            : r
        )
      );
      alert('No se pudo actualizar la etiqueta. Revisa tu conexión.');
    }
  }

  function onTagCreated(tag: CrmTag) {
    setTags((prev) => [...prev, tag]);
  }
  function onTagUpdated(tag: CrmTag) {
    setTags((prev) => prev.map((t) => (t.id === tag.id ? tag : t)));
  }
  function onTagDeleted(id: string) {
    setTags((prev) => prev.filter((t) => t.id !== id));
    setRows((prev) => prev.map((r) => ({ ...r, tag_ids: r.tag_ids.filter((t) => t !== id) })));
  }

  // ---- Config ---------------------------------------------------------------
  async function saveConfig() {
    if (!msg.trim()) {
      alert('El mensaje no puede estar vacío.');
      return;
    }
    setSavingCfg(true);
    setCfgSaved(false);
    try {
      const res = await fetch('/api/superadmin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tutorial_message: msg.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error || 'No se pudo guardar la configuración.');
        return;
      }
      setMsg(data.tutorial_message ?? msg);
      setCfgSaved(true);
      setTimeout(() => setCfgSaved(false), 2500);
    } catch {
      alert('No se pudo conectar. Inténtalo de nuevo.');
    } finally {
      setSavingCfg(false);
    }
  }

  // ---- Selección ------------------------------------------------------------
  function toggleSelect(id: string) {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }
  const allSelected = filtered.length > 0 && filtered.every((r) => selected.has(r.id));
  function toggleSelectAll() {
    setSelected((prev) => {
      if (allSelected) {
        const n = new Set(prev);
        for (const r of filtered) n.delete(r.id);
        return n;
      }
      const n = new Set(prev);
      for (const r of filtered) n.add(r.id);
      return n;
    });
  }

  const selectedCount = filtered.filter((r) => selected.has(r.id)).length;

  return (
    <div style={{ maxWidth: 820, margin: '0 auto', padding: '20px 16px 96px' }}>
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800 }}>Ventas</h1>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 12, marginTop: 2 }}>
          Seguimiento de talleres registrados y envío del video de bienvenida.
        </p>
      </div>

      {/* Métricas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
        <Metric icon={<Users size={17} />} label="Registrados" value={metrics.total} />
        <Metric icon={<CheckCircle2 size={17} />} label="Video enviado" value={metrics.sent} />
        <Metric icon={<ClipboardList size={17} />} label="Con órdenes" value={metrics.active} />
      </div>

      {/* Video y mensaje */}
      <div className="card" style={{ marginBottom: 16 }}>
        <button
          onClick={() => setCfgOpen((v) => !v)}
          style={{
            display: 'flex', alignItems: 'center', gap: 8, width: '100%',
            background: 'none', border: 'none', color: 'var(--color-text-primary)',
            cursor: 'pointer', padding: 0,
          }}
        >
          <Video size={16} color="var(--color-brand-400)" />
          <span style={{ fontSize: 15, fontWeight: 700 }}>Video y mensaje</span>
          <ChevronDown size={16} style={{ marginLeft: 'auto', transform: cfgOpen ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />
        </button>

        {cfgOpen && (
          <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Cómo funciona */}
            <div
              style={{
                fontSize: 12, color: 'var(--color-text-secondary)', lineHeight: 1.5,
                background: 'var(--color-surface-2)', border: '1px solid var(--color-border)',
                borderRadius: 8, padding: '10px 12px',
              }}
            >
              <b>En el teléfono:</b> al tocar “Enviar video” se abre el selector de WhatsApp con el
              video ya adjunto y el mensaje de leyenda; solo eliges el contacto y envías.
              <br />
              <b>En la PC:</b> se descarga el video y se abre el chat del cliente para que lo adjuntes
              a mano.
            </div>

            {/* Mensaje */}
            <div>
              <label style={labelStyle}>Mensaje</label>
              <textarea
                className="form-input"
                rows={4}
                value={msg}
                onChange={(e) => setMsg(e.target.value)}
                style={{ resize: 'vertical', lineHeight: 1.5 }}
              />
              <p style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 6 }}>
                Este es el texto que acompaña al video en WhatsApp.
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <button onClick={saveConfig} disabled={savingCfg} style={primaryBtn(savingCfg)}>
                <Save size={14} />
                {savingCfg ? 'Guardando...' : 'Guardar mensaje'}
              </button>
              <a href={TUTORIAL_VIDEO_PATH} download="formula-taller.mp4" style={{ ...secondaryBtn, textDecoration: 'none' }}>
                <Download size={14} />
                Descargar video
              </a>
              {cfgSaved && <span style={{ fontSize: 12, color: '#34d399' }}>Guardado ✓</span>}
            </div>
          </div>
        )}
      </div>

      {/* Controles */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <div style={{ position: 'relative', flex: '1 1 220px', minWidth: 0 }}>
          <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
          <input
            className="form-input"
            placeholder="Buscar cliente, dueño o teléfono..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingLeft: 36 }}
          />
        </div>
        <select
          className="form-input"
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          style={{ flex: '0 0 auto', width: 'auto' }}
        >
          <option value="recent">Más recientes</option>
          <option value="old">Más antiguos</option>
          <option value="orders_desc">Más órdenes</option>
          <option value="orders_asc">Menos órdenes</option>
        </select>
        <button onClick={() => setManageOpen(true)} style={secondaryBtn}>
          <TagIcon size={14} />
          Etiquetas
        </button>
      </div>

      {/* Barra de selección */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--color-text-secondary)', cursor: 'pointer' }}>
          <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} />
          Seleccionar todos ({filtered.length})
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--color-text-secondary)', cursor: 'pointer', marginLeft: 'auto' }}>
          <input type="checkbox" checked={hideTest} onChange={(e) => setHideTest(e.target.checked)} />
          Ocultar pruebas
        </label>
      </div>

      {/* Lista */}
      {filtered.length === 0 ? (
        <div className="empty-state">
          <Users size={44} />
          <p>{search ? 'No hay resultados para tu búsqueda' : 'Aún no hay clientes'}</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map((row) => (
            <ClientCard
              key={row.id}
              row={row}
              tags={tags}
              tagById={tagById}
              selected={selected.has(row.id)}
              onSelect={() => toggleSelect(row.id)}
              onSend={() => sendSingle(row)}
              tagPanelOpen={tagPanelFor === row.id}
              onToggleTagPanel={() => setTagPanelFor((cur) => (cur === row.id ? null : row.id))}
              onToggleTag={(tagId) => toggleTag(row, tagId)}
            />
          ))}
        </div>
      )}

      {/* Barra flotante de envío masivo */}
      {selectedCount > 0 && (
        <div
          style={{
            position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 45,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
            padding: '12px 16px calc(12px + env(safe-area-inset-bottom))',
            background: 'rgba(13,15,26,0.96)', backdropFilter: 'blur(12px)',
            borderTop: '1px solid var(--color-border)',
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 600 }}>{selectedCount} seleccionados</span>
          <button onClick={startBulk} style={primaryBtn(false)}>
            <Send size={14} />
            Enviar video
          </button>
          <button onClick={() => setSelected(new Set())} style={secondaryBtn}>
            Limpiar
          </button>
        </div>
      )}

      {manageOpen && (
        <ManageTagsModal
          tags={tags}
          onClose={() => setManageOpen(false)}
          onCreated={onTagCreated}
          onUpdated={onTagUpdated}
          onDeleted={onTagDeleted}
        />
      )}

      {bulk && (
        <BulkModal
          current={bulkCurrent()}
          index={bulk.index}
          total={bulk.ids.length}
          onSend={bulkSendCurrent}
          onSkip={bulkAdvance}
          onClose={() => setBulk(null)}
        />
      )}
    </div>
  );
}

// ============================================================================
// Tarjeta de cliente
// ============================================================================
function ClientCard({
  row, tags, tagById, selected, onSelect, onSend, tagPanelOpen, onToggleTagPanel, onToggleTag,
}: {
  row: SalesClientRow;
  tags: CrmTag[];
  tagById: Map<string, CrmTag>;
  selected: boolean;
  onSelect: () => void;
  onSend: () => void;
  tagPanelOpen: boolean;
  onToggleTagPanel: () => void;
  onToggleTag: (tagId: string) => void;
}) {
  return (
    <div className="card" style={{ borderColor: selected ? 'var(--color-brand-500)' : undefined }}>
      <div style={{ display: 'flex', gap: 12 }}>
        <input type="checkbox" checked={selected} onChange={onSelect} style={{ marginTop: 4, flexShrink: 0 }} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {row.name}
            </span>
            {row.is_subscribed && <Badge text="PRO" gold />}
            {row.is_test && <Badge text="TEST" />}
          </div>
          <p style={{ color: 'var(--color-text-muted)', fontSize: 12, marginTop: 3 }}>
            {row.owner_name ? `${row.owner_name} · ` : ''}
            {row.order_count} {row.order_count === 1 ? 'orden' : 'órdenes'} · {formatDate(row.created_at)}
          </p>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 12, marginTop: 3 }}>
            {row.whatsapp ? row.whatsapp : 'Sin teléfono'}
          </p>

          {/* Etiquetas asignadas */}
          {row.tag_ids.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
              {row.tag_ids.map((tid) => {
                const t = tagById.get(tid);
                if (!t) return null;
                return <TagChip key={tid} label={t.label} color={t.color} />;
              })}
            </div>
          )}

          {/* Acciones */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
            <button onClick={onSend} style={sendBtn}>
              <Send size={13} />
              {row.tutorial_sent_at ? 'Reenviar video' : 'Enviar video'}
            </button>
            <button onClick={onToggleTagPanel} style={secondaryBtn}>
              <TagIcon size={13} />
              Etiquetas
            </button>
            {row.tutorial_sent_at && (
              <span style={{ fontSize: 11, color: '#34d399', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <Check size={13} /> Enviado {formatDate(row.tutorial_sent_at)}
              </span>
            )}
          </div>

          {/* Panel de etiquetas (asignar/quitar) */}
          {tagPanelOpen && (
            <div
              style={{
                marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--color-border)',
                display: 'flex', flexWrap: 'wrap', gap: 6,
              }}
            >
              {tags.length === 0 ? (
                <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                  No hay etiquetas. Créalas con el botón “Etiquetas” de arriba.
                </span>
              ) : (
                tags.map((t) => {
                  const on = row.tag_ids.includes(t.id);
                  const s = TAG_STYLES[t.color];
                  return (
                    <button
                      key={t.id}
                      onClick={() => onToggleTag(t.id)}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 5,
                        padding: '5px 10px', borderRadius: 999, cursor: 'pointer',
                        fontSize: 12, fontWeight: 600,
                        background: on ? s.bg : 'transparent',
                        border: `1px solid ${on ? s.border : 'var(--color-border)'}`,
                        color: on ? s.fg : 'var(--color-text-muted)',
                      }}
                    >
                      {on ? <Check size={12} /> : <Plus size={12} />}
                      {t.label}
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Modal: administrar catálogo de etiquetas
// ============================================================================
function ManageTagsModal({
  tags, onClose, onCreated, onUpdated, onDeleted,
}: {
  tags: CrmTag[];
  onClose: () => void;
  onCreated: (t: CrmTag) => void;
  onUpdated: (t: CrmTag) => void;
  onDeleted: (id: string) => void;
}) {
  const [label, setLabel] = useState('');
  const [color, setColor] = useState<CrmTagColor>('neutral');
  const [busy, setBusy] = useState(false);

  async function create() {
    const l = label.trim();
    if (!l) return;
    setBusy(true);
    try {
      const res = await fetch('/api/superadmin/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: l, color }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error || 'No se pudo crear la etiqueta.');
        return;
      }
      onCreated(data);
      setLabel('');
      setColor('neutral');
    } catch {
      alert('No se pudo conectar. Inténtalo de nuevo.');
    } finally {
      setBusy(false);
    }
  }

  async function recolor(t: CrmTag, c: CrmTagColor) {
    try {
      const res = await fetch(`/api/superadmin/tags/${t.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ color: c }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) onUpdated(data);
    } catch { /* ignore */ }
  }

  async function remove(t: CrmTag) {
    if (!confirm(`¿Eliminar la etiqueta “${t.label}”? Se quitará de todos los clientes.`)) return;
    try {
      const res = await fetch(`/api/superadmin/tags/${t.id}`, { method: 'DELETE' });
      if (res.ok) onDeleted(t.id);
      else alert('No se pudo eliminar la etiqueta.');
    } catch {
      alert('No se pudo conectar. Inténtalo de nuevo.');
    }
  }

  return (
    <Overlay onClose={onClose}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <h2 style={{ fontSize: 17, fontWeight: 800 }}>Etiquetas</h2>
        <button onClick={onClose} aria-label="Cerrar" style={iconBtn}><X size={18} /></button>
      </div>

      {/* Crear */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        <input
          className="form-input"
          placeholder="Nueva etiqueta"
          value={label}
          maxLength={40}
          onChange={(e) => setLabel(e.target.value)}
          style={{ flex: '1 1 160px', minWidth: 0 }}
          onKeyDown={(e) => e.key === 'Enter' && create()}
        />
        <select className="form-input" value={color} onChange={(e) => setColor(e.target.value as CrmTagColor)} style={{ width: 'auto' }}>
          {COLOR_OPTS.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
        </select>
        <button onClick={create} disabled={busy || !label.trim()} style={primaryBtn(busy || !label.trim())}>
          <Plus size={14} /> Crear
        </button>
      </div>

      {/* Lista */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: '50vh', overflowY: 'auto' }}>
        {tags.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>Aún no hay etiquetas.</p>
        ) : (
          tags.map((t) => (
            <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <TagChip label={t.label} color={t.color} />
              <select
                className="form-input"
                value={t.color}
                onChange={(e) => recolor(t, e.target.value as CrmTagColor)}
                style={{ width: 'auto', marginLeft: 'auto', padding: '6px 10px', fontSize: 12 }}
              >
                {COLOR_OPTS.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
              </select>
              <button onClick={() => remove(t)} aria-label="Eliminar" style={{ ...iconBtn, color: '#f87171' }}>
                <Trash2 size={15} />
              </button>
            </div>
          ))
        )}
      </div>
    </Overlay>
  );
}

// ============================================================================
// Modal: envío masivo paso a paso
// ============================================================================
function BulkModal({
  current, index, total, onSend, onSkip, onClose,
}: {
  current: SalesClientRow | null;
  index: number;
  total: number;
  onSend: () => void;
  onSkip: () => void;
  onClose: () => void;
}) {
  return (
    <Overlay onClose={onClose}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <h2 style={{ fontSize: 17, fontWeight: 800 }}>Envío masivo</h2>
        <button onClick={onClose} aria-label="Cerrar" style={iconBtn}><X size={18} /></button>
      </div>
      <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 16 }}>
        En el teléfono, cada envío abre WhatsApp con el video ya adjunto: eliges el contacto y envías.
        Al volver, avanza al siguiente cliente.
      </p>

      <div className="card" style={{ marginBottom: 16, textAlign: 'center' }}>
        <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 4 }}>
          Cliente {index + 1} de {total}
        </div>
        <div style={{ fontSize: 17, fontWeight: 800 }}>{current?.name ?? '—'}</div>
        <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginTop: 2 }}>
          {current?.whatsapp ?? 'Sin teléfono'}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={onSend} style={{ ...primaryBtn(false), flex: 1, justifyContent: 'center' }}>
          <Send size={14} /> Abrir WhatsApp y marcar
        </button>
        <button onClick={onSkip} style={secondaryBtn}>Saltar</button>
      </div>
    </Overlay>
  );
}

// ============================================================================
// UI helpers
// ============================================================================
function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 70, background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="card"
        style={{ width: '100%', maxWidth: 440, maxHeight: '86vh', overflowY: 'auto' }}
      >
        {children}
      </div>
    </div>
  );
}

function TagChip({ label, color }: { label: string; color: CrmTagColor }) {
  const s = TAG_STYLES[color];
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: s.bg, border: `1px solid ${s.border}`, color: s.fg }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.dot }} />
      {label}
    </span>
  );
}

function Badge({ text, gold }: { text: string; gold?: boolean }) {
  return (
    <span style={{ fontSize: 10, fontWeight: 700, borderRadius: 999, padding: '2px 8px', flexShrink: 0, color: gold ? 'var(--color-brand-400)' : 'var(--color-text-secondary)', background: gold ? 'rgba(245,158,11,0.12)' : 'var(--color-surface-3)', border: `1px solid ${gold ? 'rgba(245,158,11,0.3)' : 'var(--color-border)'}` }}>
      {text}
    </span>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="card" style={{ padding: '12px 10px', textAlign: 'center' }}>
      <div style={{ color: 'var(--color-brand-400)', display: 'flex', justifyContent: 'center' }}>{icon}</div>
      <div style={{ fontSize: 20, fontWeight: 800, marginTop: 5 }}>{value}</div>
      <div style={{ fontSize: 10, color: 'var(--color-text-muted)', marginTop: 2 }}>{label}</div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 6,
};
const iconBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34,
  borderRadius: 8, background: 'var(--color-surface-2)', border: '1px solid var(--color-border)',
  color: 'var(--color-text-secondary)', cursor: 'pointer',
};
const secondaryBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 12px',
  background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: 8,
  fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', cursor: 'pointer', flexShrink: 0,
};
const sendBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 12px',
  background: 'rgba(37,211,102,0.14)', border: '1px solid rgba(37,211,102,0.35)', borderRadius: 8,
  fontSize: 12, fontWeight: 700, color: '#25D366', cursor: 'pointer', flexShrink: 0,
};
function primaryBtn(disabled: boolean): React.CSSProperties {
  return {
    display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px',
    background: disabled ? 'var(--color-surface-3)' : 'var(--color-brand-500)', border: 'none',
    borderRadius: 8, fontSize: 13, fontWeight: 700,
    color: disabled ? 'var(--color-text-muted)' : '#0D0F1A', cursor: disabled ? 'default' : 'pointer',
    flexShrink: 0,
  };
}
