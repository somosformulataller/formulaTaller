'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Car, CalendarClock, CheckCircle2, ClipboardList, MessageCircle, User } from 'lucide-react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import PhoneInput from '@/components/ui/PhoneInput';
import BudgetList, { nuevoRenglon, totalDe, type Renglon } from '@/components/orders/BudgetList';
import { Horas } from '@/components/presupuestos/Citas';
import { useSaldo } from '@/components/saldo/SaldoProvider';
import { formatPrecioUsd, formatUsd, parseAmount } from '@/lib/budget';
import { hoyVE } from '@/lib/recordatorios';
import { openWhatsApp } from '@/lib/utils';
import { buildQuoteMessage, estaOcupado, formatCita, type Cita, type Quote } from '@/lib/presupuestos';

export interface DatosIniciales {
  client_first_name: string;
  client_last_name: string;
  client_whatsapp: string;
  car_model: string;
}

/**
 * «Enviar presupuesto»: el presupuesto que se le manda al cliente ANTES de
 * crear la orden (0028), con la cita agendada si se quiere. Guardarlo cobra
 * saldo; editarlo después, no.
 */
export default function QuoteForm({
  quote,
  inicial,
  workshopName,
}: {
  /** Editando uno ya guardado. */
  quote?: Quote;
  /** Datos del cliente para uno nuevo (p. ej. desde Clientes). */
  inicial?: DatosIniciales;
  workshopName: string;
}) {
  const saldo = useSaldo();
  const [guardado, setGuardado] = useState<Quote | null>(quote ?? null);
  const [form, setForm] = useState<DatosIniciales>({
    client_first_name: quote?.client_first_name ?? inicial?.client_first_name ?? '',
    client_last_name: quote?.client_last_name ?? inicial?.client_last_name ?? '',
    client_whatsapp: quote?.client_whatsapp ?? inicial?.client_whatsapp ?? '',
    car_model: quote?.car_model ?? inicial?.car_model ?? '',
  });
  const [budget, setBudget] = useState<Renglon[]>(() =>
    (quote?.items ?? []).map((i) => ({
      ...nuevoRenglon(i.description, String(i.amount), i.labor_amount ? String(i.labor_amount) : ''),
      conMano: i.labor_amount > 0,
    }))
  );
  const [manoGeneral, setManoGeneral] = useState(quote?.labor_general_usd ? String(quote.labor_general_usd) : '');
  const [dia, setDia] = useState(quote?.cita?.day ?? '');
  const [hora, setHora] = useState<string | null>(quote?.cita?.at_time ?? null);
  const [delDia, setDelDia] = useState<Cita[]>([]);
  const [cargando, setCargando] = useState<'' | 'enviar' | 'guardar'>('');
  const [error, setError] = useState<string | null>(null);
  const [listo, setListo] = useState<{ enviado: boolean; mensaje: string } | null>(null);
  const vinculado = Boolean(guardado?.order_id);

  // Lo ya agendado ese día: las horas ocupadas no se pueden elegir.
  useEffect(() => {
    if (!dia) {
      setDelDia([]);
      return;
    }
    let vivo = true;
    (async () => {
      try {
        const res = await fetch(`/api/citas?from=${dia}&to=${dia}`, { cache: 'no-store' });
        if (res.ok && vivo) setDelDia(await res.json());
      } catch {
        /* sin el dato: el servidor igual comprueba al guardar */
      }
    })();
    return () => {
      vivo = false;
    };
  }, [dia]);

  // La propia cita de este presupuesto no cuenta como «ya agendada».
  const otras = delDia.filter((c) => c.quote_id !== guardado?.id);
  const diaOcupado = dia !== '' && estaOcupado(otras, dia, null);
  const total = (Math.round(totalDe(budget) * 100) + Math.round((parseAmount(manoGeneral) ?? 0) * 100)) / 100;

  function set(k: keyof DatosIniciales, v: string) {
    setForm((p) => ({ ...p, [k]: v }));
  }

  function items() {
    return budget
      .map((r) => ({
        description: r.description.trim(),
        amount: parseAmount(r.amount) ?? 0,
        labor_amount: parseAmount(r.labor) ?? 0,
      }))
      .filter((r) => r.description !== '');
  }

  async function guardar(enviar: boolean) {
    setError(null);
    if (!form.client_first_name.trim()) return setError('Escribe el nombre del cliente.');
    if (form.client_whatsapp.replace(/\D/g, '').length < 10) return setError('Escribe el WhatsApp del cliente.');
    if (dia && diaOcupado) return setError('Ese día está marcado como ocupado. Elige otro.');
    const nuevo = !guardado;
    if (nuevo && saldo && !saldo.alcanza(saldo.precios.presupuesto)) {
      saldo.avisarSinSaldo('No tienes saldo para guardar el presupuesto. Debes recargar saldo para seguir enviando presupuestos.');
      return;
    }

    const lista = items();
    const mano = parseAmount(manoGeneral) ?? 0;
    const cita = dia ? { day: dia, at_time: hora } : null;
    setCargando(enviar ? 'enviar' : 'guardar');
    try {
      const res = await fetch(nuevo ? '/api/quotes' : `/api/quotes/${guardado!.id}`, {
        method: nuevo ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, items: lista, labor_general_usd: mano, cita, enviado: enviar }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 402 && data.saldoInsuficiente) {
          saldo?.refrescar();
          saldo?.avisarSinSaldo(data.error);
          return;
        }
        throw new Error(data.error || 'No se pudo guardar el presupuesto.');
      }
      if (nuevo) saldo?.refrescar();
      const q = data as Quote & { citaError?: string | null };
      setGuardado(q);
      if (q.citaError) setError(`El presupuesto se guardó, pero la cita no: ${q.citaError}`);

      const mensaje = buildQuoteMessage({
        nombre: form.client_first_name,
        carro: form.car_model,
        items: lista,
        manoGeneral: mano,
        taller: workshopName,
        cita: q.cita ? { day: q.cita.day, at_time: q.cita.at_time } : null,
      });
      if (enviar) openWhatsApp(form.client_whatsapp, mensaje);
      setListo({ enviado: enviar, mensaje });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar el presupuesto.');
    } finally {
      setCargando('');
    }
  }

  if (listo && guardado) {
    return (
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'stretch' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <CheckCircle2 size={22} style={{ color: '#34d399', flexShrink: 0 }} />
          <div>
            <p style={{ fontSize: 16, fontWeight: 800 }}>Presupuesto guardado</p>
            <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginTop: 2 }}>
              {guardado.client_first_name} {guardado.client_last_name} · {formatUsd(total)}
              {guardado.cita && ` · Cita: ${formatCita(guardado.cita.day, guardado.cita.at_time)}`}
            </p>
          </div>
        </div>
        {error && <p style={{ color: 'var(--color-danger)', fontSize: 13 }}>{error}</p>}
        <Button
          type="button"
          variant={listo.enviado ? 'secondary' : 'primary'}
          fullWidth
          onClick={() => {
            openWhatsApp(form.client_whatsapp, listo.mensaje);
            if (!listo.enviado) {
              fetch(`/api/quotes/${guardado.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ solo_enviado: true }),
              }).catch(() => {});
            }
          }}
        >
          <MessageCircle size={16} />
          {listo.enviado ? '¿No se abrió WhatsApp? Ábrelo aquí' : 'Enviar por WhatsApp'}
        </Button>
        <Link href={`/admin/ordenes?presupuesto=${guardado.id}`} className="btn btn-secondary btn-full" style={{ textDecoration: 'none' }}>
          <ClipboardList size={16} />
          Crear orden con este presupuesto
        </Link>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <Button type="button" variant="ghost" onClick={() => setListo(null)}>
            Seguir editando
          </Button>
          <Link href="/admin/clientes" className="btn btn-ghost" style={{ textDecoration: 'none', justifyContent: 'center' }}>
            Ir a Clientes
          </Link>
        </div>
      </div>
    );
  }

  if (vinculado) {
    return (
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <p style={{ fontSize: 14 }}>Este presupuesto ya está en una orden. Edítalo desde la orden.</p>
        <Link href={`/admin/ordenes/${guardado!.order_id}`} className="btn btn-primary btn-full" style={{ textDecoration: 'none' }}>
          Ver la orden
        </Link>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
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
          />
        </div>
        <PhoneInput label="WhatsApp" value={form.client_whatsapp} onChange={(v) => set('client_whatsapp', v)} required />
        <Input
          label="Modelo del vehículo"
          placeholder="Toyota Corolla 2019"
          value={form.car_model}
          onChange={(e) => set('car_model', e.target.value)}
          icon={<Car size={15} />}
        />
      </div>

      <div className="card">
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Presupuesto</h2>
        <BudgetList
          borrador={budget}
          onBorradorChange={setBudget}
          manoGeneralBorrador={manoGeneral}
          onManoGeneralBorradorChange={setManoGeneral}
        />
      </div>

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 15, fontWeight: 700 }}>
          <CalendarClock size={17} style={{ color: 'var(--color-brand-400)' }} />
          Agendar cita (opcional)
        </h2>
        <div className="form-field">
          <label className="form-label" htmlFor="cita-dia">
            Día
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              id="cita-dia"
              type="date"
              className="form-input"
              min={hoyVE()}
              value={dia}
              onChange={(e) => {
                setDia(e.target.value);
                setHora(null);
              }}
              style={{ flex: 1 }}
            />
            {dia && (
              <Button type="button" variant="ghost" size="sm" onClick={() => (setDia(''), setHora(null))}>
                Quitar
              </Button>
            )}
          </div>
        </div>
        {dia && diaOcupado && (
          <p style={{ fontSize: 13, color: 'var(--color-danger)' }}>El taller marcó este día como ocupado.</p>
        )}
        {dia && !diaOcupado && (
          <div className="form-field">
            <label className="form-label">Hora (opcional)</label>
            <Horas dia={dia} delDia={otras} elegidas={hora ? [hora] : []} onToggle={(h) => setHora(hora === h ? null : h)} />
          </div>
        )}
      </div>

      {error && <p style={{ color: 'var(--color-danger)', fontSize: 13 }}>{error}</p>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <p style={{ fontSize: 14, fontWeight: 700, textAlign: 'right' }}>Total: {formatUsd(total)}</p>
        <Button type="button" variant="primary" fullWidth loading={cargando === 'enviar'} disabled={cargando !== ''} onClick={() => guardar(true)}>
          <MessageCircle size={16} />
          Guardar y enviar por WhatsApp
        </Button>
        <Button type="button" variant="secondary" fullWidth loading={cargando === 'guardar'} disabled={cargando !== ''} onClick={() => guardar(false)}>
          Solo guardar
        </Button>
        {!guardado && saldo && (
          <p style={{ fontSize: 11.5, color: 'var(--color-text-muted)', textAlign: 'center' }}>
            Guardar el presupuesto descuenta {formatPrecioUsd(saldo.precios.presupuesto)} de tu saldo ({formatUsd(saldo.saldo)}).
          </p>
        )}
      </div>
    </div>
  );
}
