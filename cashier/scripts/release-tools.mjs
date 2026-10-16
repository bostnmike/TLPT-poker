import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
export const ACCOUNT='4d5ea071300fa71b8fa947c06d8ba314';
export const WORKER='tlpt-cashier-staging';
export const DATABASE='9165ae68-16fa-4ce2-9b87-77019e52ef20';
export const PROJECT='tlpt-cashier-domain';
export const ORIGIN='https://cashier.tlpt.org';
export const shaPattern=/^[a-f0-9]{40}$/;
export function uploadedVersion(items,sha){
 const version=items?.find(v=>v.annotations?.['workers/tag']===sha);
 if(!shaPattern.test(sha||'')||!version?.id)throw Error('Cannot identify the uploaded version for this exact commit.');
 return version;
}
export function assertActiveVersion(deployment,id){
 if(deployment?.versions?.length!==1||deployment.versions[0].version_id!==id||deployment.versions[0].percentage!==100)throw Error('The intended Worker version is not serving 100% of traffic.');
}
const repositoryRoot=fileURLToPath(new URL('../..',import.meta.url));
export function git(...args){return execFileSync('git',args,{cwd:repositoryRoot,encoding:'utf8'}).trim();}
export const gatewayPath=p=>p.startsWith('cashier/domain-gateway/')||p==='cashier/wrangler.gateway.jsonc';
export const workerPath=p=>(p.startsWith('cashier/')&&!gatewayPath(p))||p==='.github/workflows/cashier-checks.yml';
export function fingerprint(revision,select,root=repositoryRoot){
 if(!shaPattern.test(revision))throw Error('A full commit SHA is required.');
 const paths=execFileSync('git',['ls-tree','-r','--name-only',revision,'--','cashier','.github/workflows/cashier-checks.yml'],{cwd:root,encoding:'utf8'}).trim().split('\n').filter(select).sort();
 if(!paths.length)throw Error('Release fingerprint has no source files; refusing an unverifiable deployment.');
 const hash=createHash('sha256');
 for(const path of paths){hash.update(path+'\0');hash.update(execFileSync('git',['show',`${revision}:${path}`],{cwd:root}));hash.update('\0');}
 return hash.digest('hex');
}
export function validateProduction(config){
 if(config.name!==WORKER||config.account_id!==ACCOUNT||config.vars?.CASHIER_ENV!=='production'||config.vars?.AUTH_MODE!=='password'||config.vars?.OWNER_EMAIL!=='blanchettemr@gmail.com')throw Error('Production identity/authentication differs from the existing cashier.');
 if(config.d1_databases?.length!==1||config.d1_databases[0].database_id!==DATABASE||config.d1_databases[0].binding!=='DB'||config.d1_databases[0].database_name!=='tlpt-cashier')throw Error('Production must use the existing cashier database.');
 if(config.env||config.routes||config.route||config.vars.LOCAL_OWNER_EMAIL||config.vars.SESSION_SECRET||config.vars.CASHIER_PASSWORD_HASH||config.vars.IMPORT_TOKEN)throw Error('Routes, alternate environments, local identities and credential overrides are forbidden.');
 if(config.assets?.binding!=='ASSETS'||config.version_metadata?.binding!=='CASHIER_VERSION'||config.observability?.enabled!==false)throw Error('Unexpected production asset/version/log configuration.');
 return config;
}
export function configForRelease(sha){
 if(!shaPattern.test(sha))throw Error('A full release commit SHA is required.');
 const config=validateProduction(JSON.parse(readFileSync('wrangler.production.jsonc','utf8')));
 config.vars.RELEASE_SHA=sha;
 writeFileSync('wrangler.release.local.json',JSON.stringify(config,null,2)+'\n');return config;
}
export async function cloudflare(path,token,options={}){
 if(!token)throw Error('Missing Cloudflare deployment credential.');
 const r=await fetch(`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/${path}`,{...options,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json',...options.headers},signal:AbortSignal.timeout(30000)});
 const data=await r.json();if(!r.ok||!data.success)throw Error(`Cloudflare ${options.method||'GET'} ${path} failed (${r.status}); check credential scope and the Actions log.`);
 return data.result;
}
export function receipt(update){
 const path='deployment-receipt.json',previous=existsSync(path)?JSON.parse(readFileSync(path,'utf8')):{};
 const next={...previous,...update};writeFileSync(path,JSON.stringify(next,null,2)+'\n');return next;
}
export function requireTrustedCI(env=process.env){
 if(env.GITHUB_ACTIONS!=='true'||env.GITHUB_REPOSITORY!=='bostnmike/TLPT-poker'||env.GITHUB_REF!=='refs/heads/main'||!['push','workflow_dispatch'].includes(env.GITHUB_EVENT_NAME))throw Error('Production publishing is restricted to trusted main-branch GitHub Actions runs.');
}
