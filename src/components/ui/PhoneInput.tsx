'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Search, Check } from 'lucide-react';
import { COUNTRIES, DEFAULT_DIAL, parsePhone, composePhone, countryByDial } from '@/lib/countries';

interface PhoneInputProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  id?: string;
  placeholder?: string;
}

/**
 * Campo de teléfono con selector de código de país (Venezuela por defecto).
 * Guarda el número en formato internacional (+<dial><número>) para que los
 * enlaces de WhatsApp funcionen en cualquier dispositivo.
 */
export default function PhoneInput({
  label,
  value,
  onChange,
  required,
  id,
  placeholder = 'Ej. 412 1234567',
}: PhoneInputProps) {
  // Estado interno de las dos partes. Se inicializa desde `value` una vez (los
  // formularios remontan el componente al abrir), fuente de verdad de la UI.
  const initial = useMemo(() => parsePhone(value), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [dial, setDial] = useState(initial.dial || DEFAULT_DIAL);
  const [local, setLocal] = useState(initial.local);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  const country = countryByDial(dial);

  useEffect(() => {
    if (!open) return;
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open]);

  function emit(nextDial: string, nextLocal: string) {
    onChange(composePhone(nextDial, nextLocal));
  }

  function pickCountry(nextDial: string) {
    setDial(nextDial);
    setOpen(false);
    setQuery('');
    emit(nextDial, local);
  }

  function onLocalChange(v: string) {
    setLocal(v);
    emit(dial, v);
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COUNTRIES;
    return COUNTRIES.filter(
      (c) => c.name.toLowerCase().includes(q) || c.dial.includes(q.replace('+', ''))
    );
  }, [query]);

  return (
    <div className="form-field">
      {label && (
        <label className="form-label" htmlFor={id}>
          {label}
        </label>
      )}
      <div ref={ref} style={{ position: 'relative' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          {/* Selector de país */}
          <button
            type="button"
            className="form-input"
            onClick={() => setOpen((o) => !o)}
            aria-haspopup="listbox"
            aria-expanded={open}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              width: 'auto',
              flexShrink: 0,
              cursor: 'pointer',
              paddingRight: 10,
            }}
          >
            <span style={{ fontSize: 16 }}>{country.flag}</span>
            <span style={{ fontWeight: 600 }}>+{country.dial}</span>
            <ChevronDown
              size={15}
              style={{
                color: 'var(--color-text-muted)',
                transition: 'transform 0.15s',
                transform: open ? 'rotate(180deg)' : 'none',
              }}
            />
          </button>

          {/* Número local */}
          <input
            id={id}
            type="tel"
            inputMode="tel"
            className="form-input"
            placeholder={placeholder}
            value={local}
            onChange={(e) => onLocalChange(e.target.value)}
            required={required}
            style={{ flex: 1, minWidth: 0 }}
          />
        </div>

        {/* Menú desplegable de países */}
        {open && (
          <div
            className="select-menu"
            role="listbox"
            style={{ maxHeight: 280, overflowY: 'auto', padding: 6 }}
          >
            <div style={{ position: 'relative', marginBottom: 6 }}>
              <Search
                size={14}
                style={{
                  position: 'absolute',
                  left: 10,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--color-text-muted)',
                }}
              />
              <input
                className="form-input"
                placeholder="Buscar país..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                autoFocus
                style={{ paddingLeft: 32, height: 38 }}
              />
            </div>
            {filtered.map((c) => {
              const selected = c.dial === dial && c.iso === country.iso;
              return (
                <button
                  key={c.iso}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  className="select-option"
                  onClick={() => pickCountry(c.dial)}
                  style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                >
                  <span style={{ fontSize: 16 }}>{c.flag}</span>
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {c.name}
                  </span>
                  <span style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>+{c.dial}</span>
                  {selected && <Check size={15} style={{ color: 'var(--color-brand-500)' }} />}
                </button>
              );
            })}
            {filtered.length === 0 && (
              <p style={{ padding: '10px 8px', fontSize: 13, color: 'var(--color-text-muted)' }}>
                Sin resultados
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
