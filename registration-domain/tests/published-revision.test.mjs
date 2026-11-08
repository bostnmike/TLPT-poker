import assert from 'node:assert/strict';
import {test} from 'node:test';
import {matchesPublishedRevision} from '../published-revision.mjs';
import {matchesPublishedContent} from '../published-content.mjs';
const expected = 'a'.repeat(40), newer = 'b'.repeat(40);
const ahead = {status:'ahead', behind_by:0, ahead_by:1, merge_base_commit:{sha:expected}};
test('exact marker needs no network lookup', async () => {
  assert.equal(await matchesPublishedRevision(expected+'\n', expected, () => {throw Error('Unused');}), true);
});
test('a proven descendant marker is accepted only alongside unchanged content', async () => {
  assert.equal(await matchesPublishedRevision(newer+'\n', expected, async (base, head) => {
    assert.equal(base, expected); assert.equal(head, newer); return ahead;
  }), true);
  assert.equal(matchesPublishedContent('changed form', 'expected form'), false);
  assert.equal(matchesPublishedContent('changed script', 'expected script'), false);
});
test('older, diverged, unproven and malformed markers fail closed', async () => {
  for (const comparison of [{...ahead,status:'behind'}, {...ahead,status:'diverged'},
    {...ahead,behind_by:1}, {...ahead,ahead_by:0}, {...ahead,merge_base_commit:{sha:newer}}, {}]) {
    assert.equal(await matchesPublishedRevision(newer+'\n', expected, async () => comparison), false);
  }
  for (const actual of [newer, newer+'\n\n', 'main\n', 'no marker', '']) {
    assert.equal(await matchesPublishedRevision(actual, expected, async () => ahead), false);
  }
  assert.equal(await matchesPublishedRevision(newer+'\n', expected, async () => {throw Error('Unavailable');}), false);
});
