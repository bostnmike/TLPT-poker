import {readFileSync,writeFileSync,readdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {boundedCommand,managedCommand,localEnvironment} from './lib/local-harness.mjs';
import {requirePinnedRelease,inspectReleaseCheckout} from './lib/release-policy.mjs';
import {releaseSnapshot} from './lib/release-snapshot.mjs';
process.chdir(fileURLToPath(new URL('..',import.meta.url)));
const options=process.argv.slice(2);
if(options.some(option=>option!=='--check-only'))throw Error('Use deploy.mjs or deploy.mjs --check-only.');
const config=JSON.parse(readFileSync('wrangler.jsonc','utf8'));
requirePinnedRelease(config,process.env.RSVP_FREE_PLAN_CONFIRMED);
const pinned=JSON.parse(readFileSync('package.json','utf8')).devDependencies.wrangler;
if(JSON.parse(readFileSync('node_modules/wrangler/package.json','utf8')).version!==pinned)throw Error('Install the locked RSVP tooling before releasing.');
const env={...process.env,WRANGLER_SEND_METRICS:'false',WRANGLER_WRITE_LOGS:'false'};
const git=args=>boundedCommand('git',['-C',resolve('..'),...args],{env,timeoutMs:60000});
const revision=inspectReleaseCheckout(git),testEnv=localEnvironment(env);
// Alternate checkouts/previews are useful for coordination, never release proof.
delete testEnv.CASHIER_CLOSEOUT_FIXTURE_ROOT;delete testEnv.CLOSEOUT_PREVIEW;
const checks=[
 {name:'unit tests',args:['--test',...readdirSync('tests').filter(file=>file.endsWith('.test.mjs')).map(file=>'tests/'+file)],timeout:120000},
 {name:'actual local Worker/D1 integration',args:['scripts/test-integration.mjs'],timeout:180000},
 {name:'actual two-app Worker/D1/RPC integration',args:['scripts/test-closeout-integration.mjs'],timeout:180000}
];
for(const check of checks){await managedCommand(process.execPath,check.args,{env:testEnv,timeoutMs:check.timeout});console.log('PASS: '+check.name);}
inspectReleaseCheckout(git,revision);
if(options.includes('--check-only')){
 console.log('PASS: exact resource pin, clean/current inputs and strict local release checks. Nothing published.');
}else{
 const snapshot=releaseSnapshot(resolve('..'),revision);
 try{
  const captured=JSON.parse(readFileSync(resolve(snapshot.root,'wrangler.jsonc'),'utf8'));requirePinnedRelease(captured,process.env.RSVP_FREE_PLAN_CONFIRMED);
  captured.vars.REVISION=revision;const releaseConfig=resolve(snapshot.root,'deploy.local.json');writeFileSync(releaseConfig,JSON.stringify(captured));
  console.log(await managedCommand(process.execPath,[resolve('node_modules/wrangler/bin/wrangler.js'),'deploy','--config',releaseConfig],{env,timeoutMs:180000}));
  console.log(await managedCommand(process.execPath,[resolve(snapshot.root,'scripts/verify-release.mjs')],{env:{...env,EXPECTED_REVISION:revision},timeoutMs:60000}));
 }finally{snapshot.cleanup();}
}
