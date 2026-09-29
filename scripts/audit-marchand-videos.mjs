// Live audit: node scripts/audit-marchand-videos.mjs [report.json]
// Does not change catalog data or download video files.
import fs from 'node:fs/promises';
const payload = JSON.parse(await fs.readFile(new URL('../data/marchand-pucks.json', import.meta.url)));
const groups = new Map();
for (const record of payload.records.filter(r => r.videoId)) {
  const key = `${record.videoProvider}:${record.videoId}`;
  if (!groups.has(key)) groups.set(key, { provider: record.videoProvider, id: record.videoId, url: record.videoUrl, artifacts: [] });
  groups.get(key).artifacts.push(record.inventoryId);
}
async function request(url, options = {}) {
  return fetch(url, { ...options, signal: AbortSignal.timeout(30000) });
}
function readJsonObject(text, start) {
  let depth = 0, quoted = false, escape = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (escape) escape = false;
      else if (c === '\\') escape = true;
      else if (c === '"') quoted = false;
    } else if (c === '"') quoted = true;
    else if (c === '{') depth++;
    else if (c === '}' && --depth === 0) return JSON.parse(text.slice(start, i + 1));
  }
  throw new Error('Incomplete public playback metadata');
}
const configResponse = await request('https://players.brightcove.net/6415718365001/default_default/config.json');
if (!configResponse.ok) throw new Error(`NHL player configuration: HTTP ${configResponse.status}`);
const config = await configResponse.json();
const rows = [...groups.values()];
let cursor = 0;
await Promise.all(Array.from({ length: 3 }, async () => {
  while (cursor < rows.length) {
    const row = rows[cursor++];
    try {
      if (row.provider === 'nhl') {
        const res = await request(`https://edge.api.brightcove.com/playback/v1/accounts/6415718365001/videos/${row.id}`, {
          headers: { Accept: `application/json;pk=${config.video_cloud.policy_key}` }
        });
        const data = await res.json();
        if (!res.ok) throw new Error(`NHL playback HTTP ${res.status}: ${JSON.stringify(data)}`);
        if (data.id !== row.id) throw new Error('Playback returned a different clip');
        row.title = data.name;
        const source = data.sources?.find(s => /mpegurl/i.test(s.type || '') && s.src?.startsWith('https://'));
        if (!source) throw new Error('No secure HLS stream');
        let url = source.src;
        // Follow the master and media playlist, then check a media segment.
        for (let level = 0; level < 3; level++) {
          const stream = await request(url);
          const text = await stream.text();
          if (!stream.ok || !text.startsWith('#EXTM3U')) throw new Error(`Invalid HLS playlist: HTTP ${stream.status}`);
          const first = text.split(/\r?\n/).find(line => line.trim() && !line.startsWith('#'));
          if (!first) throw new Error('Empty HLS playlist');
          const next = new URL(first, url).href;
          if (text.includes('#EXTINF:')) {
            const segment = await request(next, { method: 'HEAD' });
            if (!segment.ok) throw new Error(`Media segment: HTTP ${segment.status}`);
            row.mediaStatus = segment.status;
            break;
          }
          url = next;
        }
        if (!row.mediaStatus) throw new Error('Media playlist not reached');
        row.method = 'Public embedded-player policy, HLS master/media playlists and media segment';
      } else if (row.provider === 'youtube') {
        const res = await request(row.url);
        if (!res.ok) throw new Error(`YouTube HTTP ${res.status}`);
        const text = await res.text(), marker = 'var ytInitialPlayerResponse = ', start = text.indexOf(marker);
        if (start < 0) throw new Error('Public playback metadata unavailable; browser review required');
        const data = readJsonObject(text, start + marker.length);
        row.title = data.videoDetails?.title;
        if (data.videoDetails?.videoId !== row.id) throw new Error('Playback returned a different clip');
        row.playbackStatus = data.playabilityStatus?.status;
        row.embeddingAllowed = data.playabilityStatus?.playableInEmbed === true;
        if (row.playbackStatus !== 'OK' || !row.embeddingAllowed) throw new Error(JSON.stringify(data.playabilityStatus));
        row.method = 'Public playback status and explicit playableInEmbed permission';
      } else throw new Error('Unsupported provider');
      row.status = 'pass';
    } catch (error) { row.status = 'review'; row.error = error.message; }
    console.log(`${row.status.toUpperCase()} ${row.provider} ${row.id} — artifacts ${row.artifacts.join(', ')}`);
  }
}));
const report = {
  checkedAt: new Date().toISOString(), artifacts: payload.records.length,
  withVideo: payload.records.filter(r => r.videoId).length, uniqueVideos: rows.length,
  missingVideo: payload.records.filter(r => !r.videoId).map(r => ({ artifact: r.inventoryId, key: r.key, notes: r.notes })),
  passed: rows.filter(r => r.status === 'pass').length,
  needsReview: rows.filter(r => r.status !== 'pass').length,
  limitation: 'Point-in-time provider checks, not a full viewing of every clip. Region, browser and future provider changes can affect playback. Confirm replacements inside the live page.',
  videos: rows
};
if (process.argv[2]) await fs.writeFile(process.argv[2], JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ uniqueVideos: report.uniqueVideos, passed: report.passed, needsReview: report.needsReview, missingVideo: report.missingVideo.map(r => r.artifact) }));
if (report.needsReview) process.exitCode = 1;
