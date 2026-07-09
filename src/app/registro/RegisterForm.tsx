'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Wrench, Store, Mail, User, Lock } from 'lucide-react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import PhoneInput from '@/components/ui/PhoneInput';
import { trackFbEventOnce, trackInteraccionFormulaTaller } from '@/lib/fbpixel';
import type { RegisterWorkshopPayload } from '@/lib/types';

export default function RegisterForm() {
  const router = useRouter();
  const supabase = createClient();

  const [form, setForm] = useState<RegisterWorkshopPayload>({
    workshop_name: '',
    email: '',
    whatsapp: '',
    first_name: '',
    last_name: '',
    password: '',
    password_confirm: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);

  function set<K extends keyof RegisterWorkshopPayload>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Click en "Registrar mi taller" (intención de terminar el registro).
    trackFbEventOnce('ClickRegistrarTaller');
    trackInteraccionFormulaTaller();
    setError(null);

    if (!accepted) {
      setError('Debes aceptar los Términos y la Política de Privacidad.');
      return;
    }
    if (form.password !== form.password_confirm) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    if (form.password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    setLoading(true);
    const res = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setLoading(false);
      setError(data.error || 'No se pudo completar el registro.');
      return;
    }

    // Auto sign-in and go to the admin panel.
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: form.email.trim(),
      password: form.password,
    });
    if (signInError) {
      setLoading(false);
      // Account was created; just send them to login.
      router.replace('/login');
      return;
    }
    router.replace('/admin');
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
      {/* Logo */}
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
          <Wrench size={32} color="#0D0F1A" strokeWidth={2.5} />
        </div>
        <div style={{ textAlign: 'center' }}>
          <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em' }}>
            Registra tu taller
          </h1>
          <p style={{ color: 'var(--color-text-secondary)', marginTop: 4, fontSize: 14 }}>
            Crea tu taller virtual de seguimiento
          </p>
        </div>
      </div>

      {/* Card */}
      <div
        className="card animate-slide-up glass"
        style={{ width: '100%', maxWidth: 420, padding: 28, animationDelay: '0.1s' }}
      >
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Input
            label="Nombre del taller"
            placeholder="Ej. Taller El Rayo"
            value={form.workshop_name}
            onChange={(e) => set('workshop_name', e.target.value)}
            required
            icon={<Store size={15} />}
            id="reg-workshop"
          />

          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <Input
                label="Nombre"
                placeholder="Juan"
                value={form.first_name}
                onChange={(e) => set('first_name', e.target.value)}
                required
                icon={<User size={15} />}
                id="reg-first"
              />
            </div>
            <div style={{ flex: 1 }}>
              <Input
                label="Apellido"
                placeholder="Pérez"
                value={form.last_name}
                onChange={(e) => set('last_name', e.target.value)}
                required
                id="reg-last"
              />
            </div>
          </div>

          <Input
            label="Correo electrónico"
            type="email"
            placeholder="tu@correo.com"
            value={form.email}
            onChange={(e) => set('email', e.target.value)}
            required
            autoComplete="email"
            icon={<Mail size={15} />}
            id="reg-email"
          />

          <PhoneInput
            label="WhatsApp"
            value={form.whatsapp}
            onChange={(v) => set('whatsapp', v)}
            required
            id="reg-whatsapp"
          />

          <Input
            label="Contraseña"
            type="password"
            placeholder="••••••••"
            value={form.password}
            onChange={(e) => set('password', e.target.value)}
            required
            autoComplete="new-password"
            icon={<Lock size={15} />}
            id="reg-password"
          />

          <Input
            label="Repetir contraseña"
            type="password"
            placeholder="••••••••"
            value={form.password_confirm}
            onChange={(e) => set('password_confirm', e.target.value)}
            required
            autoComplete="new-password"
            icon={<Lock size={15} />}
            id="reg-password2"
          />

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

          <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 12, color: 'var(--color-text-secondary)', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
              style={{ marginTop: 2 }}
            />
            <span>
              Acepto los{' '}
              <Link href="/terminos" target="_blank" style={{ color: 'var(--color-brand-400)' }}>Términos</Link>
              {' '}y la{' '}
              <Link href="/privacidad" target="_blank" style={{ color: 'var(--color-brand-400)' }}>Política de Privacidad</Link>.
            </span>
          </label>

          <Button type="submit" variant="primary" fullWidth size="lg" loading={loading} disabled={!accepted}>
            Registrar mi taller
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
          ¿Ya tienes cuenta?{' '}
          <Link
            href="/login"
            style={{ color: 'var(--color-brand-400)', fontWeight: 700, textDecoration: 'none' }}
          >
            Iniciar sesión
          </Link>
        </div>
      </div>

      <p style={{ marginTop: 24, color: 'var(--color-text-muted)', fontSize: 12 }}>
        Formula Taller © {new Date().getFullYear()}
      </p>
    </div>
  );
}
