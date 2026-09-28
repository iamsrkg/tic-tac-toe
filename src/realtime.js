// PubNub pub/sub: one channel per room carries join, start, move, reset and end messages;
// presence tells us who is in the room.
import PubNub from 'pubnub';

// PubNub's public "demo" keyset works out of the box. For your own app, set
// EXPO_PUBLIC_PUBNUB_PUBLISH_KEY / EXPO_PUBLIC_PUBNUB_SUBSCRIBE_KEY (free at pubnub.com).
const publishKey = process.env.EXPO_PUBLIC_PUBNUB_PUBLISH_KEY || 'demo';
const subscribeKey = process.env.EXPO_PUBLIC_PUBNUB_SUBSCRIBE_KEY || 'demo';

export const channelFor = (code) => `iamsrkg-tictactoe.${code}`;

export function createClient() {
  const userId = `player-${Math.random().toString(36).slice(2, 10)}`;
  const pubnub = new PubNub({ publishKey, subscribeKey, userId, presenceTimeout: 20 });
  return { pubnub, userId };
}

/** How many players are in a room right now (null if presence isn't available). */
export async function occupancy(pubnub, channel) {
  try {
    const res = await pubnub.hereNow({ channels: [channel], includeUUIDs: false });
    return res.totalOccupancy;
  } catch {
    return null;
  }
}
