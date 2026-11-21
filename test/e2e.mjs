// Two clients join a room, play moves, a third watches. Usage: node test/e2e.mjs [base]
const base = process.argv[2] || 'http://localhost:8790';
const wsBase = base.replace(/^http/, 'ws');
const { code } = await (await fetch(base + '/api/room')).json();
const open = token => new Promise(res => {
  const ws = new WebSocket(`${wsBase}/ws/${code}`); const msgs = [];
  ws.onmessage = e => msgs.push(JSON.parse(e.data));
  ws.onopen = () => { ws.send(JSON.stringify({ type: 'join', token, size: 9 })); res({ ws, msgs }); };
});
const wait = ms => new Promise(r => setTimeout(r, ms));
const a = await open('alice'); await wait(300);
const b = await open('bob'); await wait(300);
const c = await open('carol'); await wait(300);
const last = x => x.msgs.filter(m => m.type === 'state').at(-1);
console.log('room', code, 'colors', last(a).you, last(b).you, last(c).you, 'size', last(a).size);
a.ws.send(JSON.stringify({ type: 'move', i: 40 })); await wait(300);
b.ws.send(JSON.stringify({ type: 'move', i: 40 })); await wait(300); // illegal: occupied
b.ws.send(JSON.stringify({ type: 'move', i: 41 })); await wait(300);
a.ws.send(JSON.stringify({ type: 'move', i: 42 })); await wait(300);
c.ws.send(JSON.stringify({ type: 'move', i: 0 })); await wait(300); // spectator
console.log('errors b:', b.msgs.filter(m => m.type === 'error').map(m => m.message), 'c:', c.msgs.filter(m => m.type === 'error').map(m => m.message));
const g = last(c).game;
console.log('moves', g.moves, 'turn', g.turn, 'online', JSON.stringify(last(c).online));
// reconnect keeps color
a.ws.close(); await wait(300);
const a2 = await open('alice'); await wait(300);
console.log('alice reconnect color', last(a2).you, 'moves kept', last(a2).game.moves.length);
for (const x of [a2, b, c]) x.ws.close();
const ok = last(a2).you === 1 && g.moves.join() === '40,41,42';
console.log(ok ? 'E2E OK' : 'E2E FAIL'); process.exit(ok ? 0 : 1);
