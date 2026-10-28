// Adds ONLY the notification signing secret, once. Existing keys are preserved.
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
process.chdir(fileURLToPath(new URL('..',import.meta.url)));
const config=JSON.parse(readFileSync('wrangler.jsonc'));
if(config.name!=='tlpt-rsvp'||config.d1_databases[0].database_id!=='79de1ed8-302a-4d25-b7f1-5f423e6ea321')throw Error('RSVP-only configuration required.');
const args=['node_modules/wrangler/bin/wrangler.js'],env={...process.env,WRANGLER_SEND_METRICS:'false',WRANGLER_WRITE_LOGS:'false'};
const list=JSON.parse(execFileSync(process.execPath,[...args,'secret','list','--config','wrangler.jsonc'],{env,encoding:'utf8'}));
if(list.some(s=>s.name==='VAPID_PRIVATE_JWK'))console.log('Notification signing key already exists; preserved.');
else{
 const pair=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
 const jwk=await crypto.subtle.exportKey('jwk',pair.privateKey);
 // Secret travels through stdin directly to Cloudflare, never a file or log.
 execFileSync(process.execPath,[...args,'secret','put','VAPID_PRIVATE_JWK','--config','wrangler.jsonc'],{env,input:JSON.stringify(jwk),stdio:['pipe','pipe','pipe']});
 console.log('Created the RSVP notification signing secret. No existing credentials changed.');
}
