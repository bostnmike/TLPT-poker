// Rotate the separate Commish link and deliver it only on loopback, never stdout.
// Run locally after deployment: node rsvp/scripts/owner-link.mjs --remote
import {randomBytes,createHash} from 'node:crypto';
import {createServer} from 'node:http';
import {spawnSync} from 'node:child_process';
import {writeFileSync,unlinkSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
process.chdir(fileURLToPath(new URL('..',import.meta.url)));
if(!process.argv.includes('--remote'))throw Error('This rotates the RSVP Commish link only. Supply --remote for the configured RSVP database.');
const key=randomBytes(32).toString('hex'),hash=createHash('sha256').update(key).digest('hex');
const sql=`UPDATE rsvp_state SET revision=revision+1,body=json_set(body,'$.revision',revision+1,'$.adminHash','${hash}','$.adminGeneration',json_extract(body,'$.adminGeneration')+1) WHERE id=1;`;
// Hash only, no bearer secret is written to disk or child-process arguments.
writeFileSync('owner-hash.local.sql',sql,{mode:0o600});
try{const r=spawnSync(process.execPath,['node_modules/wrangler/bin/wrangler.js','d1','execute','DB','--remote','--config','wrangler.jsonc','--file','owner-hash.local.sql'],{env:{...process.env,WRANGLER_SEND_METRICS:'false',WRANGLER_WRITE_LOGS:'false'},stdio:'ignore'});if(r.status!==0)throw Error('Owner link setup failed. Existing credentials were not intentionally changed.');}finally{unlinkSync('owner-hash.local.sql');}
const link='https://tlpt-rsvp.tlpt-bostnmike.workers.dev/?commish=1#key='+key;
const server=createServer((req,res)=>{
 if(req.headers.host!=='127.0.0.1:8795'||req.url!=='/setup'){res.writeHead(404);res.end();return;}
 res.writeHead(200,{'Content-Type':'text/html','Cache-Control':'no-store','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'"});
 res.end(`<!doctype html><html><meta name="viewport" content="width=device-width,initial-scale=1"><title>TLPT private Commish access</title><style>body{background:#101812;color:#f4ead5;font:18px system-ui;max-width:650px;margin:60px auto;padding:24px}a{color:#d9b96e;overflow-wrap:anywhere}textarea{width:100%;height:150px;font:16px monospace}p{line-height:1.6}</style><h1>Your private Commish link</h1><p>Save this in your password manager or a private bookmark. Anyone with this link can manage TLPT RSVPs. Keep it out of chat and screenshots.</p><p><a href="${link}">Open the Commish view</a></p><textarea readonly aria-label="Private Commish link">${link}</textarea><p>The previous Commish link and its sessions are revoked. Player access and Cashier credentials are unchanged. This local page closes in 15 minutes.</p></html>`);
});server.listen(8795,'127.0.0.1',()=>console.log('Private setup ready at http://127.0.0.1:8795/setup (available for 15 minutes).'));setTimeout(()=>server.close(),15*60000);
