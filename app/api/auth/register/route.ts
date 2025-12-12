import { NextRequest, NextResponse } from 'next/server';
import { attachSession, createSession, hashPassword } from '@/lib/auth';
import { createUser, ensureAccount, getUserByEmail } from '@/lib/db';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const { email, password, name } = await request.json();
  if (!email || !password || !name) {
    return NextResponse.json({ message: 'همه فیلدها الزامی هستند' }, { status: 400 });
  }
  const existing = getUserByEmail(email);
  if (existing) {
    return NextResponse.json({ message: 'کاربری با این ایمیل وجود دارد' }, { status: 400 });
  }
  const passwordHash = hashPassword(password);
  const userId = createUser(email, passwordHash, name);
  ensureAccount(userId);
  const { token, expiresAt } = createSession(userId);
  const response = NextResponse.json({ message: 'ثبت‌نام موفق بود' });
  return attachSession(response, token, expiresAt);
}
