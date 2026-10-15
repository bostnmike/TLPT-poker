import {test} from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPair,SignJWT} from 'jose';
import {authorizeOwner,ownerRequest,validImportToken,accessConfiguration} from '../lib/owner-auth.mjs';
const env={CASHIER_ENV:'staging',OWNER_EMAIL:'blanchettemr@gmail.com',CF_ACCESS_TEAM_DOMAIN:'https://tlpt-test.cloudflareaccess.com',CF_ACCESS_AUD:'test-audience'};
const keys=await generateKeyPair('RS256');
async function token(overrides={},options={}){return new SignJWT({email:env.OWNER_EMAIL,...overrides}).setProtectedHeader({alg:'RS256'}).setSubject('owner-id').setIssuedAt().setExpirationTime(options.exp||'5m').setIssuer(options.issuer||env.CF_ACCESS_TEAM_DOMAIN).setAudience(options.aud||env.CF_ACCESS_AUD).sign(options.key||keys.privateKey);}
function request(jwt,headers={}){return new Request('https://cashier.example/api/register',{headers:{...headers,...jwt?{'Cf-Access-Jwt-Assertion':jwt}:{}}});}
test('signed Access JWT for the exact owner, audience and issuer replaces Sites authentication',async()=>{
 assert.deepEqual(await authorizeOwner(request(await token()),env,keys.publicKey),{id:'owner-id',email:env.OWNER_EMAIL});
 for(const jwt of [await token({email:'someone@example.com'}),await token({}, {aud:'other-app'}),await token({}, {issuer:'https://other.cloudflareaccess.com'}),await token({}, {exp:946684800}),'unsigned.forged.token'])assert.equal(await authorizeOwner(request(jwt),env,keys.publicKey),null);
 const wrong=await generateKeyPair('RS256');assert.equal(await authorizeOwner(request(await token({}, {key:wrong.privateKey})),env,keys.publicKey),null);
});
test('spoofed identity headers, unconfigured Access, and production local-bypass attempts fail closed',async()=>{
 const spoof=request(null,{'x-tlpt-authenticated-user-id':'attacker','oai-authenticated-user-id':'attacker'});
 assert.equal(await authorizeOwner(spoof,env,keys.publicKey),null);assert.equal(accessConfiguration({...env,CF_ACCESS_TEAM_DOMAIN:'https://attacker.example'}),null);
 assert.equal(await authorizeOwner(request(await token()),{...env,CF_ACCESS_AUD:''},keys.publicKey),null);
 for(const mode of ['staging','production'])assert.equal(await authorizeOwner(new Request('http://localhost/api/register'),{...env,CASHIER_ENV:mode,LOCAL_OWNER_EMAIL:env.OWNER_EMAIL}),null);
 assert.equal(await authorizeOwner(request(null),{...env,CASHIER_ENV:'local',LOCAL_OWNER_EMAIL:env.OWNER_EMAIL}),null);
 assert.equal((await authorizeOwner(new Request('http://127.0.0.1/api/register'),{...env,CASHIER_ENV:'local',LOCAL_OWNER_EMAIL:env.OWNER_EMAIL}))?.email,env.OWNER_EMAIL);
 const clean=ownerRequest(spoof,{id:'verified-owner',email:env.OWNER_EMAIL});assert.equal(clean.headers.get('oai-authenticated-user-id'),null);assert.equal(clean.headers.get('x-tlpt-authenticated-user-id'),'verified-owner');
});
test('receipt intake requires a distinct strong import secret and rejects browser-login headers',async()=>{
 const secret='test-import-secret-which-is-long-enough';
 assert.equal(await validImportToken(request(null,{'X-Register-Token':secret}),{IMPORT_TOKEN:secret}),true);
 for(const supplied of ['',secret+'x','different'])assert.equal(await validImportToken(request(null,{'X-Register-Token':supplied}),{IMPORT_TOKEN:secret}),false);
 assert.equal(await validImportToken(request(await token()),{IMPORT_TOKEN:secret}),false);
 assert.equal(await validImportToken(request(null,{'X-Register-Token':'short'}),{IMPORT_TOKEN:'short'}),false);
});
