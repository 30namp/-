import { NextRequest, NextResponse } from 'next/server';
import { countOpenPositions, countTrades, ensureAccount, getAccount, updateAccount } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export const runtime = 'nodejs';

export async function GET() {
  const auth = requireAuth();
  if (auth instanceof NextResponse) return auth;
  const account = getAccount(auth.userId);
  const openPositions = countOpenPositions(auth.userId);
  const trades = countTrades(auth.userId);
  return NextResponse.json({ ...account, openPositions, trades });
}

export async function POST(request: NextRequest) {
  const auth = requireAuth();
  if (auth instanceof NextResponse) return auth;
  ensureAccount(auth.userId);
  const { type, amount } = await request.json();
  if (!['deposit', 'withdraw'].includes(type)) {
    return NextResponse.json({ message: 'نوع تراکنش نامعتبر است' }, { status: 400 });
  }
  const account = getAccount(auth.userId);
  if (type === 'withdraw' && account.balance < amount) {
    return NextResponse.json({ message: 'موجودی کافی نیست' }, { status: 400 });
  }
  const newBalance = type === 'deposit' ? account.balance + amount : account.balance - amount;
  updateAccount(auth.userId, newBalance, newBalance);
  return NextResponse.json({ balance: newBalance });
}
