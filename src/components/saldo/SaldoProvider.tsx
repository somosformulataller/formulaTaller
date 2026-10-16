'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import CompraSaldoModal from '@/components/saldo/CompraSaldoModal';
import SinSaldoModal from '@/components/saldo/SinSaldoModal';
import RecargaInicialModal, { RECARGA_INICIAL_USD } from '@/components/saldo/RecargaInicialModal';

export interface PreciosSaldo {
  orden: number;
  preguntaIa: number;
  /** Presupuesto suelto (0028). */
  presupuesto: number;
}

interface SaldoCtx {
  saldo: number;
  precios: PreciosSaldo;
  setSaldo: (n: number) => void;
  /** Vuelve a leer el saldo del servidor. */
  refrescar: () => Promise<void>;
  abrirCompra: () => void;
  /** El aviso de «saldo insuficiente», con el botón para comprar. */
  avisarSinSaldo: (mensaje?: string) => void;
  /** true si alcanza para pagar `monto`. */
  alcanza: (monto: number) => boolean;
}

const Ctx = createContext<SaldoCtx | null>(null);

/** El saldo del taller en las pantallas del administrador (0025). */
export function useSaldo(): SaldoCtx | null {
  return useContext(Ctx);
}

export default function SaldoProvider({
  saldoInicial,
  precios,
  nuncaRecargo = false,
  children,
}: {
  saldoInicial: number;
  precios: PreciosSaldo;
  /** El taller nunca ha recargado: al entrar sale el video con «Recargar saldo». */
  nuncaRecargo?: boolean;
  children: React.ReactNode;
}) {
  const [saldo, setSaldo] = useState(saldoInicial);
  const [comprando, setComprando] = useState(false);
  const [montoCompra, setMontoCompra] = useState<number | undefined>(undefined);
  const [sinSaldo, setSinSaldo] = useState<string | null>(null);
  const [recargaInicial, setRecargaInicial] = useState(nuncaRecargo);

  // Solo en local: ?probarRecarga=1 muestra el modal aunque el taller ya haya recargado.
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' && new URLSearchParams(window.location.search).has('probarRecarga')) {
      setRecargaInicial(true);
    }
  }, []);

  const refrescar = useCallback(async () => {
    try {
      const r = await fetch('/api/saldo?solo=saldo', { cache: 'no-store' });
      if (r.ok) setSaldo(Number((await r.json()).saldo ?? 0));
    } catch {
      /* sin conexión: se queda el último valor */
    }
  }, []);

  const valor: SaldoCtx = {
    saldo,
    precios,
    setSaldo,
    refrescar,
    abrirCompra: () => {
      setMontoCompra(undefined);
      setComprando(true);
    },
    avisarSinSaldo: (m) => setSinSaldo(m ?? ''),
    // Un milésimo de margen para que 0,035 × n no falle por redondeo.
    alcanza: (monto) => saldo + 0.0001 >= monto,
  };

  return (
    <Ctx.Provider value={valor}>
      {children}
      {sinSaldo !== null && (
        <SinSaldoModal
          mensaje={sinSaldo || undefined}
          saldo={saldo}
          onComprar={() => {
            setSinSaldo(null);
            setMontoCompra(undefined);
            setComprando(true);
          }}
          onClose={() => setSinSaldo(null)}
        />
      )}
      {recargaInicial && (
        <RecargaInicialModal
          onRecargar={() => {
            setRecargaInicial(false);
            setMontoCompra(RECARGA_INICIAL_USD);
            setComprando(true);
          }}
          onClose={() => setRecargaInicial(false)}
        />
      )}
      {comprando && <CompraSaldoModal montoInicial={montoCompra} onClose={() => setComprando(false)} />}
    </Ctx.Provider>
  );
}
