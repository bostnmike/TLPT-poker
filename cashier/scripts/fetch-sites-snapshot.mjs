import {mkdirSync,writeFileSync} from 'node:fs';import {fileURLToPath} from 'node:url';import {snapshotSummary} from '../lib/migration.mjs';
process.chdir(fileURLToPath(new URL('..',import.meta.url)));
// Credential arrives through hidden stdin from the authorized Sites connection.
let input='';for await(const chunk of process.stdin)input+=chunk;
const {origin,token}=JSON.parse(input);
if(origin!=='https://tlpt-cash-register-oct24.blanchettemr.chatgpt.site'||!token)throw Error('Expected the existing private cashier and an authorized Sites credential.');
const r=await fetch(origin+'/api/migration-export',{headers:{'OAI-Sites-Authorization':'Bearer '+token},redirect:'error'});if(!r.ok)throw Error('Private snapshot export failed ('+r.status+').');
const snapshot=await r.json(),summary=snapshotSummary(snapshot);mkdirSync('private',{recursive:true,mode:0o700});writeFileSync('private/sites-snapshot.json',JSON.stringify(snapshot,null,2)+'\n',{mode:0o600});console.log(JSON.stringify({saved:'private/sites-snapshot.json',...summary}));
