import {createRemoteJWKSet,jwtVerify} from 'jose';
import {passwordOwner} from './password-auth.mjs';
const keySets=new Map();
const loopback=host=>['localhost','127.0.0.1','[::1]'].includes(host);
export function accessConfiguration(env){
 const issuer=String(env.CF_ACCESS_TEAM_DOMAIN||'').replace(/\/$/,'');
 if(!/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(issuer)||!String(env.CF_ACCESS_AUD||'').trim()||!String(env.OWNER_EMAIL||'').includes('@'))return null;
 return {issuer,audience:env.CF_ACCESS_AUD};
}
export async function authorizeOwner(request,env,keyResolver){
 const owner=String(env.OWNER_EMAIL||'').trim().toLowerCase();
 if(env.CASHIER_ENV==='local'&&loopback(new URL(request.url).hostname)&&owner&&env.LOCAL_OWNER_EMAIL?.toLowerCase()===owner)return {id:'local-owner',email:owner};
 if(env.AUTH_MODE==='password')return passwordOwner(request,env);
 if(env.AUTH_MODE&&env.AUTH_MODE!=='access')return null;
 const config=accessConfiguration(env),token=request.headers.get('Cf-Access-Jwt-Assertion');
 if(!config||!token)return null;
 try{
  if(!keyResolver){if(!keySets.has(config.issuer))keySets.set(config.issuer,createRemoteJWKSet(new URL(config.issuer+'/cdn-cgi/access/certs')));keyResolver=keySets.get(config.issuer);}
  const {payload}=await jwtVerify(token,keyResolver,{...config,algorithms:['RS256'],requiredClaims:['exp','iat','sub','email'],clockTolerance:5});
  if(typeof payload.email!=='string'||payload.email.toLowerCase()!==owner||typeof payload.sub!=='string'||!payload.sub)return null;
  return {id:payload.sub,email:owner};
 }catch{return null;}
}
export function ownerRequest(request,owner){
 const headers=new Headers(request.headers);
 for(const name of [...headers.keys()])if(name.startsWith('oai-')||name.startsWith('x-tlpt-authenticated-'))headers.delete(name);
 headers.set('x-tlpt-authenticated-user-id',owner.id);headers.set('x-tlpt-authenticated-user-email',owner.email);
 return new Request(request,{headers});
}
export async function validImportToken(request,env){
 const expected=env.IMPORT_TOKEN,supplied=request.headers.get('X-Register-Token');
 if(typeof expected!=='string'||expected.length<32||!supplied||supplied.length>512)return false;
 const encode=new TextEncoder(),digest=value=>crypto.subtle.digest('SHA-256',encode.encode(value));
 const [a,b]=await Promise.all([digest(expected),digest(supplied)]);let mismatch=0;
 for(let i=0;i<32;i++)mismatch|=new Uint8Array(a)[i]^new Uint8Array(b)[i];
 return mismatch===0;
}
