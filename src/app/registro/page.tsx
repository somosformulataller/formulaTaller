// The registration page uses the Supabase browser client, so render it
// dynamically (not statically prerendered at build time).
export const dynamic = 'force-dynamic';

import RegisterForm from './RegisterForm';

export default function RegisterPage() {
  return <RegisterForm />;
}
