# Multiplayer Tic-Tac-Toe (React Native + PubNub)

Two-player Tic-Tac-Toe for Android and iOS. One player creates a room, the other joins with the room code, and every move is published over **PubNub** so both boards stay in sync in real time.

<img src="./media/android-ios-game.png" alt="Android and iOS screenshots of the game" width="410" height="410" />

## How it works

- **Lobby** (`App.js`, `src/components/Lobby.js`): the creator gets a 5-character room ID (`shortid`) and plays X. Player names are announced on a shared `gameLobby` channel.
- **Joining:** before subscribing, the joiner checks the room channel's occupancy with PubNub `hereNow`. An empty room means "create one first", and more than 2 players means "room full".
- **Moves:** each game uses its own channel (`tictactoe--<roomId>`). A move is published as `{ piece, row, col, turn }`, and the opponent's client applies it to its own board.
- **Game** (`src/components/Game.js`): turn handling, win detection across the 8 lines, draws and a running X/O score. The room creator decides on a rematch (`reset`) or ends the game (`gameOver`).

## Status: legacy (2019)

Built with **React Native 0.59** and React 16.8. The code is kept as it was written. Modern Android/iOS and Node toolchains **won't build RN 0.59 as-is**. Running it today means upgrading React Native (or porting to Expo), which hasn't been done.

## Running it (on a 2019-era toolchain)

1. Create a free PubNub app and copy its keys.
2. In `App.js`, replace `ENTER_YOUR_PUBLISH_KEY_HERE` and `ENTER_YOUR_SUBSCRIBE_KEY_HERE`.
3. `npm install`, then `react-native run-android` or `react-native run-ios`.

Never commit real PubNub keys. For anything beyond local testing, load them from config that isn't in git.
