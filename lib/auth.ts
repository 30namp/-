import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { db, ensureAccount } from './db';

const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

export function hashPassword(password: string) {
  const salt = bcrypt.genSaltSync(10);
  return bcrypt.hashSync(password, salt);
}

export function verifyPassword(password: string, hash: string) {
  return bcrypt.compareSync(password, hash);
}

export function createSession(userId: number) {
  const token = randomUUID();
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_MAX_AGE;
  db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)').run(token, userId, expiresAt);
  return { token, expiresAt };
}

export function getUserFromCookies() {
  const cookieStore = cookies();
  const token = cookieStore.get('session_token')?.value;
  if (!token) return null;
  const session = db.prepare('SELECT * FROM sessions WHERE token = ? AND expires_at > strftime("%s", "now")').get(token);
  if (!session) return null;
  const user = db.prepare('SELECT id, email, name FROM users WHERE id = ?').get(session.user_id);
  return user || null;
}

export function requireAuth(): NextResponse | { userId: number } {
  const user = getUserFromCookies();
  if (!user) {
    return NextResponse.json({ message: 'نیاز به ورود دارید' }, { status: 401 });
  }
  ensureAccount(user.id);
  return { userId: user.id };
}

export function attachSession(response: NextResponse, token: string, expiresAt: number) {
  response.cookies.set('session_token', token, {
    httpOnly: true,
    path: '/',
    maxAge: SESSION_MAX_AGE,
    sameSite: 'lax'
  });
  response.headers.set('X-Session-Expires', expiresAt.toString());
  return response;
}
