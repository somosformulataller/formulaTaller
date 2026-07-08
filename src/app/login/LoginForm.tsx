'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Wrench, Mail, Lock, Eye, EyeOff } from 'lucide-react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import InstallButton from '@/components/pwa/InstallButton';
import { trackFbEvent } from '@/lib/fbpixel';

interface LoginFormProps {
  workshopName?: string;
  logoUrl?: string | null;
}

export default function LoginForm({ workshopName, logoUrl }: LoginFormProps = {}) {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    trackFbEvent('ClickIniciarSesion');
    setError(null);
    setLoading(true);

    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setLoading(false);
      setError('Correo o contraseña incorrectos');
      return;
    }

    // ¿Es superadmin de plataforma? No tiene perfil de taller; se verifica con
    // un endpoint seguro (platform_admins está bloqueada por RLS al navegador).
    const saRes = await fetch('/api/superadmin/me');
    if (saRes.ok) {
      router.replace('/superadmin');
      return;
    }

    // Si no, redirigir según el rol dentro del taller.
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', data.user.id)
      .single();

    if (profile?.role === 'admin') {
      router.replace('/admin');
    } else {
      router.replace('/mecanico');
    }
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
        background: 'radial-gradient(ellipse at top, rgba(245,158,11,0.08) 0%, transparent 60%), var(--color-bg)',
      }}
    >
      {/* Logo */}
      <div
        className="animate-slide-up"
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, marginBottom: 40 }}
      >
        <div
          style={{
            width: 72,
            height: 72,
            background: logoUrl
              ? 'var(--color-surface-2)'
              : 'linear-gradient(135deg, var(--color-brand-500), var(--color-brand-700))',
            borderRadius: 20,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 8px 32px rgba(245,158,11,0.35)',
            overflow: 'hidden',
          }}
        >
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt={workshopName || 'Logo'}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <Wrench size={36} color="#0D0F1A" strokeWidth={2.5} />
          )}
        </div>
        <div style={{ textAlign: 'center' }}>
          <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em' }}>
            {workshopName || 'Formula Taller'}
          </h1>
          <p style={{ color: 'var(--color-text-secondary)', marginTop: 4, fontSize: 14 }}>
            Sistema de gestión de taller
          </p>
        </div>
      </div>

      {/* Card */}
      <div
        className="card animate-slide-up glass"
        style={{
          width: '100%',
          maxWidth: 400,
          padding: 28,
          animationDelay: '0.1s',
        }}
      >
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>
          Iniciar sesión
        </h2>

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
            id="login-email"
          />

          <div className="form-field">
            <label className="form-label" htmlFor="login-password">
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
                id="login-password"
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

        <div
          style={{
            marginTop: 20,
            paddingTop: 18,
            borderTop: '1px solid var(--color-border)',
            textAlign: 'center',
            fontSize: 13,
            color: 'var(--color-text-secondary)',
          }}
        >
          ¿No tienes taller registrado?{' '}
          <Link
            href="/registro"
            onClick={() => trackFbEvent('ClickCrearTaller')}
            style={{ color: 'var(--color-brand-400)', fontWeight: 700, textDecoration: 'none' }}
          >
            Crear taller
          </Link>
        </div>
      </div>

      <InstallButton />

      <p style={{ marginTop: 20, color: 'var(--color-text-muted)', fontSize: 12, textAlign: 'center' }}>
        Formula Taller © {new Date().getFullYear()}
        <br />
        <Link href="/terminos" style={{ color: 'var(--color-text-muted)' }}>Términos</Link>
        {' · '}
        <Link href="/privacidad" style={{ color: 'var(--color-text-muted)' }}>Privacidad</Link>
      </p>
    </div>
  );
}
