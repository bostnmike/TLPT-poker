import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';

export function assetReference(name) {
  const hash=createHash('sha256').update(readFileSync(new URL('../'+name,import.meta.url))).digest('hex').slice(0,16);
  return `${name}?v=${hash}`;
}

export function assertAssetReference(html, name) {
  assert.ok(html.includes(assetReference(name)), `${name}: reference must match the file's content hash`);
}
