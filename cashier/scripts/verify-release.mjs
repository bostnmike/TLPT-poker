import {pathToFileURL} from 'node:url';
import {ORIGIN,shaPattern,receipt} from './release-tools.mjs';
export class PrivateDataExposed extends Error {}
const publicHeaders={'Cache-Control':'no-cache','User-Agent':'TLPT-Cashier-CI/1.0'};
export async function verifyRelease({revision,gatewayHash,fetchImpl=fetch,origin=ORIGIN,shortcut='https://tlpt.org/cashier.html'}){
 if(!shaPattern.test(revision||''))throw Error('Expected release SHA is required.');
 const request=(path,options={})=>fetchImpl(origin+path,{...options,redirect:'manual',headers:{...publicHeaders,...options.headers},signal:AbortSignal.timeout(20000)});
 const versionResponse=await request('/api/version');
 if(versionResponse.status!==200)throw Error('Public deployed version is not ready.');
 const version=await versionResponse.json();
 if(Object.keys(version).sort().join(',')!=='app,revision,versionId'||version.app!=='tlpt-cashier'||version.revision!==revision||!version.versionId)throw Error('Live Worker revision/version does not match this release.');
 if(gatewayHash&&versionResponse.headers.get('X-TLPT-Gateway-Source')!==gatewayHash)throw Error('Live gateway does not match its source fingerprint.');
 if(!versionResponse.headers.get('Cache-Control')?.includes('no-store'))throw Error('Build metadata must not be cached.');
 const assetsResponse=await request('/release.json');
 if(assetsResponse.status!==200||(await assetsResponse.json()).revision!==revision)throw Error('Published interface artifact differs from the deployed Worker.');
 const landing=await request('/');
 if(landing.status!==200||!(await landing.text()).includes('action="/auth/login"'))throw Error('Anonymous visitors must see the password form.');
 const checks=[['/api/register',{}],['/api/players',{}],['/api/health',{}],['/api/reader-setup',{}],['/api/register',{method:'POST',headers:{'Content-Type':'application/json',Origin:origin},body:'{}'}],['/api/import',{method:'POST',headers:{'Content-Type':'application/json'},body:'{"messages":[]}'}],['/api/register',{headers:{'x-tlpt-authenticated-user-id':'fake','Cf-Access-Jwt-Assertion':'fake.jwt.value'}}]];
 for(const [path,options] of checks){
  const r=await request(path,options);
  if(r.status!==401)throw new PrivateDataExposed(`${options.method||'GET'} ${path} did not deny anonymous/spoofed access (${r.status}).`);
  const body=await r.json();
  if(Object.keys(body).join(',')!=='error'||typeof body.error!=='string'||!r.headers.get('Cache-Control')?.includes('no-store'))throw new PrivateDataExposed(`Unexpected private response at ${path}.`);
 }
 const shortcutResponse=await fetchImpl(shortcut,{headers:publicHeaders,redirect:'follow',signal:AbortSignal.timeout(20000)});
 if(shortcutResponse.status!==200)throw Error('The TLPT cashier shortcut is unavailable.');
 const html=await shortcutResponse.text();
 if(!/http-equiv="refresh"\s+content="0; url=https:\/\/cashier\.tlpt\.org\/"/i.test(html)||!html.includes('href="https://cashier.tlpt.org/"'))throw Error('The TLPT shortcut no longer opens the branded cashier.');
 return {revision:version.revision,workerVersion:version.versionId,gatewayHash:versionResponse.headers.get('X-TLPT-Gateway-Source'),anonymousChecks:checks.length,shortcut,origin};
}
export async function verifyWithRetry(options,{timeoutMs=180000,intervalMs=5000,sleep=ms=>new Promise(r=>setTimeout(r,ms))}={}){
 const deadline=Date.now()+timeoutMs;let last;
 do{try{return await verifyRelease(options);}catch(error){if(error instanceof PrivateDataExposed)throw error;last=error;if(Date.now()>=deadline)break;console.warn(error.message+' Waiting for propagation.');await sleep(intervalMs);}}while(Date.now()<deadline);
 throw last;
}
if(import.meta.url===pathToFileURL(process.argv[1]||'').href){
 try{const verified=await verifyWithRetry({revision:process.env.EXPECTED_REVISION||process.argv[2],gatewayHash:process.env.EXPECTED_GATEWAY_HASH});receipt({verified,verifiedAt:new Date().toISOString()});console.log(JSON.stringify(verified,null,2));}
 catch(error){receipt({verificationError:error.message});console.error(error.message);process.exitCode=1;}
}
