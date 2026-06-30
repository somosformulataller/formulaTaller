// The login page reads the Supabase browser client at render, so it must be
// rendered dynamically (not statically prerendered at build time).
export const dynamic = 'force-dynamic';

import LoginForm from './LoginForm';

export default function LoginPage() {
  return <LoginForm />;
}
