import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {configForRelease,cloudflare,receipt,WORKER,DATABASE,PROJECT,ACCOUNT,requireTrustedCI,uploadedVersion,assertActiveVersion,gatewayReleaseConfig} from './release-tools.mjs';
requireTrustedCI();
const mode=process.argv[2],sha=process.env.GITHUB_SHA;
const config=configForRelease(sha),token=process.env.CLOUDFLARE_API_TOKEN;
if(!token)throw Error('The required Cloudflare environment secret is missing. See DEPLOYMENT.md.');
function wrangler(args,cwd=process.cwd()){
 const r=spawnSync(process.execPath,[resolve('node_modules/wrangler/bin/wrangler.js'),...args],{cwd,stdio:'inherit',env:{...process.env,CLOUDFLARE_ACCOUNT_ID:ACCOUNT,WRANGLER_SEND_METRICS:'false',WRANGLER_WRITE_LOGS:'false'}});
 if(r.status!==0)throw Error(`Wrangler ${args[0]} failed; publishing stopped.`);
}
if(mode==='preflight'){
 const settings=await cloudflare(`workers/scripts/${WORKER}/settings`,token);
 const bindings=settings.bindings||[];
 if(!bindings.some(b=>b.type==='d1'&&b.name==='DB'&&b.id===DATABASE))throw Error('Live Worker is not bound to the expected production database.');
 const secretNames=bindings.filter(b=>b.type==='secret_text').map(b=>b.name);
 for(const name of ['CASHIER_PASSWORD_HASH','SESSION_SECRET','IMPORT_TOKEN'])if(!secretNames.includes(name))throw Error(`Existing ${name} binding is missing; refusing to replace the live configuration.`);
 const deployments=await cloudflare(`workers/scripts/${WORKER}/deployments`,token);
 receipt({previousWorkerDeployment:deployments.deployments?.[0]||null,worker:WORKER,database:DATABASE,secretNames});
 console.log('Existing production database and credential bindings verified; no secret values read.');
}else if(mode==='migrate'){
 // Applies only unapplied migrations to the pinned existing database.
 wrangler(['d1','migrations','apply','DB','--remote','--config','wrangler.release.local.json']);
 receipt({migrationsCompleted:true});
}else if(mode==='worker'){
 const built=JSON.parse(readFileSync('dist/release.json','utf8'));
 if(built.revision!==sha||built.app!=='tlpt-cashier')throw Error('The tested artifact is not from this commit.');
 // Upload and activate code only. `wrangler deploy` also configures triggers
 // and reads the account-wide workers.dev subdomain; neither is needed here.
 wrangler(['versions','upload','--config','wrangler.release.local.json','--keep-vars','--tag',sha,'--message',`Cashier ${sha}`]);
 const versions=await cloudflare(`workers/scripts/${WORKER}/versions?per_page=10`,token);
 const uploaded=uploadedVersion(versions.items,sha);
 receipt({uploadedWorkerVersion:uploaded.id});
 await cloudflare(`workers/scripts/${WORKER}/deployments`,token,{method:'POST',body:JSON.stringify({strategy:'percentage',versions:[{version_id:uploaded.id,percentage:100}],annotations:{'workers/message':`Cashier ${sha}`}})});
 const deployments=await cloudflare(`workers/scripts/${WORKER}/deployments`,token);
 const active=deployments.deployments?.[0];
 assertActiveVersion(active,uploaded.id);
 receipt({workerDeployment:active});
}else if(mode==='gateway'){
 const previous=await cloudflare(`pages/projects/${PROJECT}`,token);
 if(previous.production_branch!=='main'||previous.deployment_configs?.production?.fail_open!==false)throw Error('Gateway must keep its main branch and fail-closed free-quota setting.');
 receipt({previousGatewayDeployment:previous.canonical_deployment?.id||null});
 const cfg=gatewayReleaseConfig(JSON.parse(readFileSync('wrangler.gateway.jsonc','utf8')),process.env.GATEWAY_SOURCE_HASH,process.cwd());
 // If the hostname is unreachable, use Pages' saved configuration to avoid
 // uploading an unchanged gateway merely because its HTTP marker was absent.
 if(previous.deployment_configs?.production?.env_vars?.GATEWAY_SOURCE_HASH?.value===cfg.vars.GATEWAY_SOURCE_HASH){receipt({gatewaySkipped:true});console.log('Gateway source/configuration already matches; no upload.');process.exit(0);}
 // Pages rejects --config. Discover its conventional filename in an isolated
 // directory so the Worker's wrangler.jsonc can never be mistaken for Pages.
 const directory=resolve('.wrangler/gateway-release');mkdirSync(directory,{recursive:true});
 writeFileSync(resolve(directory,'wrangler.json'),JSON.stringify(cfg,null,2)+'\n');
 wrangler(['pages','deploy','--project-name',PROJECT,'--branch','main','--commit-hash',sha,'--commit-dirty=false'],directory);
 const after=await cloudflare(`pages/projects/${PROJECT}`,token);
 if(after.deployment_configs?.production?.fail_open!==false)throw Error('Gateway fail-closed setting changed; restore it before retrying.');
 receipt({gatewayDeployment:after.canonical_deployment?.id||null});
}else throw Error('Choose preflight, migrate, worker or gateway.');
