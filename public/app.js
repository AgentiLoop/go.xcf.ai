import { newGame, play, pass, resign, score, aiMove, BLACK, WHITE, EMPTY } from '/engine.js';

const $ = id => document.getElementById(id);
const canvas = $('board'), ctx = canvas.getContext('2d');
let g = null, mode = null, humanColor = BLACK, history = [], ws = null, you = 0, online = { 1: false, 2: false }, hover = -1, size = 19, roomCode = null;
const token = localStorage.goToken || (localStorage.goToken = crypto.randomUUID());

function seg(id, cb) {
  $(id).addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    for (const x of $(id).children) x.classList.toggle('on', x === b);
    cb(+b.dataset.v);
  });
}
seg('size', v => size = v);
seg('color', v => humanColor = v);

function show() { resize(); }
let selMode = 'ai';
seg('modeSel', v => { selMode = v; $('aiOpts').hidden = v !== 'ai'; $('onlineOpts').hidden = v !== 'online'; });

function start(m) {
  mode = m; g = newGame(size); history = []; you = 0;
  if (ws) { const w = ws; ws = null; w.close(); window.history.replaceState(null, '', '/'); }
  $('shareLink').value = ''; $('copy').textContent = 'Copy';
  $('mode').textContent = m === 'ai' ? `vs Computer · you play ${humanColor === BLACK ? 'Black' : 'White'}` : 'Same screen · 2 players';
  show(true); render();
  if (m === 'ai' && humanColor === WHITE) setTimeout(aiTurn, 300);
}
$('newGame').onclick = async () => {
  if (selMode !== 'online') return start(selMode);
  const { code } = await (await fetch('/api/room')).json(); joinRoom(code, true);
};
$('joinForm').onsubmit = e => { e.preventDefault(); const c = $('joinCode').value.trim().toUpperCase(); if (c) joinRoom(c); };
$('copy').onclick = () => { navigator.clipboard.writeText($('shareLink').value); $('copy').textContent = 'Copied'; };

function joinRoom(code, creating) {
  if (ws) { const w = ws; ws = null; w.close(); }
  mode = 'online'; roomCode = code; g = null;
  window.history.replaceState(null, '', '/r/' + code);
  $('shareLink').value = location.origin + '/r/' + code; $('copy').textContent = 'Copy';
  $('mode').textContent = 'Online · room ' + code;
  show(true); setStatus('Connecting…');
  ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws/' + code);
  ws.onopen = () => ws.send(JSON.stringify({ type: 'join', token, size: creating ? size : undefined }));
  ws.onmessage = e => {
    const m = JSON.parse(e.data);
    if (m.type === 'error') return setStatus(m.message, true);
    g = m.game; you = m.you; online = m.online; size = g.size; resize(); render();
  };
  ws.onclose = () => { if (mode === 'online' && ws) setStatus('Disconnected — reload to reconnect', true); };
}

function myTurn() {
  if (!g || g.over) return false;
  if (mode === 'ai') return g.turn === humanColor;
  if (mode === 'online') return g.turn === you && online[BLACK] && online[WHITE];
  return true;
}

function act(type, i) {
  if (mode === 'online') return ws.send(JSON.stringify({ type, i }));
  if (type !== 'resign' && !myTurn()) return;
  const snap = JSON.stringify(g);
  if (type === 'move') { const res = play(g, i); if (!res.ok) return setStatus(res.reason, true); }
  else if (type === 'pass') pass(g);
  else if (type === 'resign') resign(g, mode === 'ai' ? humanColor : g.turn);
  history.push(snap); render();
  if (mode === 'ai' && !g.over && g.turn !== humanColor) setTimeout(aiTurn, 250);
}
function aiTurn() {
  if (!g || g.over || mode !== 'ai') return;
  const i = aiMove(g);
  if (i < 0) pass(g); else play(g, i);
  render();
}
$('pass').onclick = () => act('pass');
$('resign').onclick = () => { if (confirm('Resign this game?')) act('resign'); };
$('undo').onclick = () => {
  if (mode === 'online' || !history.length) return;
  g = JSON.parse(history.pop());
  if (mode === 'ai' && g.turn !== humanColor && history.length) g = JSON.parse(history.pop());
  render();
};
$('again').onclick = () => mode === 'online' ? ws.send(JSON.stringify({ type: 'rematch' })) : start(mode);
$('showTerr').onchange = render;

function setStatus(t, err) { const d = $('turnDot'); if (d && g) d.className = 'turn-dot ' + (g.over ? 'over' : g.turn === BLACK ? 'b' : 'w'); const s = $('status'); s.textContent = t; s.classList.toggle('err', !!err); }

// ---------- drawing ----------
let px = 0, cell = 0, margin = 0;
function resize() {
  const w = canvas.getBoundingClientRect().width || 600, dpr = devicePixelRatio || 1;
  canvas.width = canvas.height = Math.round(w * dpr);
  px = canvas.width; margin = px / (size + 1); cell = (px - 2 * margin) / (size - 1);
  render();
}
addEventListener('resize', resize);
const pos = i => [margin + (i % size) * cell, margin + ((i / size) | 0) * cell];

function render() {
  if (!g) return;
  const grad = ctx.createLinearGradient(0, 0, px, px);
  grad.addColorStop(0, '#e3b56f'); grad.addColorStop(1, '#c8914a');
  ctx.fillStyle = grad; ctx.fillRect(0, 0, px, px);
  ctx.strokeStyle = 'rgba(40,25,10,.85)'; ctx.lineWidth = Math.max(1, px / 700);
  for (let k = 0; k < size; k++) {
    const a = margin + k * cell;
    ctx.beginPath(); ctx.moveTo(margin, a); ctx.lineTo(px - margin, a); ctx.moveTo(a, margin); ctx.lineTo(a, px - margin); ctx.stroke();
  }
  const hoshi = size === 19 ? [3, 9, 15] : size === 13 ? [3, 6, 9] : [2, 4, 6];
  ctx.fillStyle = 'rgba(40,25,10,.9)';
  for (const y of hoshi) for (const x of hoshi) {
    if (size === 9 && (x === 4) !== (y === 4)) continue;
    ctx.beginPath(); ctx.arc(margin + x * cell, margin + y * cell, cell * 0.12, 0, 7); ctx.fill();
  }
  const owner = ($('showTerr').checked || g.over) ? score(g).owner : null;
  for (let i = 0; i < g.board.length; i++) {
    const c = g.board[i]; const [x, y] = pos(i);
    if (c) drawStone(x, y, c, 1);
    else if (owner && owner[i]) { ctx.fillStyle = owner[i] === BLACK ? 'rgba(0,0,0,.55)' : 'rgba(255,255,255,.7)'; ctx.fillRect(x - cell * .17, y - cell * .17, cell * .34, cell * .34); }
  }
  const last = g.moves[g.moves.length - 1];
  if (last >= 0 && g.board[last]) { const [x, y] = pos(last); ctx.strokeStyle = g.board[last] === BLACK ? '#fff' : '#000'; ctx.lineWidth = cell * .07; ctx.beginPath(); ctx.arc(x, y, cell * .22, 0, 7); ctx.stroke(); }
  if (hover >= 0 && g.board[hover] === EMPTY && myTurn()) { const [x, y] = pos(hover); drawStone(x, y, g.turn, .45); }

  $('capB').textContent = g.captures[BLACK]; $('capW').textContent = g.captures[WHITE];
  $('onB').textContent = mode === 'online' ? (online[BLACK] ? ' · online' : ' · waiting') + (you === BLACK ? ' (you)' : '') : '';
  $('onW').textContent = mode === 'online' ? (online[WHITE] ? ' · online' : ' · waiting') + (you === WHITE ? ' (you)' : '') : '';
  $('undo').hidden = mode === 'online';
  $('again').hidden = !g.over;
  const name = c => c === BLACK ? 'Black' : 'White';
  if (g.over) setStatus(g.result.text);
  else if (mode === 'online' && !(online[BLACK] && online[WHITE])) setStatus(you ? 'Waiting for opponent — share the link' : 'Watching');
  else if (mode === 'online') setStatus(g.turn === you ? `Your move (${name(you)})` : `${name(g.turn)} to play…`);
  else if (mode === 'ai') setStatus(g.turn === humanColor ? `Your move (${name(humanColor)})` : 'Computer is thinking…');
  else setStatus(`${name(g.turn)} to play`);
  if (g.passes === 1 && !g.over) $('status').textContent += ' · opponent passed';
}

function drawStone(x, y, c, alpha) {
  ctx.globalAlpha = alpha;
  const r = cell * 0.47;
  if (alpha === 1) { ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.arc(x + r * .12, y + r * .15, r, 0, 7); ctx.fill(); }
  const gr = ctx.createRadialGradient(x - r * .35, y - r * .35, r * .1, x, y, r);
  if (c === BLACK) { gr.addColorStop(0, '#666'); gr.addColorStop(1, '#050505'); }
  else { gr.addColorStop(0, '#ffffff'); gr.addColorStop(1, '#bdbdbd'); }
  ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
  ctx.globalAlpha = 1;
}

function pointAt(e) {
  const b = canvas.getBoundingClientRect(), s = px / b.width;
  const x = Math.round(((e.clientX - b.left) * s - margin) / cell), y = Math.round(((e.clientY - b.top) * s - margin) / cell);
  return x >= 0 && y >= 0 && x < size && y < size ? y * size + x : -1;
}
canvas.addEventListener('mousemove', e => { const h = pointAt(e); if (h !== hover) { hover = h; render(); } });
canvas.addEventListener('mouseleave', () => { hover = -1; render(); });
canvas.addEventListener('click', e => { const i = pointAt(e); if (i >= 0 && myTurn()) act('move', i); });

const r = location.pathname.match(/^\/r\/([A-Z0-9]{4,8})$/);
if (r) { joinRoom(r[1]); for (const b of $('modeSel').children) b.classList.toggle('on', b.dataset.v === 'online'); selMode = 'online'; $('aiOpts').hidden = true; $('onlineOpts').hidden = false; }
else start('ai');
