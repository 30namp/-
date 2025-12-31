import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { deleteSession } from '@/lib/db';

export const runtime = 'nodejs';

export async function POST() {
  const cookieStore = cookies();
  const token = cookieStore.get('session_token')?.value;
  if (token) {
    deleteSession(token);
  }
  const response = NextResponse.json({ message: 'خروج انجام شد' });
  response.cookies.set('session_token', '', { path: '/', maxAge: 0 });
  return response;
}
