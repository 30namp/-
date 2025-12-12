import { NextRequest, NextResponse } from 'next/server';
import { attachSession, createSession, verifyPassword } from '@/lib/auth';
import { getUserByEmail } from '@/lib/db';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const { email, password } = await request.json();
  const user = getUserByEmail(email);
  if (!user || !verifyPassword(password, user.password_hash)) {
    return NextResponse.json({ message: 'ایمیل یا رمز اشتباه است' }, { status: 401 });
  }
  const { token, expiresAt } = createSession(user.id);
  const response = NextResponse.json({ message: 'ورود موفق' });
  return attachSession(response, token, expiresAt);
}
