import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';

export const runtime = 'nodejs';

const symbols = [
  { symbol: 'BTCUSDT', base: 65000 },
  { symbol: 'ETHUSDT', base: 3200 },
  { symbol: 'XAUUSD', base: 2320 },
  { symbol: 'EURUSD', base: 1.08 },
  { symbol: 'USDTIRR', base: 590000 }
];

function buildMarket() {
  return symbols.map((item) => {
    const noise = Math.sin(Date.now() / 100000 + item.base) * (item.base * 0.01);
    const price = item.base + noise;
    const change = Math.sin(Date.now() / 80000 + item.base) * 2;
    const volume = Math.abs(Math.floor(Math.sin(item.base) * 1000000)) + 100000;
    return { symbol: item.symbol, price: Number(price.toFixed(2)), change: Number(change.toFixed(2)), volume };
  });
}

export async function GET() {
  const auth = requireAuth();
  if (auth instanceof NextResponse) return auth;
  return NextResponse.json(buildMarket());
}
