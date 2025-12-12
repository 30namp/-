import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { db } from '@/lib/db';

export const runtime = 'nodejs';

export async function POST() {
  const token = cookies().get('session_token')?.value;
  if (token) {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
  }
  const response = NextResponse.json({ message: 'خروج انجام شد' });
  response.cookies.set('session_token', '', { maxAge: 0, path: '/' });
  return response;
}
