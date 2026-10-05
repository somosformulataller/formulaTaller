import { NextResponse } from 'next/server';
import { getCaller, type Caller } from '@/lib/api-auth';
import { createServiceClient } from '@/lib/supabase/server';
import { STAGE_FILES_BUCKET } from '@/lib/storage';

/**
 * Clientes, recordatorios, notificaciones y el asistente son del
 * ADMINISTRADOR del taller. Devuelve quien llama, o la respuesta de error.
 *
 * Los endpoints escriben con la clave de servicio, que se salta RLS: esta
 * comprobación y el filtro por `workshopId` en cada consulta son la frontera.
 */
export async function soloAdmin(): Promise<
  { caller: Caller & { workshopId: string }; error?: never } | { caller?: never; error: NextResponse }
> {
  const caller = await getCaller();
  if (!caller) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  if (caller.role !== 'admin' || !caller.workshopId) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  return { caller: caller as Caller & { workshopId: string } };
}

/** Carpeta del bucket privado donde viven los archivos de recordatorios de un taller. */
export function carpetaRecordatorios(workshopId: string): string {
  return `reminders/${workshopId}/`;
}

/**
 * Firma (1 hora) las rutas de audio e imagen de los recordatorios, en una sola
 * llamada, y las deja en audio_url / image_url.
 */
export async function firmarArchivos<
  T extends { audio_path: string | null; image_path: string | null; audio_url?: string | null; image_url?: string | null }
>(service: ReturnType<typeof createServiceClient>, filas: T[]): Promise<T[]> {
  const paths = filas.flatMap((f) => [f.audio_path, f.image_path]).filter((p): p is string => !!p);
  if (paths.length === 0) return filas;
  const { data } = await service.storage.from(STAGE_FILES_BUCKET).createSignedUrls(paths, 60 * 60);
  const porPath = new Map<string, string>();
  (data ?? []).forEach((r, i) => {
    if (r.signedUrl) porPath.set(paths[i], r.signedUrl);
  });
  for (const f of filas) {
    f.audio_url = f.audio_path ? porPath.get(f.audio_path) ?? null : null;
    f.image_url = f.image_path ? porPath.get(f.image_path) ?? null : null;
  }
  return filas;
}

const PAGINA = 1000;

/** Trae todas las filas de una consulta, esquivando el tope silencioso de 1.000 de PostgREST. */
export async function traerTodo<T>(
  consulta: (desde: number, hasta: number) => PromiseLike<{ data: unknown; error: unknown }>
): Promise<T[]> {
  const todo: T[] = [];
  for (let desde = 0; ; desde += PAGINA) {
    const { data, error } = await consulta(desde, desde + PAGINA - 1);
    if (error) throw error;
    const filas = (data ?? []) as T[];
    todo.push(...filas);
    if (filas.length < PAGINA) break;
  }
  return todo;
}
