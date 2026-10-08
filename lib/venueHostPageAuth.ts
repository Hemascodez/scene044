import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { checkHostAccess } from '@/lib/venueHostAccess';

export async function requireHostPageAccess(): Promise<Request> {
  const request = new Request('http://localhost/host', { headers: await headers() });
  if (!await checkHostAccess(request)) redirect('/host/login');
  return request;
}
