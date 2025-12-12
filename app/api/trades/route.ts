import { NextResponse } from 'next/server';
import { listTrades } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export const runtime = 'nodejs';

export async function GET() {
  const auth = requireAuth();
  if (auth instanceof NextResponse) return auth;
  const trades = listTrades(auth.userId, 50);
  return NextResponse.json(trades);
}
