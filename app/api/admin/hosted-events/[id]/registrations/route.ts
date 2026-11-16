import { checkCuratorAccess } from '@/lib/auth';
import { eventApi } from '@/lib/eventApi';
import { eventIdValue, EventTicketError } from '@/lib/hostedEventData';
import { hostedRegistrationReport, REGISTRATION_FILTERS, type RegistrationFilter } from '@/lib/hostedEventReporting';

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  return eventApi(request, async () => {
    if (!(await checkCuratorAccess(request))) throw new EventTicketError('unauthorized', 401);
    const id = eventIdValue((await context.params).id);
    const url = new URL(request.url);
    const filter = url.searchParams.get('filter') ?? 'all';
    const search = (url.searchParams.get('q') ?? '').trim();
    const page = Number(url.searchParams.get('page') ?? 1);
    if (!(REGISTRATION_FILTERS as readonly string[]).includes(filter) || search.length > 120 || !Number.isSafeInteger(page) || page < 1 || page > 100000)
      throw new EventTicketError('Choose a valid registration filter or page.');
    return hostedRegistrationReport(id, filter as RegistrationFilter, search, page);
  });
}
