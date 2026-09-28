import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import ClientApp from '@/components/ClientApp';
import { SESSION_COOKIE, verifySessionToken } from '@/lib/server/auth';

export const dynamic = 'force-dynamic';

export default async function Page() {
  // Segunda barrera además de proxy.ts: sin sesión válida no se renderiza el dashboard.
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!(await verifySessionToken(token))) redirect('/login');
  return <ClientApp />;
}
