import assert from 'node:assert/strict';
const base='https://tlpt-rsvp.tlpt-bostnmike.workers.dev';
const version=await (await fetch(base+'/api/version',{cache:'no-store'})).json();
assert.equal(version.app,'tlpt-rsvp');if(process.env.EXPECTED_REVISION)assert.equal(version.revision,process.env.EXPECTED_REVISION);
const response=await fetch(base+'/api/public/events',{cache:'no-store'}),feed=await response.json();assert.equal(response.status,200);assert.equal(feed.schemaVersion,1);assert.ok(Array.isArray(feed.events));
for(const word of ['linkHash','adminHash','generation','session','audit','venmo','email','phone'])assert.ok(!JSON.stringify(feed).toLowerCase().includes(word.toLowerCase()),'Public feed contains forbidden field: '+word);
for(const e of feed.events){assert.ok(e.id&&e.date);assert.ok(Object.values(e.rsvps).filter(a=>a==='yes').length<=e.capacity);assert.ok(e.waitlist.every(w=>e.rsvps[w.slug]!=='yes'));}
for(const path of ['me','backup']){const r=await fetch(base+'/api/'+path,{headers:{'X-Admin':'true','X-Player':'bostnmike'}});assert.equal(r.status,401);assert.equal(r.headers.get('Cache-Control'),'private, no-store');assert.deepEqual(Object.keys(await r.json()),['error']);}
const denied=await fetch(base+'/api/action',{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify({type:'respond',eventId:feed.events[0]?.id,answer:'yes',slug:'bostnmike'})});assert.equal(denied.status,401);
const forged=await fetch(base+'/api/exchange',{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify({key:'f'.repeat(64)})});assert.equal(forged.status,401);
assert.equal((await fetch(base+'/')).status,200);console.log('PASS: RSVP public release revision, feed privacy, capacity, anonymous write/data denials and invalid link denial.');
