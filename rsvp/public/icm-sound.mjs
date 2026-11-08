// Same locally served Rounders clip used by Cashier. Unlock within a user tap
// before decoding, including the silent-source path used for iPhone/iPad Safari.
export const ICM_AUDIO = '/assets/pay-that-man-his-money.m4a';
export function createIcmSound({createContext, fetchAudio = async () => {
  const response = await fetch(ICM_AUDIO);
  if (!response.ok) throw Error('Audio unavailable');
  return response.arrayBuffer();
}, onStatus = () => {}}) {
  let context, decoded, current, disposed = false;
  const getContext = () => context || (context = createContext());
  function buffer(ctx) {
    return decoded || (decoded = Promise.resolve().then(fetchAudio).then(bytes => ctx.decodeAudioData(bytes)).catch(error => { decoded = null; throw error; }));
  }
  function stop() { if (current) { try { current.stop(); current.disconnect(); } catch {} current = null; } }
  function prepare() {
    if (disposed) return;
    try {
      const ctx = getContext(); void ctx.resume().catch(() => {});
      const silent = ctx.createBufferSource(); silent.buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
      silent.connect(ctx.destination); silent.onended = () => silent.disconnect(); silent.start();
      void buffer(ctx).catch(() => {});
    } catch {}
  }
  async function play() {
    if (disposed) return false;
    try {
      const ctx = getContext(); await ctx.resume(); const audio = await buffer(ctx);
      if (disposed) return false;
      if (ctx.state !== 'running') throw Error('Audio blocked');
      stop(); const source = ctx.createBufferSource(); source.buffer = audio; source.connect(ctx.destination);
      source.onended = () => { source.disconnect(); if (current === source) { current = null; onStatus(''); } };
      current = source; source.start(); onStatus('“Pay that man his money.”'); return true;
    } catch { if (!disposed) onStatus('Sound couldn’t play. Tap Replay sound and check your volume.'); return false; }
  }
  return {prepare, play, dispose() { disposed = true; stop(); if (context) void context.close().catch(() => {}); }};
}
