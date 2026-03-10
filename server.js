const fs = require('fs');
const path = require('path');
const https = require('https');
const express = require('express');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');

const PORT = Number(process.env.PORT || 3020);
const HOST = process.env.HOST || '0.0.0.0';
const DOMAIN = process.env.DOMAIN || 'meet.donatapp.ir';

const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'sinamp';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'sinamp@1383';

const TLS_KEY_PATH = process.env.TLS_KEY_PATH || path.join(__dirname, 'certs', 'privkey.pem');
const TLS_CERT_PATH = process.env.TLS_CERT_PATH || path.join(__dirname, 'certs', 'fullchain.pem');

const app = express();
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '200kb' }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

const adminPasswordHash = bcrypt.hashSync(ADMIN_PASSWORD, 10);

const state = {
  config: {
    maxRooms: 5,
    maxRoomUsers: 4,
    joinRequestTimeoutMs: 45000,
    iceServers: JSON.parse(process.env.ICE_SERVERS || '[]'),
  },
  sessions: new Map(),
  rooms: new Map(),
  sockets: new Map(),
};

function newRoom(ownerId, ownerName) {
  return {
    id: uuidv4().split('-')[0],
    ownerId,
    ownerName,
    participants: new Map(),
    joinRequests: new Map(),
    createdAt: Date.now(),
  };
}

function sanitizeName(name) {
  const n = String(name || '').trim().slice(0, 24);
  return n.replace(/[^a-zA-Z0-9_\-\s]/g, '') || 'Guest';
}

function auth(req, _res, next) {
  const token = req.cookies.sessionToken;
  if (!token || !state.sessions.has(token)) {
    req.user = null;
    return next();
  }
  req.user = state.sessions.get(token);
  next();
}

app.use(auth);

app.post('/api/session', (req, res) => {
  const displayName = sanitizeName(req.body?.displayName);
  const token = uuidv4();
  const user = { id: uuidv4(), displayName, isAdmin: false };
  state.sessions.set(token, user);
  res.cookie('sessionToken', token, { httpOnly: true, sameSite: 'strict', secure: true, maxAge: 1000 * 60 * 60 * 12 });
  res.json({ user, domain: DOMAIN, port: PORT, config: state.config });
});

app.get('/api/me', (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  res.json({ user: req.user, config: state.config });
});

app.post('/api/admin/login', (req, res) => {
  const username = String(req.body?.username || '');
  const password = String(req.body?.password || '');
  if (username !== ADMIN_USERNAME || !bcrypt.compareSync(password, adminPasswordHash)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const token = uuidv4();
  const user = { id: uuidv4(), displayName: 'Administrator', isAdmin: true, username };
  state.sessions.set(token, user);
  res.cookie('sessionToken', token, { httpOnly: true, sameSite: 'strict', secure: true, maxAge: 1000 * 60 * 60 * 12 });
  res.json({ ok: true, user, config: state.config });
});

app.post('/api/admin/config', (req, res) => {
  if (!req.user?.isAdmin) return res.status(403).json({ error: 'Forbidden' });
  const maxRooms = Math.max(1, Math.min(50, Number(req.body?.maxRooms || state.config.maxRooms)));
  const maxRoomUsers = Math.max(2, Math.min(12, Number(req.body?.maxRoomUsers || state.config.maxRoomUsers)));
  state.config.maxRooms = maxRooms;
  state.config.maxRoomUsers = maxRoomUsers;
  io.emit('config-updated', state.config);
  res.json({ ok: true, config: state.config });
});

app.get('/api/admin/rooms', (req, res) => {
  if (!req.user?.isAdmin) return res.status(403).json({ error: 'Forbidden' });
  const rooms = Array.from(state.rooms.values()).map((r) => ({
    id: r.id,
    ownerName: r.ownerName,
    participants: Array.from(r.participants.values()).map((p) => ({ id: p.id, name: p.name, isAdmin: p.isAdmin })),
    pendingRequests: r.joinRequests.size,
    createdAt: r.createdAt,
  }));
  res.json({ rooms, config: state.config });
});

function findRoomByUser(userId) {
  for (const room of state.rooms.values()) {
    if (room.participants.has(userId)) return room;
  }
  return null;
}

function leaveRoom(userId) {
  const room = findRoomByUser(userId);
  if (!room) return null;

  room.participants.delete(userId);
  io.to(room.id).emit('participant-left', { userId });

  if (room.ownerId === userId) {
    const nextOwner = room.participants.values().next().value;
    if (nextOwner) {
      room.ownerId = nextOwner.id;
      room.ownerName = nextOwner.name;
      io.to(room.id).emit('owner-changed', { ownerId: room.ownerId, ownerName: room.ownerName });
    } else {
      state.rooms.delete(room.id);
    }
  }

  return room.id;
}

function roomSummary(room) {
  return {
    id: room.id,
    ownerId: room.ownerId,
    ownerName: room.ownerName,
    participants: Array.from(room.participants.values()),
  };
}

const key = fs.readFileSync(TLS_KEY_PATH);
const cert = fs.readFileSync(TLS_CERT_PATH);
const server = https.createServer({ key, cert }, app);
const io = new Server(server, {
  cors: {
    origin: `https://${DOMAIN}:${PORT}`,
    methods: ['GET', 'POST'],
    credentials: true,
  },
  pingTimeout: 30000,
  maxHttpBufferSize: 1e6,
});

io.use((socket, next) => {
  const token = socket.handshake.auth?.sessionToken;
  if (!token || !state.sessions.has(token)) return next(new Error('Unauthorized socket'));
  socket.user = state.sessions.get(token);
  next();
});

io.on('connection', (socket) => {
  state.sockets.set(socket.user.id, socket.id);

  socket.on('create-room', (_, cb) => {
    if (state.rooms.size >= state.config.maxRooms) return cb({ error: 'Room limit reached' });
    if (findRoomByUser(socket.user.id)) return cb({ error: 'Leave current room first' });

    const room = newRoom(socket.user.id, socket.user.displayName);
    room.participants.set(socket.user.id, { id: socket.user.id, name: socket.user.displayName, isAdmin: socket.user.isAdmin, ghost: false });
    state.rooms.set(room.id, room);

    socket.join(room.id);
    cb({ room: roomSummary(room) });
    io.emit('rooms-updated');
  });

  socket.on('list-rooms', (_, cb) => {
    const rooms = Array.from(state.rooms.values()).map((r) => ({
      id: r.id,
      ownerName: r.ownerName,
      participants: r.participants.size,
      canRequest: r.participants.size < state.config.maxRoomUsers,
    }));
    cb({ rooms, config: state.config });
  });

  socket.on('request-join', ({ roomId }, cb) => {
    const room = state.rooms.get(roomId);
    if (!room) return cb({ error: 'Room not found' });
    if (room.participants.size >= state.config.maxRoomUsers) return cb({ error: 'Room is full' });
    if (room.participants.has(socket.user.id)) return cb({ error: 'Already in room' });

    const requestId = uuidv4();
    const payload = {
      requestId,
      userId: socket.user.id,
      userName: socket.user.displayName,
      createdAt: Date.now(),
    };
    room.joinRequests.set(requestId, payload);

    io.to(room.id).emit('join-request', payload);

    setTimeout(() => {
      if (room.joinRequests.has(requestId)) {
        room.joinRequests.delete(requestId);
        socket.emit('join-request-timeout', { roomId });
      }
    }, state.config.joinRequestTimeoutMs);

    cb({ ok: true, requestId });
  });

  socket.on('respond-join-request', ({ roomId, requestId, allow }, cb) => {
    const room = state.rooms.get(roomId);
    if (!room) return cb({ error: 'Room not found' });
    if (room.ownerId !== socket.user.id && !socket.user.isAdmin) return cb({ error: 'Only owner/admin' });

    const req = room.joinRequests.get(requestId);
    if (!req) return cb({ error: 'Request expired' });

    room.joinRequests.delete(requestId);
    const requesterSocketId = state.sockets.get(req.userId);
    if (!requesterSocketId) return cb({ error: 'Requester offline' });

    if (!allow) {
      io.to(requesterSocketId).emit('join-denied', { roomId });
      return cb({ ok: true });
    }

    if (room.participants.size >= state.config.maxRoomUsers) {
      io.to(requesterSocketId).emit('join-denied', { roomId, reason: 'Room became full' });
      return cb({ error: 'Room full' });
    }

    room.participants.set(req.userId, { id: req.userId, name: req.userName, isAdmin: false, ghost: false });
    io.to(requesterSocketId).socketsJoin(roomId);
    io.to(requesterSocketId).emit('join-approved', { room: roomSummary(room) });
    io.to(roomId).emit('participant-joined', { id: req.userId, name: req.userName, isAdmin: false, ghost: false });
    cb({ ok: true });
  });

  socket.on('admin-join-room', ({ roomId, visible }, cb) => {
    if (!socket.user.isAdmin) return cb({ error: 'Forbidden' });
    const room = state.rooms.get(roomId);
    if (!room) return cb({ error: 'Room not found' });

    room.participants.set(socket.user.id, { id: socket.user.id, name: 'Admin', isAdmin: true, ghost: !visible });
    socket.join(roomId);

    if (visible) io.to(roomId).emit('participant-joined', { id: socket.user.id, name: 'Admin', isAdmin: true, ghost: false });
    cb({ room: roomSummary(room), ghost: !visible });
  });

  socket.on('leave-room', (_, cb) => {
    const roomId = leaveRoom(socket.user.id);
    if (roomId) socket.leave(roomId);
    cb?.({ ok: true });
    io.emit('rooms-updated');
  });

  socket.on('webrtc-signal', ({ to, data }) => {
    const targetSocket = state.sockets.get(to);
    if (!targetSocket) return;
    io.to(targetSocket).emit('webrtc-signal', { from: socket.user.id, data });
  });

  socket.on('disconnect', () => {
    state.sockets.delete(socket.user.id);
    leaveRoom(socket.user.id);
    io.emit('rooms-updated');
  });
});

server.listen(PORT, HOST, () => {
  // eslint-disable-next-line no-console
  console.log(`Secure Donat Meet running on https://${DOMAIN}:${PORT}`);
});
