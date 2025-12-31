import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';

export const runtime = 'nodejs';

function generateCandles(symbol: string) {
  const now = Math.floor(Date.now() / 1000);
  const base = symbol === 'BTCUSDT' ? 65000 : symbol === 'ETHUSDT' ? 3200 : 150;
  const candles = Array.from({ length: 60 }).map((_, idx) => {
    const time = now - (60 - idx) * 60;
    const noise = Math.sin(time / 5000 + symbol.length) * base * 0.01;
    const open = base + noise + Math.sin(idx) * 5;
    const close = open + Math.sin(idx * 1.1) * 10;
    const high = Math.max(open, close) + Math.random() * 5;
    const low = Math.min(open, close) - Math.random() * 5;
    return { time, open: Number(open.toFixed(2)), close: Number(close.toFixed(2)), high: Number(high.toFixed(2)), low: Number(low.toFixed(2)) };
  });
  return candles;
}

export async function GET(request: NextRequest) {
  const auth = requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get('symbol') || 'BTCUSDT';
  const candles = generateCandles(symbol);
  return NextResponse.json({ symbol, candles });
}
