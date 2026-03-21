'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
  limit,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { useAuthContext } from '@/components/AuthProvider';
import NavBar from '@/components/NavBar';
import { User, ActivityLog } from '@/types';
import { formatDate } from '@/lib/utils/format';

export const dynamic = 'force-dynamic';

interface StudentRow {
  uid: string;
  email: string;
  semesterId: string;
  latestActivity: string | null;
}

export default function AdminDashboardPage() {
  const { user, loading, role, organizationId } = useAuthContext();
  const router = useRouter();
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (loading) return;
    if (!user) { router.replace('/login'); return; }
    if (role !== 'ADMIN') { router.replace('/budget'); return; }
  }, [user, loading, role, router]);

  useEffect(() => {
    if (!organizationId || role !== 'ADMIN') return;

    async function fetchStudents() {
      setFetching(true);
      const studentsQ = query(
        collection(db!, 'users'),
        where('organizationId', '==', organizationId),
        where('role', '==', 'STUDENT')
      );
      const studentsSnap = await getDocs(studentsQ);
      const studentList = studentsSnap.docs.map((d) => d.data() as User);

      if (studentList.length === 0) {
        setStudents([]);
        setFetching(false);
        return;
      }

      // Fetch recent activity for the whole org in a single query, then group by studentId
      const logsQ = query(
        collection(db!, 'activity_logs'),
        where('orgId', '==', organizationId),
        orderBy('timestamp', 'desc'),
        limit(500)
      );
      const logsSnap = await getDocs(logsQ);
      const latestByStudent = new Map<string, string>();
      for (const d of logsSnap.docs) {
        const log = d.data() as ActivityLog;
        if (!latestByStudent.has(log.studentId) && log.timestamp?.toDate) {
          latestByStudent.set(log.studentId, formatDate(log.timestamp.toDate()));
        }
      }

      const rows: StudentRow[] = studentList.map((u) => ({
        uid: u.uid,
        email: u.email,
        semesterId: u.semesterId,
        latestActivity: latestByStudent.get(u.uid) ?? null,
      }));

      setStudents(rows);
      setFetching(false);
    }

    fetchStudents();
  }, [organizationId, role]);

  if (loading || fetching) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <>
      <NavBar />
      <main className="max-w-5xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Admin Dashboard</h1>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">
              Enrolled Students ({students.length})
            </h2>
          </div>

          {students.length === 0 ? (
            <p className="px-5 py-8 text-center text-gray-400 text-sm">No students enrolled yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Email</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Semester</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Last Activity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {students.map((s) => (
                  <tr key={s.uid} className="hover:bg-gray-50">
                    <td className="px-5 py-3 text-gray-800">{s.email}</td>
                    <td className="px-5 py-3 text-gray-600">{s.semesterId}</td>
                    <td className="px-5 py-3 text-gray-500">{s.latestActivity ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </>
  );
}
