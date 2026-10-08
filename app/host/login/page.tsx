import { VenueShell } from '@/components/venues/VenueShell';
import HostLoginPage from '@/components/venues/figma/HostLoginPage';

export const metadata = { title: 'Host sign-in — SCENE/044', robots: { index: false, follow: false } };
export default function HostLogin() {
  return <VenueShell bare><HostLoginPage /></VenueShell>;
}
