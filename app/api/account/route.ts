import { NextRequest, NextResponse } from 'next/server';
import { db, getAccount, ensureAccount } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export const runtime = 'nodejs';

export async function GET() {
  const auth = requireAuth();
  if (auth instanceof NextResponse) return auth;
  const account = getAccount(auth.userId);
  const openPositions = db.prepare("SELECT COUNT(*) as count FROM positions WHERE user_id = ? AND status = 'open'").get(auth.userId).count;
  const trades = db.prepare('SELECT COUNT(*) as count FROM trades WHERE user_id = ?').get(auth.userId).count;
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
  db.prepare('UPDATE accounts SET balance = ?, equity = ? WHERE user_id = ?').run(newBalance, newBalance, auth.userId);
  return NextResponse.json({ balance: newBalance });
}
