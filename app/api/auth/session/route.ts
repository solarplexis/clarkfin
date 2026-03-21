import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase/admin';

const SESSION_EXPIRY_MS = 60 * 60 * 24 * 5 * 1000; // 5 days

export async function POST(request: NextRequest) {
  try {
    const { idToken } = await request.json();
    if (!idToken) {
      return NextResponse.json({ error: 'Missing idToken' }, { status: 400 });
    }

    const sessionCookie = await adminAuth.createSessionCookie(idToken, {
      expiresIn: SESSION_EXPIRY_MS,
    });

    const response = NextResponse.json({ success: true });
    response.cookies.set('session', sessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: SESSION_EXPIRY_MS / 1000,
      path: '/',
    });

    return response;
  } catch {
    return NextResponse.json({ error: 'Failed to create session' }, { status: 401 });
  }
}
