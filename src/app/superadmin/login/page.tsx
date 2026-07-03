'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { ShieldCheck, Mail, Lock, Eye, EyeOff } from 'lucide-react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';

// Login del panel de superadmin de la plataforma. Ruta discreta, no enlazada
// desde el login de los talleres.
export default function SuperadminLoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) {
      setLoading(false);
      setError('Correo o contraseña incorrectos');
      return;
    }

    // Confirmar que la cuenta es superadmin de plataforma; si no, cerrar sesión.
    const res = await fetch('/api/superadmin/me');
    if (!res.ok) {
      await supabase.auth.signOut();
      setLoading(false);
      setError('Esta cuenta no tiene acceso al panel de plataforma.');
      return;
    }

    router.replace('/superadmin');
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
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, marginBottom: 36 }}
      >
        <div
          style={{
            width: 72,
            height: 72,
            background: 'linear-gradient(135deg, var(--color-brand-500), var(--color-brand-700))',
            borderRadius: 20,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 8px 32px rgba(245,158,11,0.35)',
          }}
        >
          <ShieldCheck size={36} color="#0D0F1A" strokeWidth={2.5} />
        </div>
        <div style={{ textAlign: 'center' }}>
          <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em' }}>
            Panel de plataforma
          </h1>
          <p style={{ color: 'var(--color-text-secondary)', marginTop: 4, fontSize: 14 }}>
            Acceso solo para administradores del sistema
          </p>
        </div>
      </div>

      <div className="card animate-slide-up glass" style={{ width: '100%', maxWidth: 400, padding: 28 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>Iniciar sesión</h2>

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Input
            label="Correo electrónico"
            type="email"
            placeholder="tu@correo.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            icon={<Mail size={15} />}
            id="sa-login-email"
          />

          <div className="form-field">
            <label className="form-label" htmlFor="sa-login-password">
              Contraseña
            </label>
            <div style={{ position: 'relative' }}>
              <Lock
                size={15}
                style={{
                  position: 'absolute',
                  left: 12,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--color-text-muted)',
                }}
              />
              <input
                id="sa-login-password"
                type={showPass ? 'text' : 'password'}
                className="form-input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                style={{ paddingLeft: 40, paddingRight: 44 }}
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                style={{
                  position: 'absolute',
                  right: 12,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: 'var(--color-text-muted)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          {error && (
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
              {error}
            </div>
          )}

          <Button type="submit" variant="primary" fullWidth size="lg" loading={loading}>
            Entrar
          </Button>
        </form>
      </div>
    </div>
  );
}
