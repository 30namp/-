import { NextRequest, NextResponse } from 'next/server';
import { createPosition, getAccount, listOpenPositions, updateAccount } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export const runtime = 'nodejs';

function syntheticPrice(symbol: string) {
  const base = symbol === 'BTCUSDT' ? 65000 : symbol === 'ETHUSDT' ? 3200 : 150;
  const variation = Math.sin(Date.now() / 60000 + symbol.length) * (base * 0.01);
  return Number((base + variation).toFixed(2));
}

export async function GET() {
  const auth = requireAuth();
  if (auth instanceof NextResponse) return auth;
  const items = listOpenPositions(auth.userId);
  return NextResponse.json(items);
}

export async function POST(request: NextRequest) {
  const auth = requireAuth();
  if (auth instanceof NextResponse) return auth;
  const body = await request.json();
  const { symbol, side, size, stop_loss, take_profit } = body;
  if (!symbol || !side || !size) {
    return NextResponse.json({ message: 'اطلاعات موقعیت کامل نیست' }, { status: 400 });
  }
  const entryPrice = syntheticPrice(symbol);
  const account = getAccount(auth.userId);
  const marginNeeded = entryPrice * size * 0.1;
  if (account.balance < marginNeeded) {
    return NextResponse.json({ message: 'موجودی کافی برای مارجین وجود ندارد' }, { status: 400 });
  }
  updateAccount(auth.userId, account.balance - marginNeeded, account.equity - marginNeeded);
  createPosition({ userId: auth.userId, symbol, side, size, entryPrice, stop_loss, take_profit });
  return NextResponse.json({ message: 'موقعیت باز شد', entryPrice });
}
