import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.join(process.cwd(), 'data.sqlite');
export const db = new Database(dbPath);

db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at INTEGER DEFAULT (strftime('%s','now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS accounts (
  user_id INTEGER PRIMARY KEY,
  balance REAL DEFAULT 100000000,
  equity REAL DEFAULT 100000000,
  FOREIGN KEY(user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS positions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  symbol TEXT NOT NULL,
  side TEXT NOT NULL,
  size REAL NOT NULL,
  entry_price REAL NOT NULL,
  stop_loss REAL,
  take_profit REAL,
  status TEXT DEFAULT 'open',
  open_time INTEGER DEFAULT (strftime('%s','now')),
  close_time INTEGER,
  close_price REAL,
  pnl REAL,
  FOREIGN KEY(user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS trades (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  symbol TEXT NOT NULL,
  side TEXT NOT NULL,
  size REAL NOT NULL,
  entry_price REAL NOT NULL,
  exit_price REAL NOT NULL,
  pnl REAL NOT NULL,
  opened_at INTEGER NOT NULL,
  closed_at INTEGER NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id)
);
`);

export function getAccount(userId: number) {
  const account = db.prepare('SELECT * FROM accounts WHERE user_id = ?').get(userId);
  return account || { user_id: userId, balance: 0, equity: 0 };
}

export function ensureAccount(userId: number) {
  const existing = db.prepare('SELECT * FROM accounts WHERE user_id = ?').get(userId);
  if (!existing) {
    db.prepare('INSERT INTO accounts (user_id) VALUES (?)').run(userId);
  }
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
  const pnl = (params.exitPrice - params.entryPrice) * params.size * (params.side === 'long' ? 1 : -1);
  db.prepare(
    `INSERT INTO trades (user_id, symbol, side, size, entry_price, exit_price, pnl, opened_at, closed_at)
     VALUES (@userId, @symbol, @side, @size, @entryPrice, @exitPrice, @pnl, @openedAt, @closedAt)`
  ).run({ ...params, pnl });
  return pnl;
}
