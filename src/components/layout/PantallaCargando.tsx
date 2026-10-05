/**
 * Lo que se ve al instante al tocar una pestaña o abrir una orden, mientras el
 * servidor trae los datos (lo usan los `loading.tsx`). Imita la forma de la
 * pantalla que viene, para que el cambio se sienta inmediato y no «congelado».
 */
export default function PantallaCargando({ tipo = 'lista' }: { tipo?: 'lista' | 'detalle' }) {
  const bloque = (h: number, w: string | number = '100%', extra: React.CSSProperties = {}) => (
    <div className="skeleton" style={{ height: h, width: w, ...extra }} />
  );

  return (
    <div style={{ paddingTop: 16 }} aria-busy="true" aria-label="Cargando">
      {tipo === 'lista' ? (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
            {bloque(24, '45%')}
            {bloque(32, 80, { borderRadius: 999 })}
          </div>
          {bloque(42, '100%', { marginBottom: 12 })}
          <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
            {[70, 80, 90, 60].map((w) => (
              <div key={w}>{bloque(28, w, { borderRadius: 999 })}</div>
            ))}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {bloque(16, '55%')}
                {bloque(12, '35%')}
                {bloque(12, '75%')}
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
          {bloque(14, 90, { marginBottom: 16 })}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
            {bloque(22, '60%')}
            {bloque(14, '40%')}
            {bloque(14, '50%')}
            {bloque(36, '100%', { marginTop: 6 })}
          </div>
          {[0, 1, 2].map((i) => (
            <div key={i} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
              {bloque(18, '40%')}
              {bloque(12, '85%')}
              {bloque(12, '65%')}
            </div>
          ))}
        </>
      )}
    </div>
  );
}
