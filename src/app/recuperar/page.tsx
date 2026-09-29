'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { KeyRound, Mail, Lock, Store, Eye, EyeOff } from 'lucide-react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import PhoneInput from '@/components/ui/PhoneInput';
import { alEscribir, alSerInvalido } from '@/lib/validacion';
import { CLAVE_MINIMA } from '@/lib/recuperar';

// Recuperar la contraseña SIN salir de esta pantalla: los datos del registro
// y, si cuadran, la contraseña nueva justo debajo. Nada de «te enviamos un
// correo, ve a buscarlo». Es el mismo flujo de La Mejor Llave.
export default function RecuperarPage() {
  const router = useRouter();
  const supabase = createClient();

  const [paso, setPaso] = useState<1 | 2>(1);
  const [correo, setCorreo] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [taller, setTaller] = useState('');

  const [permiso, setPermiso] = useState('');
  const [nombre, setNombre] = useState<string | null>(null);
  const [clave, setClave] = useState('');
  const [repetida, setRepetida] = useState('');
  const [verClave, setVerClave] = useState(false);

  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function verificar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCargando(true);
    try {
      const res = await fetch('/api/auth/recuperar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ correo, whatsapp, taller }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'No se pudo verificar. Inténtalo de nuevo.');
        return;
      }
      setPermiso(data.permiso);
      setNombre(data.nombre ?? null);
      setPaso(2);
    } catch {
      setError('No hay conexión. Revisa tu internet e inténtalo otra vez.');
    } finally {
      setCargando(false);
    }
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCargando(true);
    try {
      const res = await fetch('/api/auth/recuperar/clave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permiso, clave, repetida, correo }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'No se pudo cambiar la contraseña.');
        // El permiso ya no sirve: volver a los datos en vez de dejar un botón muerto.
        if (res.status === 401) {
          setPaso(1);
          setPermiso('');
        }
        return;
      }
      // Entrar directamente con la contraseña recién puesta.
      const { error: errorEntrada } = await supabase.auth.signInWithPassword({
        email: correo.trim(),
        password: clave,
      });
      if (errorEntrada) {
        setError('Contraseña cambiada. Vuelve al inicio de sesión y entra con ella.');
        return;
      }
      router.replace('/admin');
    } catch {
      setError('No hay conexión. Revisa tu internet e inténtalo otra vez.');
    } finally {
      setCargando(false);
    }
  }

  const campoClave = (id: string, valor: string, cambiar: (v: string) => void, etiqueta: string, foco = false) => (
    <div className="form-field">
      <label className="form-label" htmlFor={id}>{etiqueta}</label>
      <div style={{ position: 'relative' }}>
        <Lock size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
        <input
          id={id}
          type={verClave ? 'text' : 'password'}
          className="form-input"
          placeholder="••••••••"
          value={valor}
          onChange={(e) => cambiar(e.target.value)}
          required
          minLength={CLAVE_MINIMA}
          onInvalid={alSerInvalido}
          onInput={alEscribir}
          autoComplete="new-password"
          autoFocus={foco}
          style={{ paddingLeft: 40, paddingRight: 44 }}
        />
        <button
          type="button"
          onClick={() => setVerClave(!verClave)}
          aria-label={verClave ? 'Ocultar contraseña' : 'Ver contraseña'}
          style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', display: 'flex' }}
        >
          {verClave ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
      </div>
    </div>
  );

  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 20px',
        background:
          'radial-gradient(ellipse at top, rgba(245,158,11,0.08) 0%, transparent 60%), var(--color-bg)',
      }}
    >
      <div
        className="animate-slide-up"
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, marginBottom: 28, textAlign: 'center' }}
      >
        <div
          style={{
            width: 64,
            height: 64,
            background: 'linear-gradient(135deg, var(--color-brand-500), var(--color-brand-700))',
            borderRadius: 18,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 8px 32px rgba(245,158,11,0.35)',
          }}
        >
          <KeyRound size={32} color="#0D0F1A" strokeWidth={2.5} />
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 800 }}>
          {paso === 1 ? 'Recuperar mi cuenta' : 'Tu nueva contraseña'}
        </h1>
        <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', maxWidth: 360 }}>
          {paso === 1
            ? 'Confirma que eres tú con los datos que usaste al registrar tu taller'
            : `${nombre ? `¡Hola, ${nombre}! ` : ''}Elige una contraseña nueva y entras al momento`}
        </p>
      </div>

      <div className="card animate-slide-up glass" style={{ width: '100%', maxWidth: 400, padding: 28 }}>
        {paso === 1 ? (
          <form onSubmit={verificar} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Input
              label="Correo electrónico"
              type="email"
              placeholder="tu@correo.com"
              value={correo}
              onChange={(e) => setCorreo(e.target.value)}
              required
              autoComplete="email"
              autoFocus
              icon={<Mail size={15} />}
              id="rec-correo"
            />
            <PhoneInput
              label="WhatsApp que registraste"
              value={whatsapp}
              onChange={setWhatsapp}
              required
              id="rec-whatsapp"
            />
            <Input
              label="Nombre del taller"
              type="text"
              placeholder="Ej. Taller El Rayo"
              value={taller}
              onChange={(e) => setTaller(e.target.value)}
              required
              maxLength={120}
              icon={<Store size={15} />}
              id="rec-taller"
            />

            {error && <Aviso texto={error} />}

            <Button type="submit" variant="primary" fullWidth size="lg" loading={cargando}>
              Continuar
            </Button>

            <p style={{ fontSize: 12, color: 'var(--color-text-muted)', textAlign: 'center' }}>
              ¿Eres mecánico? Pídele al administrador de tu taller que te cambie la contraseña
              desde Mecánicos.
            </p>
          </form>
        ) : (
          <form onSubmit={guardar} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {campoClave('rec-clave', clave, setClave, 'Contraseña nueva', true)}
            <span style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: -10 }}>
              Mínimo {CLAVE_MINIMA} caracteres
            </span>
            {campoClave('rec-repetida', repetida, setRepetida, 'Repite la contraseña')}

            {error && <Aviso texto={error} />}

            <Button type="submit" variant="primary" fullWidth size="lg" loading={cargando}>
              Guardar y entrar
            </Button>
          </form>
        )}

        <div
          style={{
            marginTop: 20,
            paddingTop: 18,
            borderTop: '1px solid var(--color-border)',
            textAlign: 'center',
            fontSize: 13,
          }}
        >
          <Link href="/login" style={{ color: 'var(--color-brand-400)', fontWeight: 700, textDecoration: 'none' }}>
            ← Volver al inicio de sesión
          </Link>
        </div>
      </div>
    </div>
  );
}

function Aviso({ texto }: { texto: string }) {
  return (
    <div
      style={{
        padding: '10px 14px',
        background: 'rgba(239,68,68,0.1)',
        border: '1px solid rgba(239,68,68,0.2)',
        borderRadius: 8,
        color: '#f87171',
        fontSize: 13,
      }}
    >
      {texto}
    </div>
  );
}
