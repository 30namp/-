import { NextRequest, NextResponse } from 'next/server';
import { attachSession, createSession, verifyPassword } from '@/lib/auth';
import { db } from '@/lib/db';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const { email, password } = await request.json();
  if (!email || !password) {
    return NextResponse.json({ message: 'ایمیل و رمز عبور الزامی است' }, { status: 400 });
  }
  const user = db.prepare('SELECT id, password_hash FROM users WHERE email = ?').get(email);
  if (!user || !verifyPassword(password, user.password_hash)) {
    return NextResponse.json({ message: 'اطلاعات ورود نادرست است' }, { status: 401 });
  }
  const { token, expiresAt } = createSession(user.id);
  const response = NextResponse.json({ message: 'ورود موفق بود' });
  return attachSession(response, token, expiresAt);
}
