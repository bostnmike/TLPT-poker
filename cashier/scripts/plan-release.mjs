import {appendFileSync} from 'node:fs';
import {git,fingerprint,gatewayPath,workerPath,shaPattern,ORIGIN,requireTrustedCI,receipt} from './release-tools.mjs';
requireTrustedCI();
const sha=process.env.GITHUB_SHA;
if(!shaPattern.test(sha||''))throw Error('Missing release SHA.');
const current=git('rev-parse','origin/main');
if(fingerprint(sha,workerPath)!==fingerprint(current,workerPath)||fingerprint(sha,gatewayPath)!==fingerprint(current,gatewayPath))throw Error('A newer Cashier change is already on main. Publish the newer run instead of this stale checkout.');
let live,liveGateway;
try{
 const r=await fetch(ORIGIN+'/api/version',{headers:{'Cache-Control':'no-cache'},signal:AbortSignal.timeout(15000)});
 liveGateway=r.headers.get('X-TLPT-Gateway-Source');
 if(r.ok){const value=await r.json();if(value.app==='tlpt-cashier'&&shaPattern.test(value.revision))live=value;}
}catch{console.warn('Live build marker unavailable; using the push baseline for recovery.');}
const before=process.env.BEFORE_SHA;
const fallback=shaPattern.test(before||'')&&!/^0+$/.test(before)?before:git('rev-parse',sha+'^');
const workerBase=live?.revision||fallback;
const gatewayHash=fingerprint(sha,gatewayPath);
const worker=process.env.GITHUB_EVENT_NAME==='workflow_dispatch'||fingerprint(sha,workerPath)!==fingerprint(workerBase,workerPath);
const gateway=liveGateway?gatewayHash!==liveGateway:gatewayHash!==fingerprint(fallback,gatewayPath);
const plan={sha,worker,gateway,gatewayHash,expectedRevision:worker?sha:live?.revision};
if(!plan.expectedRevision)throw Error('No verifiable deployed revision. Run the workflow manually on main to publish the Worker.');
receipt({plan,startedAt:new Date().toISOString()});
if(process.env.GITHUB_OUTPUT)appendFileSync(process.env.GITHUB_OUTPUT,`worker=${worker}\ngateway=${gateway}\nrevision=${plan.expectedRevision}\ngateway_hash=${gatewayHash}\n`);
console.log(JSON.stringify(plan));
