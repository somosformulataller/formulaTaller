import { type NextRequest, NextResponse } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';
import { CALLER_HEADERS, H_ROLE, H_USER, H_WORKSHOP } from '@/lib/caller-headers';

// Routes that are accessible without authentication
const PUBLIC_ROUTES = [
  '/login',
  '/registro',
  '/tracking',
  '/terminos',
  '/privacidad',
  '/reset-password',
  '/recuperar',
  '/video',
];

/**
 * Deja pasar la petición SIN las cabeceras internas de quién llama (un cliente
 * no puede inventárselas) y, si se verificó la sesión, con las buenas. Copia
 * las cookies que haya renovado Supabase en `base`.
 */
function continuar(request: NextRequest, base?: NextResponse, quien?: Record<string, string>) {
  const headers = new Headers(request.headers);
  for (const h of CALLER_HEADERS) headers.delete(h);
  for (const [k, v] of Object.entries(quien ?? {})) headers.set(k, v);
  const res = NextResponse.next({ request: { headers } });
  base?.cookies.getAll().forEach((c) => res.cookies.set(c));
  return res;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public routes (tracking pages and login)
  if (PUBLIC_ROUTES.some((route) => pathname.startsWith(route))) {
    const { supabaseResponse } = await updateSession(request);
    return continuar(request, supabaseResponse);
  }

  // Allow API auth callback
  if (pathname.startsWith('/api/auth')) {
    return continuar(request);
  }

  // Allow public tracking API
  if (pathname.startsWith('/api/tracking')) {
    return continuar(request);
  }

  // Allow public workshop registration API
  if (pathname.startsWith('/api/register')) {
    return continuar(request);
  }

  // Facebook Conversions API relay: público (se dispara desde login/registro sin sesión).
  if (pathname.startsWith('/api/fb-event')) {
    return continuar(request);
  }

  // Superadmin API: the route handlers enforce platform-admin auth themselves
  // (getPlatformAdmin). Don't run the workshop/profile logic here, and never
  // redirect an API request.
  if (pathname.startsWith('/api/superadmin')) {
    return continuar(request);
  }

  // Superadmin panel. Superadmins have NO profiles row, so they must be handled
  // before the profile-based logic below (which would bounce them to /login).
  if (pathname.startsWith('/superadmin')) {
    // Login page is public.
    if (pathname.startsWith('/superadmin/login')) {
      const { supabaseResponse } = await updateSession(request);
      return continuar(request, supabaseResponse);
    }
    const { supabaseResponse, user } = await updateSession(request);
    if (!user) {
      return NextResponse.redirect(new URL('/superadmin/login', request.url));
    }
    // Membership ("is this user a platform admin?") is verified server-side in
    // the /superadmin page (getPlatformAdmin), which redirects non-admins to
    // /superadmin/login.
    return continuar(request, supabaseResponse);
  }

  const { supabaseResponse, user, supabase } = await updateSession(request);

  // If not authenticated, redirect to login
  if (!user) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirectedFrom', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Get user role from profiles table
  const { data: profileData } = await supabase
    .from('profiles')
    .select('role, active, workshop_id')
    .eq('id', user.id)
    .single();

  const profile = profileData as unknown as
    | { role: string; active: boolean; workshop_id: string | null }
    | null;

  // Inactive users → login
  if (!profile || !profile.active) {
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  const role = profile.role;

  // Guard /admin routes — only admins allowed
  if (pathname.startsWith('/admin') && role !== 'admin') {
    return NextResponse.redirect(new URL('/mecanico', request.url));
  }

  // Guard /mecanico routes — only mechanics (and admins for flexibility) allowed
  if (pathname.startsWith('/mecanico') && role === 'admin') {
    return NextResponse.redirect(new URL('/admin', request.url));
  }

  // Root: redirect based on role
  if (pathname === '/') {
    return NextResponse.redirect(
      new URL(role === 'admin' ? '/admin' : '/mecanico', request.url)
    );
  }

  // Sesión y perfil ya verificados: la página o la API los lee de aquí
  // (getCaller) en vez de volver a consultarlos.
  return continuar(request, supabaseResponse, {
    [H_USER]: user.id,
    [H_ROLE]: role,
    [H_WORKSHOP]: profile.workshop_id ?? '',
  });
}

export const config = {
  matcher: [
    /*
     * Match all request paths EXCEPT:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     * - public folder files (imágenes, video y audio servidos estáticamente)
     */
    '/((?!_next/static|_next/image|favicon.ico|icons|manifest|sw\\.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp|mp4|webm|mov|mp3|ogg)$).*)',
  ],
};
