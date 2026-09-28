// Unit tests for the game rules:  npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyMove, emptyBoard, nextTurn, normalizeCode, resultOf, roomCode, winnerOf } from '../src/game.js';

const board = (s) => s.split('').map((c) => (c === '.' ? null : c));

test('detects every winning line', () => {
  for (const s of ['XXX......', '...OOO...', '......XXX', 'X..X..X..', '.O..O..O.', '..X..X..X', 'X...X...X', '..O.O.O..']) {
    assert.ok(winnerOf(board(s)), s);
  }
  assert.equal(winnerOf(board('XOXOXO...')), null);
});

test('a win on the ninth move is a win, not a draw', () => {
  // X completes the diagonal with the last free square
  assert.deepEqual(resultOf(board('XOXOXOOXX')), { winner: 'X', line: [0, 4, 8] });
});

test('full board without a line is a draw', () => {
  assert.deepEqual(resultOf(board('XOXXOOOXX')), { winner: null, line: [] });
});

test('in-progress board has no result', () => {
  assert.equal(resultOf(board('XO.......')), null);
});

test('moves must be legal: empty square, right turn, game not over', () => {
  const b = emptyBoard();
  assert.equal(applyMove(b, 0, 'O'), null, 'X opens');
  const b1 = applyMove(b, 4, 'X');
  assert.deepEqual(b1, board('....X....'));
  assert.equal(applyMove(b1, 4, 'O'), null, 'square taken');
  assert.equal(applyMove(b1, 0, 'X'), null, 'not X turn');
  assert.equal(applyMove(board('XXX.OO...'), 6, 'O'), null, 'game already won');
  assert.equal(applyMove(b1, 9, 'O'), null, 'out of range');
  assert.equal(nextTurn(b1), 'O');
});

test('room codes are 5 unambiguous characters and normalize input', () => {
  for (let i = 0; i < 200; i++) assert.match(roomCode(), /^[A-HJ-NP-Z2-9]{5}$/);
  assert.equal(normalizeCode(' ab-c 12x9 '), 'ABC12');
});
