# Donat Meet (Self-Hosted)

A lightweight HTTPS video-call platform with room owner approval, admin controls, camera/mic toggles, camera switching, and modern animated UI.

## Setup
1. Install dependencies:
   ```bash
   npm install
   ```
2. Put TLS files in:
   - `certs/privkey.pem`
   - `certs/fullchain.pem`
   (or set `TLS_KEY_PATH` / `TLS_CERT_PATH` env vars)
3. Run:
   ```bash
   PORT=3020 DOMAIN=meet.donatapp.ir npm start
   ```
4. Open: `https://meet.donatapp.ir:3020`

## Admin
- Username: `sinamp`
- Password: `sinamp@1383`

Admin can inspect rooms and update runtime limits (`maxRooms`, `maxRoomUsers`).

## Notes
- Designed for small rooms (max default 4 users), using P2P WebRTC mesh + Socket.IO signaling.
- Fully self-hosted: no external auth/storage/service dependencies.
