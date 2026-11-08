import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {requirePinnedRelease,requireCheckedInputs,inspectReleaseCheckout,RELEASE_INPUTS,RSVP_DATABASE} from '../scripts/lib/release-policy.mjs';
const config=JSON.parse(readFileSync(new URL('../wrangler.jsonc',import.meta.url),'utf8'));
const head='a'.repeat(40),main='b'.repeat(40);
test('release requires the exact RSVP database/account/entry point and current Free confirmation',()=>{
  assert.doesNotThrow(()=>requirePinnedRelease(config,'1'));
  for(const flag of [undefined,'0',true])assert.throws(()=>requirePinnedRelease(config,flag),/Free/);
  for(const id of ['', '00000000-0000-4000-8000-000000000000','9165ae68-16fa-4ce2-9b87-77019e52ef20','00000000-0000-4000-8000-000000000099']){
    const changed=structuredClone(config);changed.d1_databases[0].database_id=id;assert.throws(()=>requirePinnedRelease(changed,'1'),/exact existing/);
  }
  assert.equal(config.d1_databases[0].database_id,RSVP_DATABASE);
  for(const mutate of [value=>value.d1_databases.push({...value.d1_databases[0]}),value=>value.account_id='other',value=>value.name='other',value=>value.main='../other.mjs',value=>value.assets.directory='../other']){
    const changed=structuredClone(config);mutate(changed);assert.throws(()=>requirePinnedRelease(changed,'1'),/exact existing/);
  }
});
test('dirty or stale protected inputs and a branch switch during checks refuse publication',()=>{
  const base={revision:head,mainRevision:main};assert.doesNotThrow(()=>requireCheckedInputs(base));
  assert.throws(()=>requireCheckedInputs({...base,dirty:' M rsvp/public/app.js'}),/Commit or discard/);
  for(const changed of ['cashier/lib/event-closeout.mjs\n','rsvp/worker.mjs\n'])assert.throws(()=>requireCheckedInputs({...base,changed}),/differ from freshly fetched main/);
  assert.throws(()=>requireCheckedInputs({...base,revision:'invalid'}),/could not be verified/);
  assert.throws(()=>requireCheckedInputs({...base,expectedRevision:main}),/checkout changed/);
});
test('checkout verification checks dirtiness before fetching and includes actual shared contract inputs',()=>{
  let calls=[];assert.throws(()=>inspectReleaseCheckout(args=>{calls.push(args);return ' M rsvp/worker.mjs';}),/Commit or discard/);assert.equal(calls.length,1);
  calls=[];const git=args=>{calls.push(args);if(args[0]==='rev-parse')return args[1]==='HEAD'?head:main;return '';};
  assert.equal(inspectReleaseCheckout(git),head);assert.deepEqual(calls[1],['fetch','--no-tags','origin','refs/heads/main:refs/remotes/origin/main']);
  for(const path of ['cashier/lib','cashier/drizzle','cashier/package.json','cashier/pnpm-lock.yaml','scripts/test-app-feed-contract.mjs','rsvp'])assert.ok(RELEASE_INPUTS.includes(path));
  assert.ok(calls.at(-1).includes(main));assert.ok(!RELEASE_INPUTS.includes('site-src'));assert.ok(!RELEASE_INPUTS.includes('cashier/app'));
  let statuses=0;assert.throws(()=>inspectReleaseCheckout(args=>{
    if(args[0]==='status')return ++statuses===1?'':' M cashier/pnpm-lock.yaml';
    return args[0]==='rev-parse'?head:'';
  }),/Commit or discard/);
  assert.throws(()=>inspectReleaseCheckout(args=>args[0]==='rev-parse'?head:args[0]==='diff'?'scripts/test-app-feed-contract.mjs':''),/differ from freshly fetched main/);
});
test('a failed main refresh cannot be treated as checked current source',()=>{
  assert.throws(()=>inspectReleaseCheckout(args=>{if(args[0]==='fetch')throw Error('Offline');return '';}),/Offline/);
});
