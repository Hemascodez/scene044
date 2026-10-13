import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { checkHostAccess } from '@/lib/venueHostAccess';

export async function requireHostPageAccess(returnTo?: string): Promise<Request> {
  const request = new Request('http://localhost/host', { headers: await headers() });
  if (!await checkHostAccess(request)) {
    redirect(returnTo && /^\/host\?ref=SCN-[A-Z0-9]{6,8}$/.test(returnTo)
      ? `/host/login?next=${encodeURIComponent(returnTo)}` : '/host/login');
  }
  return request;
}
