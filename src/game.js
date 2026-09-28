// Pure game rules: no UI, no network, so they can be unit-tested.

export const LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // columns
  [0, 4, 8], [2, 4, 6],            // diagonals
];

export const emptyBoard = () => Array(9).fill(null);

/** The winning piece and line, or null. */
export function winnerOf(board) {
  for (const [a, b, c] of LINES) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) return { piece: board[a], line: [a, b, c] };
  }
  return null;
}

/** Round result once it's decided: { winner: 'X' | 'O' | null (draw), line }, or null while in play. */
export function resultOf(board) {
  const win = winnerOf(board);
  if (win) return { winner: win.piece, line: win.line };
  return board.every(Boolean) ? { winner: null, line: [] } : null;
}

/** Apply a move if it's legal; returns the new board or null. X always opens a round. */
export function applyMove(board, index, piece) {
  if (!Number.isInteger(index) || index < 0 || index > 8 || board[index] || resultOf(board)) return null;
  const xs = board.filter((v) => v === 'X').length;
  const os = board.filter((v) => v === 'O').length;
  const expected = xs === os ? 'X' : 'O';
  if (piece !== expected) return null;
  const next = board.slice();
  next[index] = piece;
  return next;
}

export const nextTurn = (board) => (board.filter(Boolean).length % 2 === 0 ? 'X' : 'O');

// Room codes avoid look-alike characters (0/O, 1/I).
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function roomCode(length = 5, random = Math.random) {
  let code = '';
  for (let i = 0; i < length; i++) code += ALPHABET[Math.floor(random() * ALPHABET.length)];
  return code;
}

export const normalizeCode = (text) => String(text || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
