import { type NextRequest, NextResponse } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';
import { createServerClient } from '@supabase/ssr';
import type { Database } from '@/lib/types';

// Routes that are accessible without authentication
const PUBLIC_ROUTES = [
  '/login',
  '/registro',
  '/tracking',
  '/terminos',
  '/privacidad',
  '/reset-password',
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public routes (tracking pages and login)
  if (PUBLIC_ROUTES.some((route) => pathname.startsWith(route))) {
    return await updateSession(request).then((r) => r.supabaseResponse);
  }

  // Allow API auth callback
  if (pathname.startsWith('/api/auth')) {
    return NextResponse.next();
  }

  // Allow public tracking API
  if (pathname.startsWith('/api/tracking')) {
    return NextResponse.next();
  }

  // Allow public workshop registration API
  if (pathname.startsWith('/api/register')) {
    return NextResponse.next();
  }

  // Superadmin API: the route handlers enforce platform-admin auth themselves
  // (getPlatformAdmin). Don't run the workshop/profile logic here, and never
  // redirect an API request.
  if (pathname.startsWith('/api/superadmin')) {
    return NextResponse.next();
  }

  // Superadmin panel. Superadmins have NO profiles row, so they must be handled
  // before the profile-based logic below (which would bounce them to /login).
  if (pathname.startsWith('/superadmin')) {
    // Login page is public.
    if (pathname.startsWith('/superadmin/login')) {
      return await updateSession(request).then((r) => r.supabaseResponse);
    }
    const { supabaseResponse, user } = await updateSession(request);
    if (!user) {
      return NextResponse.redirect(new URL('/superadmin/login', request.url));
    }
    // Membership ("is this user a platform admin?") is verified server-side in
    // the /superadmin page (getPlatformAdmin), which redirects non-admins to
    // /superadmin/login.
    return supabaseResponse;
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
    .select('role, active')
    .eq('id', user.id)
    .single();

  const profile = profileData as unknown as { role: string; active: boolean } | null;

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

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths EXCEPT:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     * - public folder files
     */
    '/((?!_next/static|_next/image|favicon.ico|icons|manifest|sw\\.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
