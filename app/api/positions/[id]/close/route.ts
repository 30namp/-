import { NextRequest, NextResponse } from 'next/server';
import { db, getAccount, recordTrade } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export const runtime = 'nodejs';

function syntheticExit(entry: number, side: string) {
  const delta = (Math.random() - 0.5) * entry * 0.02;
  return Number((entry + delta * (side === 'long' ? 1 : -1)).toFixed(2));
}

export async function POST(_request: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireAuth();
  if (auth instanceof NextResponse) return auth;
  const position = db.prepare('SELECT * FROM positions WHERE id = ? AND user_id = ?').get(params.id, auth.userId);
  if (!position) {
    return NextResponse.json({ message: 'موقعیت یافت نشد' }, { status: 404 });
  }
  if (position.status === 'closed') {
    return NextResponse.json({ message: 'موقعیت قبلاً بسته شده است' }, { status: 400 });
  }
  const exitPrice = syntheticExit(position.entry_price, position.side);
  const pnl = (exitPrice - position.entry_price) * position.size * (position.side === 'long' ? 1 : -1);
  const closeTime = Math.floor(Date.now() / 1000);
  db.prepare(
    `UPDATE positions SET status = 'closed', close_time = ?, close_price = ?, pnl = ? WHERE id = ?`
  ).run(closeTime, exitPrice, pnl, params.id);
  recordTrade({
    userId: auth.userId,
    symbol: position.symbol,
    side: position.side,
    size: position.size,
    entryPrice: position.entry_price,
    exitPrice,
    openedAt: position.open_time,
    closedAt: closeTime
  });
  const account = getAccount(auth.userId);
  const updatedBalance = account.balance + exitPrice * position.size * 0.1 + pnl;
  const updatedEquity = updatedBalance;
  db.prepare('UPDATE accounts SET balance = ?, equity = ? WHERE user_id = ?').run(updatedBalance, updatedEquity, auth.userId);
  return NextResponse.json({ message: 'بسته شد', pnl, exitPrice });
}
