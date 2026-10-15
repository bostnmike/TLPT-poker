// Deliberate manual deployment only. No plan upgrades or paid resources.
import {readFileSync,existsSync,writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
process.chdir(fileURLToPath(new URL('..',import.meta.url)));
const target=process.argv[2];
if(!['staging','production'].includes(target))throw Error('Choose staging or production.');
const config=JSON.parse(readFileSync('wrangler.jsonc','utf8'));
const selected=target==='production'?config.env.production:config;
const account=process.env.CLOUDFLARE_ACCOUNT_ID,database=process.env.CASHIER_DATABASE_ID;
if(!/^[a-f0-9]{32}$/.test(account||'')||!/^[a-f0-9-]{36}$/.test(database||'')||database==='00000000-0000-4000-8000-000000000000')throw Error('Supply the actual Cloudflare account and separate target D1 database IDs.');
if(process.env.CASHIER_FREE_PLAN_CONFIRMED!=='1')throw Error('Confirm Workers Free in Cloudflare first; set CASHIER_FREE_PLAN_CONFIRMED=1. This script cannot upgrade plans.');
const authMode=process.env.CASHIER_AUTH_MODE||'password';
if(!['password','access'].includes(authMode))throw Error('Choose password or access sign-in.');
if(authMode==='access'&&(!process.env.CF_ACCESS_TEAM_DOMAIN||!process.env.CF_ACCESS_AUD))throw Error('Configure the owner-only Cloudflare Access application first.');
if(target==='production'&&process.env.CASHIER_STAGING_TESTED!=='1')throw Error('Finish staging tests and data reconciliation before production deployment.');
const effective={...config,...selected,account_id:account,env:undefined};
effective.vars={...selected.vars,AUTH_MODE:authMode,CF_ACCESS_TEAM_DOMAIN:process.env.CF_ACCESS_TEAM_DOMAIN||'',CF_ACCESS_AUD:process.env.CF_ACCESS_AUD||''};
effective.d1_databases=[{...selected.d1_databases[0],database_id:database}];
if(effective.vars.CASHIER_ENV!==target||effective.vars.LOCAL_OWNER_EMAIL)throw Error('Local development identity is forbidden on a deployed Worker.');
if(authMode==='access'&&!/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(effective.vars.CF_ACCESS_TEAM_DOMAIN))throw Error('Use the verified Cloudflare Access team URL.');
writeFileSync('wrangler.deploy.local.json',JSON.stringify(effective,null,2)+'\n');
if(!existsSync('dist/index.html'))throw Error('Build the cashier before deploying.');
for(const args of [['d1','migrations','apply','DB','--remote','--config','wrangler.deploy.local.json'],['deploy','--config','wrangler.deploy.local.json']]){
 const result=spawnSync(process.execPath,['node_modules/wrangler/bin/wrangler.js',...args],{stdio:'inherit',env:{...process.env,WRANGLER_SEND_METRICS:'false',WRANGLER_WRITE_LOGS:'false'}});if(result.status!==0)process.exit(result.status||1);
}
console.log('Deployment complete. Existing encrypted secrets are retained. Configure password and import secrets only for a new Worker. The shortcut and reader are separate cutover steps.');
