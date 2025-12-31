import { AuthPanel } from '@/components/AuthPanel';
import { Dashboard } from '@/components/Dashboard';
import { getUserFromCookies } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default function HomePage() {
  const user = getUserFromCookies();
  if (!user) {
    return <AuthPanel />;
  }
  return <Dashboard user={user} />;
}
