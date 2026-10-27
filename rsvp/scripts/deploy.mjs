import {readFileSync,writeFileSync,unlinkSync,readdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
process.chdir(fileURLToPath(new URL('..',import.meta.url)));
const config=JSON.parse(readFileSync('wrangler.jsonc','utf8'));
if(process.env.RSVP_FREE_PLAN_CONFIRMED!=='1')throw Error('Verify actual Workers Free in the dashboard first. No paid plans are allowed.');
if(config.account_id!=='4d5ea071300fa71b8fa947c06d8ba314'||config.name!=='tlpt-rsvp'||config.d1_databases[0].database_name!=='tlpt-rsvp'||!config.d1_databases[0].database_id||['00000000-0000-4000-8000-000000000000','9165ae68-16fa-4ce2-9b87-77019e52ef20'].includes(config.d1_databases[0].database_id))throw Error('Configure the separate actual RSVP database before publication.');
const revision=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();config.vars.REVISION=revision;
writeFileSync('deploy.local.json',JSON.stringify(config));
const env={...process.env,WRANGLER_SEND_METRICS:'false',WRANGLER_WRITE_LOGS:'false'};
try{execFileSync(process.execPath,['--test',...readdirSync('tests').filter(f=>f.endsWith('.test.mjs')).map(f=>'tests/'+f)],{env,stdio:'inherit'});execFileSync(process.execPath,['node_modules/wrangler/bin/wrangler.js','deploy','--config','deploy.local.json'],{env,stdio:'inherit'});}finally{unlinkSync('deploy.local.json');}
execFileSync(process.execPath,['scripts/verify-release.mjs'],{env:{...env,EXPECTED_REVISION:revision},stdio:'inherit'});
