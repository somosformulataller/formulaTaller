// ============================================================================
// Colores de la marca del taller (0031): se sacan del logo en el navegador,
// sin costo de IA. Se agrupan los píxeles con color (no blancos, negros ni
// grises) por tono y se quedan los dos tonos que más pesan.
// ============================================================================

const HEX = /^#[0-9a-f]{6}$/i;

export function esHex(v: unknown): v is string {
  return typeof v === 'string' && HEX.test(v);
}

function aHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
}

function hsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}

/** Los dos colores principales del logo, o null si es en blanco y negro. */
export async function coloresDelLogo(file: Blob): Promise<{ c1: string; c2: string } | null> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((ok, mal) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = mal;
      i.src = url;
    });
    const T = 72;
    const canvas = document.createElement('canvas');
    canvas.width = T;
    canvas.height = T;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, T, T);
    const { data } = ctx.getImageData(0, 0, T, T);

    // 24 grupos de tono (15° cada uno): peso y suma de colores.
    const grupos = Array.from({ length: 24 }, () => ({ peso: 0, r: 0, g: 0, b: 0 }));
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 128) continue;
      const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
      const [h, s, l] = hsl(r, g, b);
      if (s < 0.25 || l < 0.12 || l > 0.9) continue;
      const peso = s * (1 - Math.abs(l - 0.5));
      const grupo = grupos[Math.floor(h / 15) % 24];
      grupo.peso += peso;
      grupo.r += r * peso;
      grupo.g += g * peso;
      grupo.b += b * peso;
    }
    const total = grupos.reduce((a, g) => a + g.peso, 0);
    if (total < 3) return null;
    const color = (n: number) => {
      const g = grupos[n];
      return aHex(g.r / g.peso, g.g / g.peso, g.b / g.peso);
    };
    const orden = grupos.map((g, i) => ({ i, peso: g.peso })).sort((a, b) => b.peso - a.peso);
    const primero = orden[0].i;
    // El segundo tiene que ser otro tono (a más de 45°) y pesar algo.
    const segundo = orden.find(
      (o) => o.peso > total * 0.08 && Math.min(Math.abs(o.i - primero), 24 - Math.abs(o.i - primero)) >= 3
    );
    return { c1: color(primero), c2: segundo ? color(segundo.i) : color(primero) };
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}
