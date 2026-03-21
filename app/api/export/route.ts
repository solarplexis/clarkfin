import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { Timestamp } from 'firebase-admin/firestore';

interface UserRecord {
  email?: string;
}

export async function GET(request: NextRequest) {
  const apiKey = request.headers.get('x-api-key');
  if (!apiKey || apiKey !== process.env.API_SECRET_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const orgId = searchParams.get('orgId');
  const semesterId = searchParams.get('semesterId');
  const limitParam = Math.min(
    parseInt(searchParams.get('limit') ?? '100', 10) || 100,
    1000
  );

  if (!orgId) {
    return NextResponse.json({ error: 'orgId is required' }, { status: 400 });
  }

  let logsQuery = adminDb
    .collection('activity_logs')
    .where('orgId', '==', orgId)
    .orderBy('timestamp', 'desc')
    .limit(limitParam);

  if (semesterId) {
    logsQuery = logsQuery.where('semesterId', '==', semesterId);
  }

  const logsSnap = await logsQuery.get();

  const studentEmailCache = new Map<string, string>();

  async function getStudentEmail(studentId: string): Promise<string> {
    if (studentEmailCache.has(studentId)) {
      return studentEmailCache.get(studentId)!;
    }
    const userDoc = await adminDb.collection('users').doc(studentId).get();
    const email = (userDoc.data() as UserRecord | undefined)?.email ?? '';
    studentEmailCache.set(studentId, email);
    return email;
  }

  const rows = await Promise.all(
    logsSnap.docs.map(async (d) => {
      const log = d.data();
      const studentEmail = await getStudentEmail(log.studentId as string);
      const ts = log.timestamp as Timestamp | undefined;
      return {
        logId: d.id,
        studentId: log.studentId,
        studentEmail,
        orgId: log.orgId,
        semesterId: log.semesterId,
        activityType: log.type,
        data: log.data ?? {},
        timestamp: ts ? ts.toDate().toISOString() : null,
      };
    })
  );

  return NextResponse.json(rows);
}
