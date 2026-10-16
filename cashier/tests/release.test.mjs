import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {releaseInfo} from '../lib/release.mjs';
import {validateProduction,requireTrustedCI,gatewayPath,workerPath,fingerprint,uploadedVersion,assertActiveVersion} from '../scripts/release-tools.mjs';
import {verifyRelease,verifyWithRetry,PrivateDataExposed} from '../scripts/verify-release.mjs';
const sha='a'.repeat(40),gatewayHash='b'.repeat(64);
function transport({denied=401,revision=sha,assetRevision=sha,gateway=gatewayHash,shortcut='https://cashier.tlpt.org/',extraPrivate=false}={}){
 return async(url,options={})=>{
  const path=new URL(url).pathname,headers={'Cache-Control':'private, no-store','X-TLPT-Gateway-Source':gateway};
  if(path==='/api/version')return Response.json({app:'tlpt-cashier',revision,versionId:'deployed-version-id'},{headers});
  if(path==='/release.json')return Response.json({app:'tlpt-cashier',revision:assetRevision});
  if(path.startsWith('/api/'))return Response.json(extraPrivate?{error:'Denied',payments:[]}:{error:'Denied'},{status:denied,headers});
  if(path==='/cashier.html')return new Response(`<meta http-equiv="refresh" content="0; url=${shortcut}"><a href="${shortcut}">Open</a>`);
  return new Response('<form method="post" action="/auth/login"></form>');
 };
}
test('release metadata is public build identity only, never private configuration',()=>{
 assert.deepEqual(releaseInfo({RELEASE_SHA:sha,CASHIER_VERSION:{id:'version'},OWNER_EMAIL:'private',IMPORT_TOKEN:'secret',SESSION_SECRET:'secret'}),{app:'tlpt-cashier',revision:sha,versionId:'version'});
});
test('activation selects only the exact commit version and requires all traffic on that version',()=>{
 const expected={id:'new-version',annotations:{'workers/tag':sha}};
 assert.equal(uploadedVersion([{id:'wrong-version',annotations:{'workers/tag':'other'}},expected],sha),expected);
 assert.throws(()=>uploadedVersion([{id:'wrong-version'}],sha));
 assert.doesNotThrow(()=>assertActiveVersion({versions:[{version_id:'new-version',percentage:100}]},'new-version'));
 for(const versions of [[{version_id:'old-version',percentage:100}],[{version_id:'new-version',percentage:50}],[{version_id:'new-version',percentage:100},{version_id:'old-version',percentage:0}]])assert.throws(()=>assertActiveVersion({versions},'new-version'));
});
test('source fingerprints use repository-root paths from the cashier working directory and separate app from gateway changes',()=>{
 const root=mkdtempSync(join(tmpdir(),'cashier-release-git-'));
 const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
 const commit=()=>{git('add','.');git('-c','user.name=Test','-c','user.email=test@example.invalid','commit','-qm','fixture');return git('rev-parse','HEAD');};
 try{
  git('init','-q','-b','main');mkdirSync(join(root,'cashier/domain-gateway'),{recursive:true});
  writeFileSync(join(root,'cashier/worker.ts'),'first app');writeFileSync(join(root,'cashier/domain-gateway/_worker.js'),'first gateway');
  const first=commit();writeFileSync(join(root,'cashier/worker.ts'),'second app');const second=commit();
  assert.notEqual(fingerprint(first,workerPath,root),fingerprint(second,workerPath,root));
  assert.equal(fingerprint(first,gatewayPath,root),fingerprint(second,gatewayPath,root));
  writeFileSync(join(root,'cashier/domain-gateway/_worker.js'),'second gateway');const third=commit();
  assert.equal(fingerprint(second,workerPath,root),fingerprint(third,workerPath,root));
  assert.notEqual(fingerprint(second,gatewayPath,root),fingerprint(third,gatewayPath,root));
  assert.throws(()=>fingerprint(third,()=>false,root),/no source files/);
 }finally{rmSync(root,{recursive:true,force:true});}
});
test('production validation rejects staging, another database, credential overrides and route changes',()=>{
 const config=JSON.parse(readFileSync(new URL('../wrangler.production.jsonc',import.meta.url)));
 assert.equal(validateProduction(config),config);
 for(const mutate of [c=>c.name='tlpt-cashier-test',c=>c.d1_databases[0].database_id='other',c=>c.vars.AUTH_MODE='access',c=>c.vars.SESSION_SECRET='replacement',c=>c.routes=['*'],c=>c.vars.LOCAL_OWNER_EMAIL='owner']){
  const changed=structuredClone(config);mutate(changed);assert.throws(()=>validateProduction(changed));
 }
});
test('publishing rejects pull requests, forks, feature branches and non-Actions execution',()=>{
 const trusted={GITHUB_ACTIONS:'true',GITHUB_REPOSITORY:'bostnmike/TLPT-poker',GITHUB_REF:'refs/heads/main',GITHUB_EVENT_NAME:'push'};
 assert.doesNotThrow(()=>requireTrustedCI(trusted));
 for(const change of [{GITHUB_EVENT_NAME:'pull_request'},{GITHUB_REPOSITORY:'fork/repo'},{GITHUB_REF:'refs/heads/feature'},{GITHUB_ACTIONS:'false'}])assert.throws(()=>requireTrustedCI({...trusted,...change}));
 assert.equal(gatewayPath('cashier/app/page.tsx'),false);assert.equal(gatewayPath('cashier/domain-gateway/_worker.js'),true);assert.equal(gatewayPath('cashier/wrangler.gateway.jsonc'),true);assert.equal(workerPath('lily-site/index.html'),false);assert.equal(workerPath('marchand-vault/index.html'),false);
});
test('live verification requires matching Worker, interface, gateway, shortcut and denied private endpoints',async()=>{
 const result=await verifyRelease({revision:sha,gatewayHash,fetchImpl:transport()});assert.equal(result.anonymousChecks,7);assert.equal(result.revision,sha);
 for(const options of [{revision:'c'.repeat(40)},{assetRevision:'c'.repeat(40)},{gateway:'wrong'},{shortcut:'https://old.example/'}])await assert.rejects(verifyRelease({revision:sha,gatewayHash,fetchImpl:transport(options)}));
});
test('an anonymous leak fails immediately and is never hidden by retries',async()=>{
 let sleeps=0;
 await assert.rejects(verifyWithRetry({revision:sha,gatewayHash,fetchImpl:transport({denied:200})},{sleep:async()=>{sleeps++;},timeoutMs:100}),PrivateDataExposed);assert.equal(sleeps,0);
 await assert.rejects(verifyRelease({revision:sha,gatewayHash,fetchImpl:transport({extraPrivate:true})}),PrivateDataExposed);
});
test('gateway release fingerprint preserves password cookies and denied response headers',async()=>{
 const {default:gateway}=await import('../domain-gateway/_worker.js');
 const r=await gateway.fetch(new Request('https://cashier.tlpt.org/'),{GATEWAY_SOURCE_HASH:gatewayHash,CASHIER:{fetch:async()=>new Response(null,{status:303,headers:{Location:'/','Set-Cookie':'private-session','Cache-Control':'private, no-store'}})}});
 assert.equal(r.headers.get('X-TLPT-Gateway-Source'),gatewayHash);assert.equal(r.headers.get('Set-Cookie'),'private-session');assert.equal(r.status,303);
});
