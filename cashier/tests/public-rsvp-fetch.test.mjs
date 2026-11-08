import {test} from 'node:test';
import assert from 'node:assert/strict';
import {publicRsvpFetch} from '../lib/public-rsvp-fetch.mjs';
import {LIVE_RSVP_URL} from '../lib/live-rsvp.mjs';
test('bound RSVP lookup forwards only the exact public GET without browser credentials',async()=>{
 const calls=[],fallback=[];
 const lookup=publicRsvpFetch({fetch:async request=>{calls.push(request);return Response.json({schemaVersion:1});}},async(url,init)=>{fallback.push({url,init});return new Response(null,{status:403});});
 assert.equal((await lookup(LIVE_RSVP_URL,{headers:{Cookie:'private','X-Register-Token':'private'}})).status,200);
 assert.equal(calls[0].url,LIVE_RSVP_URL);assert.equal(calls[0].method,'GET');assert.deepEqual([...calls[0].headers.entries()],[['accept','application/json']]);
 await lookup(LIVE_RSVP_URL,{method:'POST'});await lookup('https://tlpt-rsvp.tlpt-bostnmike.workers.dev/api/backup');assert.equal(calls.length,1);assert.equal(fallback.length,2);
});
test('local and staging callers retain public transport without a production binding',async()=>{
 let used=false;const lookup=publicRsvpFetch(undefined,async()=>{used=true;return new Response('local');});assert.equal(await(await lookup(LIVE_RSVP_URL)).text(),'local');assert.equal(used,true);
});
