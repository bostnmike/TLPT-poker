import {SignJWT,jwtVerify} from 'jose';
const encoder=new TextEncoder(),COOKIE='__Host-tlpt-session',TTL=12*60*60;
export const LOGIN_LIMIT_SQL='INSERT INTO cashier_login_limits (key,window_start,attempts) VALUES (?,?,1) ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN window_start=excluded.window_start THEN attempts+1 ELSE 1 END,window_start=excluded.window_start RETURNING attempts';
const bytes=s=>Uint8Array.from(atob(s.replaceAll('-','+').replaceAll('_','/')),c=>c.charCodeAt(0));
const hex=b=>[...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('');
export function passwordConfiguration(env){
 return env.AUTH_MODE==='password'&&/^v1:100000:[A-Za-z0-9_-]{22}:[A-Za-z0-9_-]{43}$/.test(env.CASHIER_PASSWORD_HASH||'')&&/^[A-Za-z0-9_-]{43}$/.test(env.SESSION_SECRET||'')&&String(env.OWNER_EMAIL||'').includes('@');
}
async function sessionKey(env){return new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(env.SESSION_SECRET+'\0'+env.CASHIER_PASSWORD_HASH)));}
export async function verifyPassword(password,stored){
 if(typeof password!=='string'||password.length<16||password.length>128||!/^v1:100000:[A-Za-z0-9_-]{22}:[A-Za-z0-9_-]{43}$/.test(stored||''))return false;
 const [,iterations,salt,expected]=stored.split(':');
 const key=await crypto.subtle.importKey('raw',encoder.encode(password),'PBKDF2',false,['deriveBits']);
 const actual=new Uint8Array(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',iterations:Number(iterations),salt:bytes(salt)},key,256));
 const wanted=bytes(expected);let mismatch=0;for(let i=0;i<32;i++)mismatch|=actual[i]^wanted[i];return mismatch===0;
}
export async function passwordOwner(request,env){
 if(!passwordConfiguration(env))return null;
 const cookie=request.headers.get('Cookie')||'',matches=cookie.split(';').map(x=>x.trim()).filter(x=>x.startsWith(COOKIE+'='));
 if(matches.length!==1)return null;
 try{const {payload}=await jwtVerify(matches[0].slice(COOKIE.length+1),await sessionKey(env),{algorithms:['HS256'],issuer:new URL(request.url).origin,audience:'tlpt-cashier',requiredClaims:['exp','iat','sub','email'],maxTokenAge:TTL});
  if(payload.sub!=='cashier-owner'||payload.email!==env.OWNER_EMAIL.toLowerCase())return null;
  return {id:payload.sub,email:payload.email};
 }catch{return null;}
}
export async function loginAllowed(request,env,now=Date.now()){
 const window=Math.floor(now/900000)*900000;
 const key=await crypto.subtle.importKey('raw',await sessionKey(env),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const ip=hex(await crypto.subtle.sign('HMAC',key,encoder.encode(request.headers.get('CF-Connecting-IP')||'unknown')));
 const results=await env.DB.batch(['all','ip:'+ip].map(k=>env.DB.prepare(LOGIN_LIMIT_SQL).bind(k,window)));
 await env.DB.prepare('DELETE FROM cashier_login_limits WHERE window_start < ?').bind(window-86400000).run();
 return results[0]?.results?.[0]?.attempts<=30&&results[1]?.results?.[0]?.attempts<=5;
}
export function signInPage(error='',status=200){
 return new Response(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>TLPT · Cashier Sign In</title><style>body{margin:0;min-height:100svh;display:grid;place-items:center;background:#080d17;color:#eef2fa;font:17px system-ui}main{width:min(390px,calc(100% - 48px));padding:32px 0}img{width:78px}h1{font-size:36px;margin:18px 0 8px}p{color:#a8b4c7;line-height:1.5}label{display:block;margin:24px 0 8px}input,button{box-sizing:border-box;width:100%;padding:16px;border-radius:12px;font:inherit}input{background:#121c2c;border:1px solid #4b5a72;color:#fff}button{margin-top:18px;background:#f6bb51;color:#15110a;border:0;font-weight:700;cursor:pointer}a{color:#f6bb51}.error{color:#ffb6b6}</style><main><img src="/images/brand/tlpt-chip-100.png" alt="TLPT"><p>THE LITTLE POKER TOUR</p><h1>Cashier sign in.</h1><p>Enter your private cashier password. Your iPad stays signed in for 12 hours.</p>${error?'<p class="error" role="alert">'+error+'</p>':''}<form method="post" action="/auth/login"><label for="password">Cashier password</label><input id="password" name="password" type="password" autocomplete="current-password" minlength="16" maxlength="128" required><button type="submit">Open the register</button></form><p><a href="https://tlpt.org/cashier.html">Current working register →</a></p></main></html>`,{status,headers:{'Content-Type':'text/html;charset=utf-8','Cache-Control':'private, no-store'}});
}
export async function passwordLogin(request,env){
 if(request.method==='GET')return signInPage();
 if(request.method!=='POST')return new Response('Method not allowed',{status:405});
 if(request.headers.get('Origin')!==new URL(request.url).origin)return new Response('Invalid origin',{status:403});
 if(!passwordConfiguration(env))return signInPage('The test cashier is still being configured.',503);
 if(Number(request.headers.get('Content-Length')||0)>2048)return new Response('Request too large',{status:413});
 try{
  if(!await loginAllowed(request,env)){const res=signInPage('Too many sign-in attempts. Please try again in 15 minutes.',429);res.headers.set('Retry-After','900');return res;}
  const reader=request.body?.getReader();if(!reader)return signInPage('Enter your cashier password.',400);
  let length=0,chunks=[];while(true){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>2048){await reader.cancel();return new Response('Request too large',{status:413});}chunks.push(value);}
  const all=new Uint8Array(length);let offset=0;for(const chunk of chunks){all.set(chunk,offset);offset+=chunk.length;}
  const raw=new TextDecoder().decode(all),type=request.headers.get('Content-Type')||'';
  const password=type.includes('application/json')?JSON.parse(raw).password:type.includes('application/x-www-form-urlencoded')?new URLSearchParams(raw).get('password'):null;
  if(!await verifyPassword(password,env.CASHIER_PASSWORD_HASH))return signInPage('That password did not match.',401);
  const token=await new SignJWT({email:env.OWNER_EMAIL.toLowerCase()}).setProtectedHeader({alg:'HS256'}).setSubject('cashier-owner').setIssuer(new URL(request.url).origin).setAudience('tlpt-cashier').setIssuedAt().setExpirationTime('12h').sign(await sessionKey(env));
  return new Response(null,{status:303,headers:{Location:'/', 'Set-Cookie':`${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${TTL}`,'Cache-Control':'private, no-store'}});
 }catch{return signInPage('Sign-in is temporarily unavailable. Please try again.',503);}
}
export function passwordLogout(request){
 if(request.method!=='POST')return new Response('Method not allowed',{status:405});
 if(request.headers.get('Origin')!==new URL(request.url).origin)return new Response('Invalid origin',{status:403});
 return new Response(null,{status:303,headers:{Location:'/auth/login','Set-Cookie':`${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`,'Cache-Control':'private, no-store'}});
}
