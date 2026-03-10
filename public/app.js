const app = document.getElementById('app');

const state = {
  user: null,
  socket: null,
  config: { maxRooms: 5, maxRoomUsers: 4 },
  room: null,
  rooms: [],
  localStream: null,
  peers: new Map(),
  selectedId: null,
  availableCams: [],
  camIndex: 0,
  ghostMode: true,
};

function rtcConfig() {
  return { iceServers: state.config.iceServers || [] };
}

async function api(path, method = 'GET', body) {
  const res = await fetch(path, {
    method,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error((await res.json()).error || 'Request failed');
  return res.json();
}

function toast(msg) {
  const el = document.createElement('div');
  el.textContent = msg;
  el.className = 'card';
  el.style.position = 'fixed';
  el.style.right = '12px';
  el.style.bottom = '12px';
  el.style.zIndex = 999;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2500);
}

function renderAuth() {
  app.innerHTML = `
    <div class="card" style="max-width: 460px; margin: 8vh auto;" >
      <h2>Donat Meet</h2>
      <p class="notice">Secure self-hosted meetings</p>
      <div class="grid">
        <input id="name" placeholder="Display name" maxlength="24" />
        <button id="join" class="primary">Enter Platform</button>
      </div>
      <hr style="opacity:.2;margin:16px 0"/>
      <h3>Admin</h3>
      <div class="grid">
        <input id="adminUser" placeholder="Username" />
        <input id="adminPass" placeholder="Password" type="password" />
        <button id="adminLogin" class="good">Admin Login</button>
      </div>
    </div>`;

  document.getElementById('join').onclick = async () => {
    const displayName = document.getElementById('name').value || 'Guest';
    const data = await api('/api/session', 'POST', { displayName });
    state.user = data.user;
    state.config = data.config;
    connectSocket();
  };

  document.getElementById('adminLogin').onclick = async () => {
    const username = document.getElementById('adminUser').value;
    const password = document.getElementById('adminPass').value;
    const data = await api('/api/admin/login', 'POST', { username, password });
    state.user = data.user;
    state.config = data.config;
    connectSocket();
  };
}

function connectSocket() {
  const sessionToken = document.cookie.split('; ').find((v) => v.startsWith('sessionToken='))?.split('=')[1];
  state.socket = io({ auth: { sessionToken } });

  state.socket.on('connect', () => {
    renderLobby();
    fetchRooms();
  });

  state.socket.on('rooms-updated', fetchRooms);
  state.socket.on('config-updated', (cfg) => {
    state.config = cfg;
    if (!state.room) renderLobby();
  });

  state.socket.on('join-request', ({ requestId, userName }) => {
    if (!state.room || state.room.ownerId !== state.user.id) return;
    const accept = confirm(`${userName} requests to join your room. Approve?`);
    state.socket.emit('respond-join-request', { roomId: state.room.id, requestId, allow: accept }, () => {});
  });

  state.socket.on('join-approved', ({ room }) => {
    state.room = room;
    startCallUI();
  });

  state.socket.on('join-denied', () => toast('Join denied'));
  state.socket.on('join-request-timeout', () => toast('Request timed out'));

  state.socket.on('participant-joined', (p) => {
    state.room?.participants.push(p);
    if (!p.ghost) makePeerConnection(p.id, true);
    renderCall();
  });

  state.socket.on('participant-left', ({ userId }) => {
    state.room.participants = state.room.participants.filter((p) => p.id !== userId);
    if (state.peers.has(userId)) {
      state.peers.get(userId).pc.close();
      state.peers.delete(userId);
    }
    renderCall();
  });

  state.socket.on('owner-changed', ({ ownerId, ownerName }) => {
    if (state.room) {
      state.room.ownerId = ownerId;
      state.room.ownerName = ownerName;
      toast(`Owner changed to ${ownerName}`);
    }
  });

  state.socket.on('webrtc-signal', async ({ from, data }) => {
    const peer = makePeerConnection(from, false);
    if (data.sdp) {
      await peer.pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
      if (data.sdp.type === 'offer') {
        const answer = await peer.pc.createAnswer();
        await peer.pc.setLocalDescription(answer);
        state.socket.emit('webrtc-signal', { to: from, data: { sdp: peer.pc.localDescription } });
      }
    }
    if (data.ice) await peer.pc.addIceCandidate(new RTCIceCandidate(data.ice));
  });
}

function fetchRooms() {
  state.socket.emit('list-rooms', {}, ({ rooms, config }) => {
    state.rooms = rooms;
    state.config = config;
    if (!state.room) renderLobby();
  });
}

function renderLobby() {
  app.innerHTML = `
    <div class="card">
      <h2>Hello ${state.user.displayName}</h2>
      <p class="notice">Rooms: ${state.rooms.length}/${state.config.maxRooms} · Max users per room: ${state.config.maxRoomUsers}</p>
      <div class="controls">
        <button id="createRoom" class="primary">Create Room</button>
        ${state.user.isAdmin ? '<button id="adminPanel" class="good">Admin Panel</button>' : ''}
      </div>
      <h3>Active Rooms</h3>
      <div class="grid rooms" id="rooms"></div>
    </div>`;

  const list = document.getElementById('rooms');
  if (!state.rooms.length) list.innerHTML = '<p class="notice">No active room yet.</p>';

  state.rooms.forEach((r) => {
    const el = document.createElement('div');
    el.className = 'room';
    el.innerHTML = `<b>${r.id}</b><div>Owner: ${r.ownerName}</div><div>${r.participants} users</div>`;
    const btn = document.createElement('button');
    btn.textContent = 'Request to join';
    btn.disabled = !r.canRequest;
    btn.onclick = () => state.socket.emit('request-join', { roomId: r.id }, (res) => toast(res.error || 'Request sent'));
    el.appendChild(btn);

    if (state.user.isAdmin) {
      const monitor = document.createElement('button');
      monitor.textContent = state.ghostMode ? 'Ghost monitor' : 'Visible monitor';
      monitor.onclick = () => {
        state.socket.emit('admin-join-room', { roomId: r.id, visible: !state.ghostMode }, (res) => {
          if (res.error) return toast(res.error);
          state.room = res.room;
          startCallUI();
        });
      };
      el.appendChild(monitor);
    }

    list.appendChild(el);
  });

  document.getElementById('createRoom').onclick = () => {
    state.socket.emit('create-room', {}, (res) => {
      if (res.error) return toast(res.error);
      state.room = res.room;
      startCallUI();
    });
  };

  if (state.user.isAdmin) {
    document.getElementById('adminPanel').onclick = renderAdminPanel;
  }
}

async function ensureMedia() {
  if (state.localStream) return;
  state.localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: { width: 1280, height: 720 } });
  const devices = await navigator.mediaDevices.enumerateDevices();
  state.availableCams = devices.filter((d) => d.kind === 'videoinput');
}

function makePeerConnection(peerId, polite) {
  if (state.peers.has(peerId)) return state.peers.get(peerId);
  const pc = new RTCPeerConnection(rtcConfig());
  const remote = new MediaStream();

  state.localStream?.getTracks().forEach((t) => pc.addTrack(t, state.localStream));

  pc.onicecandidate = (e) => {
    if (e.candidate) state.socket.emit('webrtc-signal', { to: peerId, data: { ice: e.candidate } });
  };

  pc.ontrack = (e) => e.streams[0].getTracks().forEach((t) => remote.addTrack(t));

  pc.onnegotiationneeded = async () => {
    if (!polite) return;
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    state.socket.emit('webrtc-signal', { to: peerId, data: { sdp: pc.localDescription } });
  };

  state.peers.set(peerId, { pc, remote });
  renderCall();
  return { pc, remote };
}

async function startCallUI() {
  await ensureMedia();
  state.room.participants.forEach((p) => {
    if (p.id !== state.user.id && !p.ghost) makePeerConnection(p.id, true);
  });
  state.selectedId = state.user.id;
  renderCall();
}

function getParticipantName(id) {
  return state.room?.participants.find((p) => p.id === id)?.name || 'Participant';
}

function renderCall() {
  app.innerHTML = `
    <div class="vcall">
      <div class="stage" id="stage"></div>
      <div>
        <div class="sidebar" id="sidebar"></div>
        <div class="card controls">
          <button id="mute">Mute/Unmute</button>
          <button id="cam">Camera On/Off</button>
          <button id="switchCam">Switch Camera</button>
          <button id="leave" class="warn">Leave</button>
        </div>
      </div>
    </div>`;

  const views = [{ id: state.user.id, stream: state.localStream, label: `${state.user.displayName} (You)` }];
  for (const [id, v] of state.peers) views.push({ id, stream: v.remote, label: getParticipantName(id) });

  const active = views.find((v) => v.id === state.selectedId) || views[0];
  const stage = document.getElementById('stage');
  stage.innerHTML = '';
  const mainVideo = document.createElement('video');
  mainVideo.autoplay = true;
  mainVideo.playsInline = true;
  mainVideo.srcObject = active.stream;
  if (active.id === state.user.id) mainVideo.muted = true;
  stage.appendChild(mainVideo);
  const tag = document.createElement('div');
  tag.className = 'label';
  tag.textContent = active.label;
  stage.appendChild(tag);

  const side = document.getElementById('sidebar');
  views.filter((v) => v.id !== active.id).forEach((v) => {
    const thumb = document.createElement('div');
    thumb.className = 'thumb';
    thumb.onclick = () => { state.selectedId = v.id; renderCall(); };
    const vv = document.createElement('video');
    vv.autoplay = true;
    vv.playsInline = true;
    vv.srcObject = v.stream;
    vv.muted = v.id === state.user.id;
    thumb.appendChild(vv);
    const t = document.createElement('div');
    t.className = 'label';
    t.textContent = v.label;
    thumb.appendChild(t);
    side.appendChild(thumb);
  });

  document.getElementById('mute').onclick = () => {
    state.localStream.getAudioTracks().forEach((t) => { t.enabled = !t.enabled; });
    toast(`Mic ${state.localStream.getAudioTracks()[0].enabled ? 'enabled' : 'muted'}`);
  };

  document.getElementById('cam').onclick = () => {
    state.localStream.getVideoTracks().forEach((t) => { t.enabled = !t.enabled; });
    toast(`Camera ${state.localStream.getVideoTracks()[0].enabled ? 'enabled' : 'disabled'}`);
  };

  document.getElementById('switchCam').onclick = async () => {
    if (!state.availableCams.length) return;
    state.camIndex = (state.camIndex + 1) % state.availableCams.length;
    const stream = await navigator.mediaDevices.getUserMedia({ video: { deviceId: { exact: state.availableCams[state.camIndex].deviceId } }, audio: true });
    const newVideoTrack = stream.getVideoTracks()[0];
    const oldVideoTrack = state.localStream.getVideoTracks()[0];
    state.localStream.removeTrack(oldVideoTrack);
    oldVideoTrack.stop();
    state.localStream.addTrack(newVideoTrack);
    for (const { pc } of state.peers.values()) {
      const sender = pc.getSenders().find((s) => s.track && s.track.kind === 'video');
      if (sender) sender.replaceTrack(newVideoTrack);
    }
    renderCall();
  };

  document.getElementById('leave').onclick = () => {
    state.socket.emit('leave-room', {}, () => {
      state.room = null;
      state.peers.forEach(({ pc }) => pc.close());
      state.peers.clear();
      renderLobby();
      fetchRooms();
    });
  };
}

async function renderAdminPanel() {
  const data = await api('/api/admin/rooms');
  app.innerHTML = `
    <div class="card">
      <h2>Admin Panel</h2>
      <div class="controls">
        <input id="maxRooms" type="number" min="1" value="${data.config.maxRooms}">
        <input id="maxUsers" type="number" min="2" value="${data.config.maxRoomUsers}">
        <button id="save" class="good">Save Limits</button>
        <button id="ghostToggle">Ghost Mode: ${state.ghostMode ? 'ON' : 'OFF'}</button>
        <button id="back">Back</button>
      </div>
      <h3>Rooms</h3>
      <pre>${JSON.stringify(data.rooms, null, 2)}</pre>
    </div>
  `;

  document.getElementById('save').onclick = async () => {
    const maxRooms = Number(document.getElementById('maxRooms').value);
    const maxRoomUsers = Number(document.getElementById('maxUsers').value);
    await api('/api/admin/config', 'POST', { maxRooms, maxRoomUsers });
    toast('Limits updated');
  };
  document.getElementById('ghostToggle').onclick = () => {
    state.ghostMode = !state.ghostMode;
    renderAdminPanel();
  };
  document.getElementById('back').onclick = renderLobby;
}

(async function boot() {
  try {
    const data = await api('/api/me');
    state.user = data.user;
    state.config = data.config;
    connectSocket();
  } catch {
    renderAuth();
  }
})();
