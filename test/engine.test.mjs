import test from 'node:test';
import assert from 'node:assert/strict';
import { newGame, play, pass, aiMove, BLACK, WHITE } from '../public/engine.js';
const at = (g, x, y) => y * g.size + x;
test('capture a single stone', () => {
  const g2 = newGame(9);
  const seq = [[1,0],[1,1],[0,1],[8,8],[2,1],[8,7],[1,2]];
  for (const [x, y] of seq) assert.ok(play(g2, at(g2, x, y)).ok);
  assert.equal(g2.board[at(g2,1,1)], 0);
  assert.equal(g2.captures[BLACK], 1);
});
test('suicide is illegal', () => {
  const g = newGame(9);
  for (const [x, y] of [[1,0],[8,8],[0,1]]) play(g, at(g, x, y));
  assert.equal(play(g, at(g, 0, 0)).ok, false);
});
test('ko cannot be retaken immediately', () => {
  const g = newGame(9);
  // B: (1,0)(0,1)(1,2)  W: (2,0)(3,1)(2,2) ; B (2,1) ; W (1,1) captures? build classic ko
  const seq = [[1,0],[2,0],[0,1],[3,1],[1,2],[2,2],[2,1],[1,1]];
  for (const [x, y] of seq) assert.ok(play(g, at(g, x, y)).ok, `${x},${y}`);
  assert.equal(g.board[at(g,2,1)], 0); // W captured B(2,1)
  assert.equal(play(g, at(g, 2, 1)).ok, false); // immediate retake blocked
});
test('two passes end the game and AI plays legal moves', () => {
  const g = newGame(9);
  for (let k = 0; k < 40; k++) { const i = aiMove(g); if (i < 0) pass(g); else assert.ok(play(g, i).ok); if (g.over) break; }
  pass(g); pass(g);
  assert.ok(g.over); assert.ok(g.result.text.includes('wins'));
});
