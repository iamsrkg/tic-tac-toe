import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { applyMove, emptyBoard, nextTurn, normalizeCode, resultOf, roomCode } from './src/game';
import { channelFor, createClient, occupancy } from './src/realtime';

/*
 * Protocol (one PubNub channel per room):
 *   guest → { type: 'join', name }          host → { type: 'start', x, o }
 *   either → { type: 'move', index, piece } host → { type: 'reset' } | { type: 'end' }
 * The host plays X. Presence events tell each side when the other leaves.
 */
export default function App() {
  const net = useRef(null);                 // { pubnub, userId }
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [screen, setScreen] = useState('lobby');        // lobby | waiting | game
  const [room, setRoom] = useState(null);                // { code, channel, host, piece }
  const [players, setPlayers] = useState({ X: '', O: '' });
  const [board, setBoard] = useState(emptyBoard());
  const [scores, setScores] = useState({ X: 0, O: 0 });
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  // Refs let the long-lived PubNub listener see current values.
  const roomRef = useRef(room);
  const nameRef = useRef(name);
  roomRef.current = room;
  nameRef.current = name;

  const result = resultOf(board);
  const turn = nextTurn(board);

  // Score each finished round exactly once.
  const scoredRef = useRef(false);
  useEffect(() => {
    if (result && !scoredRef.current) {
      scoredRef.current = true;
      if (result.winner) setScores((s) => ({ ...s, [result.winner]: s[result.winner] + 1 }));
    }
  }, [result]);

  const startRound = () => {
    scoredRef.current = false;
    setBoard(emptyBoard());
  };

  const publish = (message) => net.current.pubnub.publish({ channel: roomRef.current.channel, message });

  const leave = (message = '') => {
    if (net.current) {
      net.current.pubnub.removeAllListeners();
      net.current.pubnub.unsubscribeAll();
      net.current = null;
    }
    setRoom(null);
    setScreen('lobby');
    setPlayers({ X: '', O: '' });
    setScores({ X: 0, O: 0 });
    startRound();
    setNotice(message);
  };

  const connect = (channel) => {
    const client = createClient();
    client.pubnub.addListener({
      message: (m) => {
        if (m.publisher === client.userId) return;          // ignore our own echo
        const msg = m.message || {};
        const current = roomRef.current;
        if (!current) return;
        if (msg.type === 'join' && current.host) {
          setPlayers({ X: nameRef.current, O: msg.name });
          client.pubnub.publish({ channel, message: { type: 'start', x: nameRef.current, o: msg.name } });
          startRound();
          setScreen('game');
        } else if (msg.type === 'start' && !current.host) {
          setPlayers({ X: msg.x, O: msg.o });
          startRound();
          setScreen('game');
        } else if (msg.type === 'move') {
          setBoard((b) => applyMove(b, msg.index, msg.piece) || b);
        } else if (msg.type === 'reset') {
          startRound();
        } else if (msg.type === 'end') {
          leave('The host ended the game.');
        }
      },
      presence: (p) => {
        if (p.uuid !== client.userId && (p.action === 'leave' || p.action === 'timeout') && roomRef.current) {
          leave('Your opponent left the room.');
        }
      },
    });
    client.pubnub.subscribe({ channels: [channel], withPresence: true });
    net.current = client;
    return client;
  };

  const createRoom = () => {
    if (!name.trim()) return setNotice('Enter your name first.');
    const newCode = roomCode();
    const channel = channelFor(newCode);
    setNotice('');
    setRoom({ code: newCode, channel, host: true, piece: 'X' });
    setPlayers({ X: name.trim(), O: '' });
    setScreen('waiting');
    connect(channel);
  };

  const joinRoom = async () => {
    const joinCode = normalizeCode(code);
    if (!name.trim()) return setNotice('Enter your name first.');
    if (joinCode.length !== 5) return setNotice('Room codes have 5 characters.');
    setBusy(true);
    setNotice('');
    const channel = channelFor(joinCode);
    const client = createClient();
    const count = await occupancy(client.pubnub, channel);
    client.pubnub.destroy?.();
    setBusy(false);
    // 0 = nobody is hosting that code, 1 = the host is waiting, 2+ = already playing.
    if (count === 0) return setNotice(`No room ${joinCode} is open. Check the code, or create a room.`);
    if (count !== null && count >= 2) return setNotice(`Room ${joinCode} is full.`);
    setRoom({ code: joinCode, channel, host: false, piece: 'O' });
    setScreen('waiting');
    const c = connect(channel);
    c.pubnub.publish({ channel, message: { type: 'join', name: name.trim() } });
  };

  const play = (index) => {
    if (!room || turn !== room.piece) return;
    const next = applyMove(board, index, room.piece);
    if (!next) return;
    setBoard(next);
    publish({ type: 'move', index, piece: room.piece });
  };

  const rematch = () => { publish({ type: 'reset' }); startRound(); };
  const endGame = () => { publish({ type: 'end' }); leave(); };

  useEffect(() => () => leave(), []);  // clean up on unmount

  // ------------------------------------------------------------------ screens
  if (screen === 'lobby') {
    return (
      <View style={styles.page}>
        <StatusBar style="dark" />
        <Text style={styles.title}>Tic-Tac-Toe <Text style={styles.live}>live</Text></Text>
        <Text style={styles.sub}>Real-time multiplayer over PubNub. Open this on two devices, or two tabs.</Text>
        <TextInput style={styles.input} placeholder="Your name" value={name} onChangeText={setName} maxLength={20} autoCapitalize="words" />
        <Pressable style={[styles.btn, styles.primary]} onPress={createRoom} accessibilityRole="button">
          <Text style={styles.btnTextLight}>Create a room</Text>
        </Pressable>
        <View style={styles.or}><View style={styles.hr} /><Text style={styles.orText}>or join one</Text><View style={styles.hr} /></View>
        <View style={styles.joinRow}>
          <TextInput style={[styles.input, styles.codeInput]} placeholder="ROOM CODE" value={code}
            onChangeText={(t) => setCode(normalizeCode(t))} autoCapitalize="characters" maxLength={5} onSubmitEditing={joinRoom} />
          <Pressable style={[styles.btn, styles.secondary]} onPress={joinRoom} disabled={busy} accessibilityRole="button">
            {busy ? <ActivityIndicator /> : <Text style={styles.btnText}>Join</Text>}
          </Pressable>
        </View>
        {notice ? <Text style={styles.notice}>{notice}</Text> : null}
      </View>
    );
  }

  if (screen === 'waiting') {
    return (
      <View style={styles.page}>
        <StatusBar style="dark" />
        <ActivityIndicator size="large" color="#d02129" />
        {room?.host ? (
          <>
            <Text style={styles.sub}>Share this room code with your friend:</Text>
            <Text style={styles.bigCode} selectable>{room.code}</Text>
            <Text style={styles.sub}>Waiting for them to join…</Text>
          </>
        ) : (
          <Text style={styles.sub}>Joining room {room?.code}…</Text>
        )}
        <Pressable style={[styles.btn, styles.secondary]} onPress={() => leave()}><Text style={styles.btnText}>Cancel</Text></Pressable>
      </View>
    );
  }

  const status = result
    ? result.winner ? `${players[result.winner]} (${result.winner}) wins!` : "It's a draw."
    : turn === room.piece ? 'Your move' : `Waiting for ${players[turn]}…`;

  return (
    <View style={styles.page}>
      <StatusBar style="dark" />
      <Text style={styles.roomLabel}>Room {room.code} · you are {room.piece}</Text>
      <View style={styles.board} accessibilityRole="grid">
        {board.map((cell, i) => (
          <Pressable key={i} onPress={() => play(i)} accessibilityLabel={`square ${i + 1}${cell ? ' ' + cell : ''}`}
            style={[styles.cell, result?.line.includes(i) && styles.winCell]}>
            <Text style={[styles.mark, cell === 'X' ? styles.x : styles.o]}>{cell || ''}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.status}>{status}</Text>
      <View style={styles.scores}>
        <Text style={styles.score}>{players.X} (X) <Text style={styles.scoreN}>{scores.X}</Text></Text>
        <Text style={styles.score}>{players.O} (O) <Text style={styles.scoreN}>{scores.O}</Text></Text>
      </View>
      {result && (room.host ? (
        <View style={styles.joinRow}>
          <Pressable style={[styles.btn, styles.primary]} onPress={rematch}><Text style={styles.btnTextLight}>Play again</Text></Pressable>
          <Pressable style={[styles.btn, styles.secondary]} onPress={endGame}><Text style={styles.btnText}>End game</Text></Pressable>
        </View>
      ) : <Text style={styles.sub}>Waiting for {players.X} to start another round…</Text>)}
      {!result && <Pressable onPress={() => (room.host ? endGame() : leave())}><Text style={styles.link}>Leave room</Text></Pressable>}
    </View>
  );
}

const RED = '#d02129';
const styles = StyleSheet.create({
  page: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24, backgroundColor: '#fff' },
  title: { fontSize: 32, fontWeight: '800', color: RED },
  live: { fontSize: 14, color: '#fff', backgroundColor: RED, paddingHorizontal: 6, borderRadius: 4, overflow: 'hidden' },
  sub: { fontSize: 15, color: '#555', textAlign: 'center', maxWidth: 340 },
  input: { width: 280, borderWidth: 1, borderColor: '#ccc', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 16 },
  codeInput: { width: 170, letterSpacing: 3, fontWeight: '700', textAlign: 'center' },
  btn: { paddingVertical: 11, paddingHorizontal: 18, borderRadius: 10, alignItems: 'center', minWidth: 96 },
  primary: { backgroundColor: RED, width: 280 },
  secondary: { borderWidth: 1, borderColor: RED },
  btnText: { color: RED, fontWeight: '700', fontSize: 15 },
  btnTextLight: { color: '#fff', fontWeight: '700', fontSize: 15 },
  or: { flexDirection: 'row', alignItems: 'center', width: 280, gap: 8 },
  hr: { flex: 1, height: 1, backgroundColor: '#ddd' },
  orText: { color: '#888', fontSize: 13 },
  joinRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  notice: { color: RED, fontSize: 14, textAlign: 'center', maxWidth: 320 },
  bigCode: { fontSize: 40, fontWeight: '800', letterSpacing: 6, color: '#111', fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }) },
  roomLabel: { fontSize: 14, color: '#777' },
  board: { width: 300, height: 300, flexDirection: 'row', flexWrap: 'wrap', borderWidth: 2, borderColor: '#111', borderRadius: 8, overflow: 'hidden' },
  cell: { width: '33.333%', height: '33.333%', borderWidth: 1, borderColor: '#111', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  winCell: { backgroundColor: '#ffe3e4' },
  mark: { fontSize: 48, fontWeight: '800' },
  x: { color: RED },
  o: { color: '#1f4fd1' },
  status: { fontSize: 20, fontWeight: '700', color: '#111' },
  scores: { flexDirection: 'row', gap: 28 },
  score: { fontSize: 16, color: '#333' },
  scoreN: { fontWeight: '800', color: '#111' },
  link: { color: '#777', textDecorationLine: 'underline', marginTop: 6 },
});
