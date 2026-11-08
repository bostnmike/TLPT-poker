import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {existsSync} from 'node:fs';
import {createIntegrationRun,stopChild} from '../scripts/integration-runtime.mjs';
test('test configuration rejects production entrypoints/DBs and cleans isolated files',async()=>{
 const run=createIntegrationRun('guards');
 try{
  assert.throws(()=>run.config('production',{main:'worker.ts'}));
  assert.throws(()=>run.config('database',{main:'tests/fixtures/integration-worker.ts',d1_databases:[{database_id:'9165ae68-16fa-4ce2-9b87-77019e52ef20'}]}));
  assert.throws(()=>run.migrate('unused','/outside/run'));
 }finally{await run.cleanup();}assert.equal(existsSync(run.directory),false);
});
test('cleanup handles an already-exited child and escalates a child ignoring SIGTERM',async()=>{
 const exited=spawn(process.execPath,['-e','process.exit(0)']);await once(exited,'exit');await stopChild(exited,200);
 const stubborn=spawn(process.execPath,['-e',"process.on('SIGTERM',()=>{});process.stdout.write('ready');setInterval(()=>{},1000)"],{stdio:['ignore','pipe','pipe']});
 await once(stubborn.stdout,'data');await stopChild(stubborn,200);assert.equal(stubborn.signalCode,'SIGKILL');
});
