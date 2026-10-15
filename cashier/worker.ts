import {GET as getRegister,POST as saveRegister} from './app/api/register/route';
import {GET as getPlayers} from './app/api/players/route';
import {POST as importReceipts} from './app/api/import/route';
import {accessConfiguration,authorizeOwner,ownerRequest,validImportToken} from './lib/owner-auth.mjs';
import {passwordConfiguration,passwordLogin,passwordLogout,signInPage} from './lib/password-auth.mjs';

const response=(value:unknown,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'private, no-store'}});
function secure(res:Response){const headers=new Headers(res.headers);headers.set('X-Robots-Tag','noindex, nofollow, noarchive');headers.set('X-Content-Type-Options','nosniff');headers.set('Referrer-Policy','same-origin');headers.set('Content-Security-Policy',"default-src 'self'; img-src 'self' https://tlpt.org data:; style-src 'self' 'unsafe-inline'; media-src 'self' blob:; connect-src 'self'; script-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");return new Response(res.body,{status:res.status,statusText:res.statusText,headers});}
export default {
 async fetch(request:Request,env:Cloudflare.Env):Promise<Response>{
  try{
   const url=new URL(request.url),path=url.pathname;
   if(env.AUTH_MODE==='password'&&path==='/auth/login')return secure(await passwordLogin(request,env));
   if(env.AUTH_MODE==='password'&&path==='/auth/logout')return secure(passwordLogout(request));
   if(path==='/api/import'){
    if(request.method!=='POST')return secure(response({error:'Method not allowed'},405));
    if(!await validImportToken(request,env))return secure(response({error:'Unauthorized'},401));
    return secure(await importReceipts(request));
   }
   const owner=await authorizeOwner(request,env);
   if(!owner){
    const configured=env.AUTH_MODE==='password'?passwordConfiguration(env):accessConfiguration(env);
    if(path.startsWith('/api/'))return secure(response({error:configured?'Sign in to use the register.':'Cashier sign-in is not configured.'},configured?401:503));
    if(env.AUTH_MODE==='password')return secure(configured?signInPage('',401):signInPage('The test cashier is still being configured.',503));
    return secure(new Response('<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>TLPT Cashier sign-in</title><main><h1>TLPT Cashier</h1><p>'+ (configured?'Sign in with the cashier owner’s email to continue.':'This new cashier is still being configured.')+'</p>'+(configured?'<p><a href="/cdn-cgi/access/login">Sign in</a></p>':'')+'<p><a href="https://tlpt.org/cashier.html">Open the current working register</a></p></main></html>',{status:configured?401:503,headers:{'Content-Type':'text/html;charset=utf-8','Cache-Control':'private, no-store'}}));
   }
   const verified=ownerRequest(request,owner);
   if(path==='/api/reader-setup'){
    if(request.method!=='GET')return secure(response({error:'Method not allowed'},405));
    if(!env.IMPORT_TOKEN||env.IMPORT_TOKEN.length<32)return secure(response({error:'The reader connection is not configured yet.'},503));
    return secure(response({origin:url.origin,importToken:env.IMPORT_TOKEN,environment:env.CASHIER_ENV}));
   }
   if(path==='/api/register')return secure(await (request.method==='GET'?getRegister(verified):request.method==='POST'?saveRegister(verified):response({error:'Method not allowed'},405)));
   if(path==='/api/players')return secure(request.method==='GET'?await getPlayers(verified):response({error:'Method not allowed'},405));
   if(path==='/api/health')return secure(response({ok:true,environment:env.CASHIER_ENV,owner:owner.email}));
   if(path.startsWith('/api/'))return secure(response({error:'Not found'},404));
   if(path==='/auth/logout')return secure(Response.redirect(new URL('/cdn-cgi/access/logout',url),302));
   if(path==='/display'){const id=url.searchParams.get('eventId');return secure(Response.redirect(new URL('/'+(id&&/^(friday|saturday|mtt):\d{4}-\d{2}-\d{2}$/.test(id)?'?eventId='+encodeURIComponent(id):''),url),302));}
   const res=await env.ASSETS.fetch(verified);const headers=new Headers(res.headers);if(headers.get('Content-Type')?.includes('text/html'))headers.set('Cache-Control','private, no-store');
   return secure(new Response(res.body,{status:res.status,headers}));
  }catch{return secure(response({error:'Cashier temporarily unavailable. Saved records remain intact.'},503));}
 }
};
