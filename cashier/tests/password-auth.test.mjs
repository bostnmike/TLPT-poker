import {test} from 'node:test';
import assert from 'node:assert/strict';
import {pbkdf2Sync,randomBytes} from 'node:crypto';
import {passwordConfiguration,verifyPassword,passwordLogin,passwordOwner,passwordLogout} from '../lib/password-auth.mjs';
import {authorizeOwner} from '../lib/owner-auth.mjs';
const password='disposable local testing passphrase',salt=randomBytes(16);
const hash=`v1:100000:${salt.toString('base64url')}:${pbkdf2Sync(password,salt,100000,32,'sha256').toString('base64url')}`;
function env(attempts=1){return {AUTH_MODE:'password',CASHIER_ENV:'staging',OWNER_EMAIL:'blanchettemr@gmail.com',CASHIER_PASSWORD_HASH:hash,SESSION_SECRET:randomBytes(32).toString('base64url'),DB:{prepare(){return {bind(){return this;},async run(){return {};}};},async batch(){return [{results:[{attempts}]},{results:[{attempts}]}];}}};}
function login(value=password,origin='https://cashier.example'){return new Request('https://cashier.example/auth/login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({password:value})});}
test('password sign-in stores only a salted verifier and rejects missing config, wrong passwords and oversized inputs',async()=>{
 const e=env();assert.equal(passwordConfiguration(e),true);assert.equal(passwordConfiguration({...e,SESSION_SECRET:''}),false);
 assert.equal(await verifyPassword(password,hash),true);for(const p of ['short','incorrect testing passphrase','x'.repeat(129)])assert.equal(await verifyPassword(p,hash),false);
 assert.equal((await passwordLogin(login(),{...e,CASHIER_PASSWORD_HASH:''})).status,503);
 assert.equal((await passwordLogin(login('incorrect testing passphrase'),e)).status,401);
 assert.equal((await passwordLogin(login(password,'https://attacker.example'),e)).status,403);
 assert.equal((await passwordLogin(login(),env(6))).status,429);
});
test('private cookie sessions expire, bind to this host and password, and cannot be replaced by identity headers',async()=>{
 const e=env(),response=await passwordLogin(login(),e);assert.equal(response.status,303);
 const cookie=response.headers.get('Set-Cookie');for(const part of ['__Host-tlpt-session=','HttpOnly','Secure','SameSite=Strict','Path=/','Max-Age=43200'])assert.ok(cookie.includes(part));
 const value=cookie.split(';')[0],request=new Request('https://cashier.example/api/register',{headers:{Cookie:value}});
 assert.deepEqual(await authorizeOwner(request,e),{id:'cashier-owner',email:e.OWNER_EMAIL});
 assert.equal(await passwordOwner(new Request('https://another.example/api/register',{headers:{Cookie:value}}),e),null);
 assert.equal(await passwordOwner(request,{...e,SESSION_SECRET:randomBytes(32).toString('base64url')}),null);
 assert.equal(await passwordOwner(request,{...e,CASHIER_PASSWORD_HASH:hash.slice(0,-1)+(hash.endsWith('A')?'B':'A')}),null);
 assert.equal(await passwordOwner(new Request(request,{headers:{Cookie:value+'; '+value}}),e),null);
 assert.equal(await authorizeOwner(new Request(request,{headers:{'Cf-Access-Jwt-Assertion':'fake','x-tlpt-authenticated-user-id':'fake'}}),e),null);
 const token=value.split('=')[1],claims=JSON.parse(Buffer.from(token.split('.')[1],'base64url'));assert.equal(claims.exp-claims.iat,43200);
});
test('logout requires a same-origin POST and clears the secure session',()=>{
 assert.equal(passwordLogout(new Request('https://cashier.example/auth/logout')).status,405);
 assert.equal(passwordLogout(new Request('https://cashier.example/auth/logout',{method:'POST',headers:{Origin:'https://attacker.example'}})).status,403);
 const result=passwordLogout(new Request('https://cashier.example/auth/logout',{method:'POST',headers:{Origin:'https://cashier.example'}}));assert.equal(result.status,303);assert.ok(result.headers.get('Set-Cookie').includes('Max-Age=0'));
});
