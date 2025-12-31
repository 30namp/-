import fs from 'fs';
import path from 'path';

const dataPath = path.join(process.cwd(), 'data.json');

export type User = {
  id: number;
  email: string;
  password_hash: string;
  name: string;
  created_at: number;
};

export type Session = {
  token: string;
  user_id: number;
  expires_at: number;
};

export type Account = {
  user_id: number;
  balance: number;
  equity: number;
};

export type Position = {
  id: number;
  user_id: number;
  symbol: string;
  side: string;
  size: number;
  entry_price: number;
  stop_loss?: number;
  take_profit?: number;
  status: 'open' | 'closed';
  open_time: number;
  close_time?: number;
  close_price?: number;
  pnl?: number;
};

export type Trade = {
  id: number;
  user_id: number;
  symbol: string;
  side: string;
  size: number;
  entry_price: number;
  exit_price: number;
  pnl: number;
  opened_at: number;
  closed_at: number;
};

type DataStore = {
  users: User[];
  sessions: Session[];
  accounts: Account[];
  positions: Position[];
  trades: Trade[];
};

function defaultData(): DataStore {
  return { users: [], sessions: [], accounts: [], positions: [], trades: [] };
}

function readData(): DataStore {
  if (!fs.existsSync(dataPath)) {
    return defaultData();
  }
  const raw = fs.readFileSync(dataPath, 'utf-8');
  try {
    const parsed = JSON.parse(raw) as Partial<DataStore>;
    return {
      users: parsed.users ?? [],
      sessions: parsed.sessions ?? [],
      accounts: parsed.accounts ?? [],
      positions: parsed.positions ?? [],
      trades: parsed.trades ?? []
    };
  } catch (err) {
    console.error('Failed to parse data file, resetting store', err);
    return defaultData();
  }
}

function writeData(data: DataStore) {
  fs.writeFileSync(dataPath, JSON.stringify(data, null, 2), 'utf-8');
}

function nextId(items: { id: number }[]) {
  return items.length ? Math.max(...items.map((i) => i.id)) + 1 : 1;
}

export function getUserByEmail(email: string) {
  const data = readData();
  return data.users.find((u) => u.email === email) ?? null;
}

export function getUserById(id: number) {
  const data = readData();
  return data.users.find((u) => u.id === id) ?? null;
}

export function createUser(email: string, passwordHash: string, name: string) {
  const data = readData();
  const id = nextId(data.users);
  const newUser: User = {
    id,
    email,
    password_hash: passwordHash,
    name,
    created_at: Math.floor(Date.now() / 1000)
  };
  data.users.push(newUser);
  writeData(data);
  return id;
}

export function createSessionRecord(token: string, userId: number, expiresAt: number) {
  const data = readData();
  data.sessions.push({ token, user_id: userId, expires_at: expiresAt });
  writeData(data);
}

export function getSession(token: string) {
  const data = readData();
  return data.sessions.find((s) => s.token === token && s.expires_at > Math.floor(Date.now() / 1000)) ?? null;
}

export function deleteSession(token: string) {
  const data = readData();
  data.sessions = data.sessions.filter((s) => s.token !== token);
  writeData(data);
}

export function getAccount(userId: number): Account {
  const data = readData();
  return data.accounts.find((a) => a.user_id === userId) ?? { user_id: userId, balance: 0, equity: 0 };
}

export function ensureAccount(userId: number) {
  const data = readData();
  const existing = data.accounts.find((a) => a.user_id === userId);
  if (!existing) {
    data.accounts.push({ user_id: userId, balance: 100000000, equity: 100000000 });
    writeData(data);
  }
}

export function updateAccount(userId: number, balance: number, equity: number) {
  const data = readData();
  const accountIndex = data.accounts.findIndex((a) => a.user_id === userId);
  if (accountIndex >= 0) {
    data.accounts[accountIndex] = { ...data.accounts[accountIndex], balance, equity };
  } else {
    data.accounts.push({ user_id: userId, balance, equity });
  }
  writeData(data);
}

export function recordTrade(params: {
  userId: number;
  symbol: string;
  side: string;
  size: number;
  entryPrice: number;
  exitPrice: number;
  openedAt: number;
  closedAt: number;
}) {
  const data = readData();
  const pnl = (params.exitPrice - params.entryPrice) * params.size * (params.side === 'long' ? 1 : -1);
  const id = nextId(data.trades);
  data.trades.push({
    id,
    user_id: params.userId,
    symbol: params.symbol,
    side: params.side,
    size: params.size,
    entry_price: params.entryPrice,
    exit_price: params.exitPrice,
    pnl,
    opened_at: params.openedAt,
    closed_at: params.closedAt
  });
  writeData(data);
  return pnl;
}

export function countTrades(userId: number) {
  const data = readData();
  return data.trades.filter((t) => t.user_id === userId).length;
}

export function listTrades(userId: number, limit = 50) {
  const data = readData();
  return data.trades
    .filter((t) => t.user_id === userId)
    .sort((a, b) => b.closed_at - a.closed_at)
    .slice(0, limit);
}

export function countOpenPositions(userId: number) {
  const data = readData();
  return data.positions.filter((p) => p.user_id === userId && p.status === 'open').length;
}

export function listOpenPositions(userId: number) {
  const data = readData();
  return data.positions
    .filter((p) => p.user_id === userId && p.status === 'open')
    .sort((a, b) => (b.open_time || 0) - (a.open_time || 0));
}

export function createPosition(params: {
  userId: number;
  symbol: string;
  side: string;
  size: number;
  entryPrice: number;
  stop_loss?: number;
  take_profit?: number;
}) {
  const data = readData();
  const id = nextId(data.positions);
  data.positions.push({
    id,
    user_id: params.userId,
    symbol: params.symbol,
    side: params.side,
    size: params.size,
    entry_price: params.entryPrice,
    stop_loss: params.stop_loss,
    take_profit: params.take_profit,
    status: 'open',
    open_time: Math.floor(Date.now() / 1000)
  });
  writeData(data);
}

export function getPositionById(id: number, userId: number) {
  const data = readData();
  return data.positions.find((p) => p.id === id && p.user_id === userId) ?? null;
}

export function closePosition(id: number, params: { closePrice: number; closeTime: number; pnl: number }) {
  const data = readData();
  const idx = data.positions.findIndex((p) => p.id === id);
  if (idx >= 0) {
    data.positions[idx] = {
      ...data.positions[idx],
      status: 'closed',
      close_time: params.closeTime,
      close_price: params.closePrice,
      pnl: params.pnl
    } as Position;
    writeData(data);
  }
}
