'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthContext } from '@/components/AuthProvider';

export const dynamic = 'force-dynamic';

export default function HomePage() {
  const { user, loading, role } = useAuthContext();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/login');
    } else if (role === 'ADMIN') {
      router.replace('/dashboard');
    } else {
      router.replace('/budget');
    }
  }, [user, loading, role, router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
