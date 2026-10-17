import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync,spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {releaseInfo} from '../lib/release.mjs';
import {validateProduction,requireTrustedCI,gatewayPath,workerPath,fingerprint,uploadedVersion,assertActiveVersion,gatewayReleaseConfig} from '../scripts/release-tools.mjs';
import {verifyRelease,verifyWithRetry,PrivateDataExposed} from '../scripts/verify-release.mjs';
const sha='a'.repeat(40),gatewayHash='b'.repeat(64);
function transport({denied=401,revision=sha,versionId='deployed-version-id',assetRevision=sha,gateway=gatewayHash,shortcut='https://cashier.tlpt.org/',extraPrivate=false}={}){
 return async(url,options={})=>{
  const path=new URL(url).pathname,headers={'Cache-Control':'private, no-store','X-TLPT-Gateway-Source':gateway};
  if(path==='/api/version')return Response.json({app:'tlpt-cashier',revision,versionId},{headers});
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
test('isolated Pages configuration keeps absolute assets, the production binding and exact fingerprint',()=>{
 const source=JSON.parse(readFileSync(new URL('../wrangler.gateway.jsonc',import.meta.url)));
 const result=gatewayReleaseConfig(source,gatewayHash,'/checkout/cashier');
 assert.equal(result.pages_build_output_dir,'/checkout/cashier/domain-gateway');
 assert.deepEqual(result.services,source.services);
 assert.deepEqual(result.vars,{GATEWAY_SOURCE_HASH:gatewayHash});
 assert.equal(result.$schema,undefined);
 assert.equal(result.account_id,undefined);
 assert.throws(()=>gatewayReleaseConfig({...source,pages_build_output_dir:'../other'},gatewayHash,'/checkout/cashier'));
 assert.throws(()=>gatewayReleaseConfig({...source,services:[{binding:'CASHIER',service:'tlpt-cashier-test'}]},gatewayHash,'/checkout/cashier'));
 assert.throws(()=>gatewayReleaseConfig(source,'invalid','/checkout/cashier'));
});
test('pinned Wrangler discovers and validates the generated Pages config without credentials or deployment',()=>{
 const directory=mkdtempSync(join(tmpdir(),'cashier-pages-config-'));
 const source=JSON.parse(readFileSync(new URL('../wrangler.gateway.jsonc',import.meta.url)));
 const config=gatewayReleaseConfig(source,gatewayHash,fileURLToPath(new URL('..',import.meta.url)));
 const cli=fileURLToPath(new URL('../node_modules/wrangler/bin/wrangler.js',import.meta.url));
 const outfile=join(directory,'build-env.json');
 const validate=()=>spawnSync(process.execPath,[cli,'pages','functions','build-env',directory,'--outfile',outfile],{cwd:directory,encoding:'utf8',env:{...process.env,WRANGLER_SEND_METRICS:'false',WRANGLER_WRITE_LOGS:'false',PAGES_ENVIRONMENT:'production'}});
 try{
  writeFileSync(join(directory,'wrangler.json'),JSON.stringify(config));
  const valid=validate();assert.equal(valid.status,0,valid.stdout+valid.stderr);
  assert.deepEqual(JSON.parse(readFileSync(outfile,'utf8')).vars,{GATEWAY_SOURCE_HASH:gatewayHash});
  writeFileSync(join(directory,'wrangler.json'),JSON.stringify({...config,account_id:'unsupported'}));
  assert.notEqual(validate().status,0,'Real Pages validation must reject Worker-only fields.');
 }finally{rmSync(directory,{recursive:true,force:true});}
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
 const result=await verifyRelease({revision:sha,gatewayHash,fetchImpl:transport()});assert.equal(result.anonymousChecks,8);assert.equal(result.revision,sha);
 for(const options of [{revision:'c'.repeat(40)},{assetRevision:'c'.repeat(40)},{gateway:'wrong'},{shortcut:'https://old.example/'}])await assert.rejects(verifyRelease({revision:sha,gatewayHash,fetchImpl:transport(options)}));
});
test('same-commit recovery waits for the exact newly activated Worker version',async()=>{
 let attempts=0,sleeps=0;
 const fetchImpl=async(url,options)=>{
  if(new URL(url).pathname==='/api/version')attempts++;
  return transport({versionId:attempts===1?'previous-version':'new-version'})(url,options);
 };
 const result=await verifyWithRetry({revision:sha,workerVersion:'new-version',gatewayHash,fetchImpl},{sleep:async()=>{sleeps++;},timeoutMs:1000});
 assert.equal(result.workerVersion,'new-version');assert.equal(attempts,2);assert.equal(sleeps,1);
 await assert.rejects(verifyRelease({revision:sha,workerVersion:'new-version',gatewayHash,fetchImpl:transport()}),/exact activated Worker/);
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
