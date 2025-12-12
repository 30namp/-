import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export const runtime = 'nodejs';

export async function GET() {
  const auth = requireAuth();
  if (auth instanceof NextResponse) return auth;
  const trades = db
    .prepare('SELECT id, symbol, side, size, entry_price, exit_price, pnl FROM trades WHERE user_id = ? ORDER BY closed_at DESC LIMIT 50')
    .all(auth.userId);
  return NextResponse.json(trades);
}
