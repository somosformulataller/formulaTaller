'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Lock, ShieldCheck, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import Button from '@/components/ui/Button';

// Página a la que llega el usuario desde el correo de "restablecer contraseña".
// El cliente de Supabase detecta el token de recuperación en la URL y crea una
// sesión temporal; aquí solo pedimos la nueva contraseña.
export default function ResetPasswordPage() {
  const supabase = createClient();
  const router = useRouter();

  const [ready, setReady] = useState(false); // hay sesión de recuperación
  const [checking, setChecking] = useState(true);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let active = true;

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active && session) {
        setReady(true);
        setChecking(false);
      }
    });

    // Intercambiar el código (flujo PKCE) si viene en la URL.
    const href = typeof window !== 'undefined' ? window.location.href : '';
    if (href.includes('code=')) {
      supabase.auth.exchangeCodeForSession(href).catch(() => {});
    }

    // Revisar si ya hay sesión (flujo con token en el hash).
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      if (data.session) setReady(true);
      // Dar un margen por si el evento de recuperación llega enseguida.
      setTimeout(() => active && setChecking(false), 1200);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [supabase]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (password !== confirm) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    setLoading(true);
    const { error: updErr } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (updErr) {
      setError(updErr.message || 'No se pudo actualizar la contraseña.');
      return;
    }
    setDone(true);
    await supabase.auth.signOut();
    setTimeout(() => router.replace('/login'), 2200);
  }

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
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, marginBottom: 28 }}
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
          <ShieldCheck size={32} color="#0D0F1A" strokeWidth={2.5} />
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 800 }}>Restablecer contraseña</h1>
      </div>

      <div className="card animate-slide-up glass" style={{ width: '100%', maxWidth: 400, padding: 28 }}>
        {done ? (
          <div style={{ textAlign: 'center' }}>
            <CheckCircle2 size={40} color="#34d399" style={{ margin: '0 auto 12px' }} />
            <p style={{ fontWeight: 700, marginBottom: 6 }}>¡Contraseña actualizada!</p>
            <p style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
              Te llevamos al inicio de sesión...
            </p>
          </div>
        ) : checking ? (
          <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', textAlign: 'center' }}>
            Verificando el enlace...
          </p>
        ) : !ready ? (
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontWeight: 700, marginBottom: 8 }}>Enlace inválido o vencido</p>
            <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 16 }}>
              El enlace de restablecimiento no es válido o ya expiró. Pide uno nuevo.
            </p>
            <Button variant="secondary" fullWidth onClick={() => router.replace('/login')}>
              Ir al inicio de sesión
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <p style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
              Escribe tu nueva contraseña.
            </p>
            <div className="form-field">
              <label className="form-label" htmlFor="new-pass">Nueva contraseña</label>
              <div style={{ position: 'relative' }}>
                <Lock size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
                <input
                  id="new-pass"
                  type={showPass ? 'text' : 'password'}
                  className="form-input"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  style={{ paddingLeft: 40, paddingRight: 44 }}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', display: 'flex' }}
                >
                  {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
            <div className="form-field">
              <label className="form-label" htmlFor="confirm-pass">Repetir contraseña</label>
              <div style={{ position: 'relative' }}>
                <Lock size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
                <input
                  id="confirm-pass"
                  type={showPass ? 'text' : 'password'}
                  className="form-input"
                  placeholder="••••••••"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  style={{ paddingLeft: 40 }}
                />
              </div>
            </div>

            {error && (
              <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, color: '#f87171', fontSize: 13 }}>
                {error}
              </div>
            )}

            <Button type="submit" variant="primary" fullWidth size="lg" loading={loading}>
              Guardar nueva contraseña
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
