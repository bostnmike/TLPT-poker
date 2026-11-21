export const PLAYER_DIRECTORY = 'https://tlpt.org/data/player-metadata.json';
const CACHE_MS = 300000;
const RETRY_MS = 30000;
const MAX_BYTES = 100000;
const imagePath = value => typeof value === 'string' &&
  /^images\/players\/[a-zA-Z0-9][a-zA-Z0-9_-]*\.(?:jpg|jpeg|png|webp|avif)$/.test(value) ? value : null;

export function parseAvatars(directory) {
  if (!Array.isArray(directory?.players) || !directory.players.length || directory.players.length > 500) {
    throw Error('Player directory unavailable.');
  }
  const avatars = new Map();
  for (const player of directory.players) {
    const image = imagePath(player?.image);
    if (!image || typeof player.slug !== 'string' || !/^[a-z0-9-]{1,80}$/.test(player.slug)) continue;
    if (avatars.has(player.slug)) throw Error('Duplicate player avatar.');
    avatars.set(player.slug, image);
  }
  if (!avatars.size) throw Error('No valid player avatars.');
  return avatars;
}

export function withPlayerAvatars(state, avatars) {
  return {...state, players:state.players.map(player => ({
    ...player, image:avatars.get(player.slug) || player.image
  }))};
}

export function createAvatarLoader(fetcher = fetch, now = Date.now, timeoutMs = 2500) {
  let avatars = new Map(), expires = 0, pending;
  return async () => {
    if (now() < expires) return avatars;
    if (pending) return pending;
    pending = (async () => {
      const controller = new AbortController();
      let timer, reader;
      const deadline = new Promise((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(Error('Player directory timed out.'));
        }, timeoutMs);
      });
      try {
        const load = (async () => {
          const response = await fetcher(PLAYER_DIRECTORY, {
            signal:controller.signal, redirect:'manual', cache:'no-store'
          });
          if (!response.ok || !response.body) throw Error('Player directory unavailable.');
          reader = response.body.getReader();
          const decoder = new TextDecoder();
          let text = '', bytes = 0;
          while (true) {
            const {done, value} = await reader.read();
            if (done) break;
            bytes += value.byteLength;
            if (bytes > MAX_BYTES) throw Error('Player directory too large.');
            text += decoder.decode(value, {stream:true});
          }
          return parseAvatars(JSON.parse(text + decoder.decode()));
        })();
        avatars = await Promise.race([load, deadline]);
        expires = now() + CACHE_MS;
      } catch {
        controller.abort();
        expires = now() + RETRY_MS;
        // The last valid mapping remains usable during a directory outage.
        void reader?.cancel().catch(() => {});
      } finally {
        clearTimeout(timer);
      }
      return avatars;
    })().finally(() => { pending = null; });
    return pending;
  };
}

const loaders = new WeakMap();
export function playerAvatars(fetcher = fetch) {
  if (!loaders.has(fetcher)) loaders.set(fetcher, createAvatarLoader(fetcher));
  return loaders.get(fetcher)();
}
