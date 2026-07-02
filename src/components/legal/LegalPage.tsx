import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '28px 20px 60px' }}>
      <Link
        href="/login"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          color: 'var(--color-text-secondary)',
          textDecoration: 'none',
          fontSize: 13,
          marginBottom: 18,
        }}
      >
        <ArrowLeft size={15} /> Volver
      </Link>
      <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 4 }}>{title}</h1>
      <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 24 }}>
        Última actualización: {updated}
      </p>
      <style>{`
        .legal-prose h2 { font-size: 16px; font-weight: 700; color: var(--color-text-primary); margin: 22px 0 8px; }
        .legal-prose p { margin: 0 0 12px; }
        .legal-prose strong { color: var(--color-text-primary); }
      `}</style>
      <div className="legal-prose" style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--color-text-secondary)' }}>
        {children}
      </div>
    </div>
  );
}
