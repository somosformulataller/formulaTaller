// Lista de países con su código telefónico (dial) para el selector de teléfono.
// Venezuela es el valor por defecto. La app arma los números en formato
// internacional (+<dial><número>), lo que hace que los enlaces de WhatsApp
// abran bien en cualquier dispositivo (móvil y WhatsApp Web).

export interface Country {
  iso: string;
  name: string;
  dial: string; // sin '+'
  flag: string;
}

export const DEFAULT_DIAL = '58'; // Venezuela

export const COUNTRIES: Country[] = [
  { iso: 'VE', name: 'Venezuela', dial: '58', flag: '🇻🇪' },
  { iso: 'CO', name: 'Colombia', dial: '57', flag: '🇨🇴' },
  { iso: 'AR', name: 'Argentina', dial: '54', flag: '🇦🇷' },
  { iso: 'BO', name: 'Bolivia', dial: '591', flag: '🇧🇴' },
  { iso: 'BR', name: 'Brasil', dial: '55', flag: '🇧🇷' },
  { iso: 'CL', name: 'Chile', dial: '56', flag: '🇨🇱' },
  { iso: 'CR', name: 'Costa Rica', dial: '506', flag: '🇨🇷' },
  { iso: 'CU', name: 'Cuba', dial: '53', flag: '🇨🇺' },
  { iso: 'EC', name: 'Ecuador', dial: '593', flag: '🇪🇨' },
  { iso: 'SV', name: 'El Salvador', dial: '503', flag: '🇸🇻' },
  { iso: 'ES', name: 'España', dial: '34', flag: '🇪🇸' },
  { iso: 'US', name: 'Estados Unidos', dial: '1', flag: '🇺🇸' },
  { iso: 'GT', name: 'Guatemala', dial: '502', flag: '🇬🇹' },
  { iso: 'HN', name: 'Honduras', dial: '504', flag: '🇭🇳' },
  { iso: 'MX', name: 'México', dial: '52', flag: '🇲🇽' },
  { iso: 'NI', name: 'Nicaragua', dial: '505', flag: '🇳🇮' },
  { iso: 'PA', name: 'Panamá', dial: '507', flag: '🇵🇦' },
  { iso: 'PY', name: 'Paraguay', dial: '595', flag: '🇵🇾' },
  { iso: 'PE', name: 'Perú', dial: '51', flag: '🇵🇪' },
  { iso: 'PR', name: 'Puerto Rico', dial: '1', flag: '🇵🇷' },
  { iso: 'DO', name: 'República Dominicana', dial: '1', flag: '🇩🇴' },
  { iso: 'UY', name: 'Uruguay', dial: '598', flag: '🇺🇾' },
  { iso: 'CA', name: 'Canadá', dial: '1', flag: '🇨🇦' },
  { iso: 'PT', name: 'Portugal', dial: '351', flag: '🇵🇹' },
  { iso: 'IT', name: 'Italia', dial: '39', flag: '🇮🇹' },
  { iso: 'FR', name: 'Francia', dial: '33', flag: '🇫🇷' },
  { iso: 'DE', name: 'Alemania', dial: '49', flag: '🇩🇪' },
  { iso: 'GB', name: 'Reino Unido', dial: '44', flag: '🇬🇧' },
  { iso: 'CN', name: 'China', dial: '86', flag: '🇨🇳' },
];

// Códigos ordenados de más largo a más corto, para hacer coincidir el prefijo
// más específico primero (ej. 598 Uruguay antes que 58 Venezuela).
const DIALS_BY_LENGTH = Array.from(new Set(COUNTRIES.map((c) => c.dial))).sort(
  (a, b) => b.length - a.length
);

/**
 * Separa un número guardado en { dial, local }.
 * - Si viene en internacional (+.. o 00..), detecta el código de país.
 * - Si es un número local heredado (ej. 0424...), asume Venezuela y quita el 0.
 */
export function parsePhone(value: string): { dial: string; local: string } {
  const v = (value || '').replace(/[\s\-()]/g, '');
  if (!v) return { dial: DEFAULT_DIAL, local: '' };

  if (v.startsWith('+') || v.startsWith('00')) {
    const digits = v.replace(/^\+/, '').replace(/^00/, '');
    for (const d of DIALS_BY_LENGTH) {
      if (digits.startsWith(d)) return { dial: d, local: digits.slice(d.length) };
    }
    return { dial: DEFAULT_DIAL, local: digits };
  }

  // Número local heredado: quitar el 0 inicial (prefijo troncal) y asumir el país por defecto.
  const digits = v.replace(/\D/g, '').replace(/^0+/, '');
  return { dial: DEFAULT_DIAL, local: digits };
}

/** Arma el número internacional guardado a partir de dial + número local. */
export function composePhone(dial: string, local: string): string {
  const localDigits = local.replace(/\D/g, '').replace(/^0+/, '');
  if (!localDigits) return '';
  return `+${dial}${localDigits}`;
}

export function countryByDial(dial: string): Country {
  return COUNTRIES.find((c) => c.dial === dial) ?? COUNTRIES[0];
}
