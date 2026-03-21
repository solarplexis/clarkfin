'use client';

import Link from 'next/link';
import { useAuthContext } from '@/components/AuthProvider';
import { useRouter } from 'next/navigation';

export default function NavBar() {
  const { user, role, signOut } = useAuthContext();
  const router = useRouter();

  async function handleSignOut() {
    await signOut();
    router.push('/login');
  }

  if (!user) return null;

  return (
    <nav className="bg-white border-b border-gray-200 px-4 py-3">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        <Link href={role === 'ADMIN' ? '/dashboard' : '/budget'} className="text-xl font-bold text-blue-600">
          ClarkFin
        </Link>

        <div className="flex items-center gap-6">
          {role === 'STUDENT' && (
            <>
              <Link href="/budget" className="text-sm text-gray-600 hover:text-blue-600 transition-colors">
                Budget
              </Link>
              <Link href="/debt" className="text-sm text-gray-600 hover:text-blue-600 transition-colors">
                Debt Simulator
              </Link>
            </>
          )}
          {role === 'ADMIN' && (
            <Link href="/dashboard" className="text-sm text-gray-600 hover:text-blue-600 transition-colors">
              Dashboard
            </Link>
          )}
          <button
            onClick={handleSignOut}
            className="text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded transition-colors"
          >
            Sign Out
          </button>
        </div>
      </div>
    </nav>
  );
}
