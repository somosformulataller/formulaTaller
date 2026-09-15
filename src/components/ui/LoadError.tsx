// Estado de error para Server Components: cuando una consulta a la base de datos
// falla, hay que MOSTRARLO, no seguir renderizando con datos vacíos (un fallo
// disfrazado de "0 talleres / 0 órdenes" hace tomar decisiones sobre datos
// falsos — auditoría 15/09/2026, hallazgo 9).
export default function LoadError({
  message,
  detail,
}: {
  message: string;
  detail?: string;
}) {
  return (
    <div style={{ maxWidth: 560, margin: '48px auto', padding: '0 16px' }}>
      <div
        style={{
          padding: '18px 20px',
          background: 'rgba(239,68,68,0.08)',
          border: '1px solid rgba(239,68,68,0.35)',
          borderRadius: 10,
        }}
      >
        <p style={{ fontWeight: 700, color: '#ef4444', marginBottom: 6 }}>
          No se pudieron cargar los datos
        </p>
        <p style={{ fontSize: 14, color: 'var(--color-text-secondary)' }}>{message}</p>
        {detail && (
          <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 8 }}>{detail}</p>
        )}
      </div>
    </div>
  );
}
