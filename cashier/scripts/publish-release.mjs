import {readFileSync,writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {configForRelease,cloudflare,receipt,WORKER,DATABASE,PROJECT,ACCOUNT,requireTrustedCI} from './release-tools.mjs';
requireTrustedCI();
const mode=process.argv[2],sha=process.env.GITHUB_SHA;
const config=configForRelease(sha),token=process.env.CLOUDFLARE_API_TOKEN;
if(!token)throw Error('The required Cloudflare environment secret is missing. See DEPLOYMENT.md.');
function wrangler(args){
 const r=spawnSync(process.execPath,['node_modules/wrangler/bin/wrangler.js',...args],{stdio:'inherit',env:{...process.env,CLOUDFLARE_ACCOUNT_ID:ACCOUNT,WRANGLER_SEND_METRICS:'false',WRANGLER_WRITE_LOGS:'false'}});
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
 wrangler(['deploy','--config','wrangler.release.local.json','--keep-vars']);
 const deployments=await cloudflare(`workers/scripts/${WORKER}/deployments`,token);
 const active=deployments.deployments?.[0];
 if(!active?.versions?.length)throw Error('Cannot identify the new deployed Worker version.');
 receipt({workerDeployment:active});
}else if(mode==='gateway'){
 const previous=await cloudflare(`pages/projects/${PROJECT}`,token);
 if(previous.production_branch!=='main'||previous.deployment_configs?.production?.fail_open!==false)throw Error('Gateway must keep its main branch and fail-closed free-quota setting.');
 receipt({previousGatewayDeployment:previous.canonical_deployment?.id||null});
 const cfg=JSON.parse(readFileSync('wrangler.gateway.jsonc','utf8'));
 if(cfg.name!==PROJECT||cfg.services?.length!==1||cfg.services[0].binding!=='CASHIER'||cfg.services[0].service!==WORKER||cfg.d1_databases||cfg.env)throw Error('Gateway may only bind to the existing production Worker.');
 cfg.account_id=ACCOUNT;cfg.vars={GATEWAY_SOURCE_HASH:process.env.GATEWAY_SOURCE_HASH};
 if(!/^[a-f0-9]{64}$/.test(cfg.vars.GATEWAY_SOURCE_HASH||''))throw Error('Missing gateway source fingerprint.');
 // If the hostname is unreachable, use Pages' saved configuration to avoid
 // uploading an unchanged gateway merely because its HTTP marker was absent.
 if(previous.deployment_configs?.production?.env_vars?.GATEWAY_SOURCE_HASH?.value===cfg.vars.GATEWAY_SOURCE_HASH){receipt({gatewaySkipped:true});console.log('Gateway source/configuration already matches; no upload.');process.exit(0);}
 writeFileSync('wrangler.gateway.release.local.json',JSON.stringify(cfg,null,2)+'\n');
 wrangler(['pages','deploy','--config','wrangler.gateway.release.local.json','--project-name',PROJECT,'--branch','main','--commit-hash',sha,'--commit-dirty=false']);
 const after=await cloudflare(`pages/projects/${PROJECT}`,token);
 if(after.deployment_configs?.production?.fail_open!==false)throw Error('Gateway fail-closed setting changed; restore it before retrying.');
 receipt({gatewayDeployment:after.canonical_deployment?.id||null});
}else throw Error('Choose preflight, migrate, worker or gateway.');
