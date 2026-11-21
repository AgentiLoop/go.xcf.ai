// Go rules engine shared by the browser and the Durable Object.
// Board cells: 0 empty, 1 black, 2 white. Area (Chinese) scoring, positional-free simple ko.

export const EMPTY = 0, BLACK = 1, WHITE = 2;
export const other = c => (c === BLACK ? WHITE : BLACK);

export function newGame(size = 19, komi = 6.5) {
  return { size, komi, board: new Array(size * size).fill(EMPTY), turn: BLACK,
    captures: { 1: 0, 2: 0 }, ko: -1, passes: 0, moves: [], over: false, result: null };
}

export function neighbors(size, i) {
  const x = i % size, y = (i / size) | 0, n = [];
  if (x > 0) n.push(i - 1);
  if (x < size - 1) n.push(i + 1);
  if (y > 0) n.push(i - size);
  if (y < size - 1) n.push(i + size);
  return n;
}

export function group(board, size, i) {
  const color = board[i], stones = [i], seen = new Set([i]), libs = new Set();
  for (let k = 0; k < stones.length; k++) {
    for (const n of neighbors(size, stones[k])) {
      if (board[n] === EMPTY) libs.add(n);
      else if (board[n] === color && !seen.has(n)) { seen.add(n); stones.push(n); }
    }
  }
  return { stones, libs };
}

// Returns { ok, reason, board, captured } without mutating g.
export function tryPlay(g, i) {
  if (g.over) return { ok: false, reason: 'Game over' };
  if (i < 0 || i >= g.board.length || g.board[i] !== EMPTY) return { ok: false, reason: 'Occupied' };
  if (i === g.ko) return { ok: false, reason: 'Ko: retake later' };
  const me = g.turn, them = other(me), b = g.board.slice();
  b[i] = me;
  const captured = [];
  for (const n of neighbors(g.size, i)) {
    if (b[n] === them) {
      const gr = group(b, g.size, n);
      if (gr.libs.size === 0) for (const s of gr.stones) { b[s] = EMPTY; captured.push(s); }
    }
  }
  if (group(b, g.size, i).libs.size === 0) return { ok: false, reason: 'Suicide is not allowed' };
  return { ok: true, board: b, captured };
}

export function play(g, i) {
  const r = tryPlay(g, i);
  if (!r.ok) return r;
  const me = g.turn;
  let ko = -1;
  if (r.captured.length === 1) {
    const gr = group(r.board, g.size, i);
    if (gr.stones.length === 1 && gr.libs.size === 1) ko = r.captured[0];
  }
  g.board = r.board; g.captures[me] += r.captured.length; g.ko = ko;
  g.passes = 0; g.moves.push(i); g.turn = other(me);
  return r;
}

export function pass(g) {
  if (g.over) return;
  g.passes++; g.ko = -1; g.moves.push(-1); g.turn = other(g.turn);
  if (g.passes >= 2) finish(g);
}

export function resign(g, color) {
  if (g.over) return;
  g.over = true;
  g.result = { winner: other(color), text: `${other(color) === BLACK ? 'Black' : 'White'} wins by resignation` };
}

// Area scoring: stones + empty regions bordered by one color only.
export function score(g) {
  const { board, size } = g, owner = new Array(board.length).fill(0), seen = new Set();
  let black = 0, white = 0;
  for (let i = 0; i < board.length; i++) {
    if (board[i] === BLACK) black++;
    else if (board[i] === WHITE) white++;
    else if (!seen.has(i)) {
      const region = [i], borders = new Set(); seen.add(i);
      for (let k = 0; k < region.length; k++) for (const n of neighbors(size, region[k])) {
        if (board[n] === EMPTY) { if (!seen.has(n)) { seen.add(n); region.push(n); } }
        else borders.add(board[n]);
      }
      if (borders.size === 1) {
        const c = [...borders][0];
        for (const r of region) owner[r] = c;
        if (c === BLACK) black += region.length; else white += region.length;
      }
    }
  }
  white += g.komi;
  return { black, white, owner };
}

export function finish(g) {
  const s = score(g);
  g.over = true;
  const winner = s.black > s.white ? BLACK : WHITE;
  g.result = { winner, black: s.black, white: s.white,
    text: `${winner === BLACK ? 'Black' : 'White'} wins by ${Math.abs(s.black - s.white)} (B ${s.black} – W ${s.white})` };
}

// Simple computer player: captures, saves groups in atari, avoids self-atari and filling own eyes,
// prefers moves near the action and on the 3rd/4th lines early.
export function aiMove(g, level = 2) {
  const { size, board } = g, me = g.turn, them = other(me);
  const legal = [];
  for (let i = 0; i < board.length; i++) if (board[i] === EMPTY && tryPlay(g, i).ok) legal.push(i);
  if (!legal.length) return -1;
  const scoreMove = i => {
    const r = tryPlay(g, i);
    let s = Math.random() * (level >= 2 ? 2 : 8);
    s += r.captured.length * 12;
    const ns = neighbors(size, i);
    // own eye: all neighbors mine -> don't fill
    if (ns.every(n => board[n] === me)) s -= 40;
    // save own group in atari
    for (const n of ns) if (board[n] === me && group(board, size, n).libs.size === 1) s += 10 * group(board, size, n).stones.length;
    // put opponent in atari
    for (const n of ns) if (r.board[n] === them && group(r.board, size, n).libs.size === 1) s += 4;
    // avoid self-atari
    const mine = group(r.board, size, i);
    if (mine.libs.size === 1 && r.captured.length === 0) s -= 15 * mine.stones.length;
    s += Math.min(mine.libs.size, 4);
    // locality / opening lines
    const x = i % size, y = (i / size) | 0, edge = Math.min(x, y, size - 1 - x, size - 1 - y);
    if (g.moves.length < size) s += edge === 2 || edge === 3 ? 3 : edge <= 1 ? -3 : 0;
    else if (edge === 0) s -= 1.5;
    let near = 0;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const xx = x + dx, yy = y + dy;
      if (xx >= 0 && yy >= 0 && xx < size && yy < size && board[yy * size + xx] !== EMPTY) near++;
    }
    s += Math.min(near, 3);
    return s;
  };
  let best = -1, bestS = -Infinity;
  for (const i of legal) { const s = scoreMove(i); if (s > bestS) { bestS = s; best = i; } }
  // pass when nothing useful is left late in the game
  if (g.moves.length > size * size * 0.6 && bestS < 1) return -1;
  return best;
}
