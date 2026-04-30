import WebSocket from 'ws';
import tls from 'tls';
const TOKEN = '';
const GUILD_ID = '';
const PASSWORD = '';
let mfaToken = null;
let seq = null;
let session = null;
let hb = null;
let socket = null;
const vanities = new Map();
const headers = [
  'Host: canary.discord.com',
  'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  `Authorization: ${TOKEN}`,
  'Origin: https://canary.discord.com',
  'X-Super-Properties: '
];
function claim(code) {
  if (!socket || socket.destroyed) socket = tls.connect({ host: 'canary.discord.com', port: 443, rejectUnauthorized: false });
  const body = JSON.stringify({ code });
  const req = [
    `PATCH /api/v9/guilds/${GUILD_ID}/vanity-url HTTP/1.1`,
    ...headers,
    `Content-Length: ${Buffer.byteLength(body)}`,
    `X-Discord-MFA-Authorization: ${mfaToken}`,
    '', body
  ].join('\r\n');
  for (let i = 0; i < 4; i++) socket.write(req);
  console.log(`url aldım → ${code}`);
}
async function getMfa() {
  const res = await fetch('https://canary.discord.com/api/v9/guilds/' + GUILD_ID + '/vanity-url', {
    method: 'PATCH',
    headers: { Authorization: TOKEN }
  }).catch(() => ({ json: () => ({}) }));
  const data = await res.json().catch(() => ({}));
  if (data.code === 60003 && data.mfa?.ticket) {
    const finish = await fetch('https://canary.discord.com/api/v9/mfa/finish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: TOKEN },
      body: JSON.stringify({ ticket: data.mfa.ticket, mfa_type: 'password', data: PASSWORD })
    });
    const f = await finish.json();
    if (f.token) return f.token;
  }
  return null;
}
function wsConnect() {
  const ws = new WebSocket('wss://gateway-us-east1-b.discord.gg/?v=9&encoding=json');

  ws.on('open', () => {
    console.log('gateway baglandı');
    ws.send(JSON.stringify({
      op: 2,
      d: { token: TOKEN, intents: 513, properties: { os: 'windows', browser: 'chrome', device: '' } }
    }));
  });

  ws.on('message', data => {
    const p = JSON.parse(data);
    if (p.s) seq = p.s;
    if (p.op === 10) {
      clearInterval(hb);
      hb = setInterval(() => ws.send(JSON.stringify({ op: 1, d: seq })), p.d.heartbeat_interval);
    }
    if (p.op === 0) {
      if (p.t === 'READY') {
        session = p.d.session_id;
        p.d.guilds.forEach(g => g.vanity_url_code && vanities.set(g.id, g.vanity_url_code));
      }
      if (p.t === 'GUILD_UPDATE' || p.t === 'GUILD_DELETE') {
        const old = vanities.get(p.d.id || p.d.guild_id);
        const now = p.d.vanity_url_code;
        if (old && old !== now) {
          claim(old);
          vanities.delete(p.d.id || p.d.guild_id);
        }
        if (now) vanities.set(p.d.id || p.d.guild_id, now);
      }
    }
  });

  ws.on('close', () => {
    clearInterval(hb);
    setTimeout(wsConnect, 3000);
  });
}

(async () => {
  console.log(`
vanity sniper 
—————————————————
hedef url: ${GUILD_ID}
start ediyorum aga
  `);

  mfaToken = await getMfa();
  if (!mfaToken) return console.log('mfa fail');

  console.log('mfayı bypass etik aga');
  wsConnect();

  setInterval(async () => {
    const newToken = await getMfa();
    if (newToken) mfaToken = newToken;
  }, 180000);
})();
