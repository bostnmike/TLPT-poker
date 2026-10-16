import {test} from 'node:test';
import assert from 'node:assert/strict';
import gateway from '../domain-gateway/_worker.js';

test('domain gateway preserves the custom origin, request body, and private response headers for cashier authentication',async()=>{
 const request=new Request('https://cashier.tlpt.org/auth/login',{method:'POST',headers:{Origin:'https://cashier.tlpt.org','Content-Type':'application/x-www-form-urlencoded'},body:'password=disposable-test-password'});
 let forwarded;
 const expected=new Response(null,{status:303,headers:{Location:'/', 'Set-Cookie':'__Host-tlpt-session=disposable; Secure; HttpOnly; SameSite=Strict; Path=/','Cache-Control':'private, no-store'}});
 const result=await gateway.fetch(request,{CASHIER:{fetch:async incoming=>{forwarded=incoming;return expected;}}});
 assert.equal(forwarded,request);assert.equal(forwarded.url,'https://cashier.tlpt.org/auth/login');assert.equal(forwarded.headers.get('Origin'),'https://cashier.tlpt.org');assert.equal(await forwarded.text(),'password=disposable-test-password');
 assert.equal(result.status,303);assert.equal(result.headers.get('Location'),'/');assert.match(result.headers.get('Set-Cookie'),/HttpOnly/);assert.equal(result.headers.get('Cache-Control'),'private, no-store');
});
test('domain gateway preserves cashier denials and fails closed when the service binding is absent',async()=>{
 const request=new Request('https://cashier.tlpt.org/api/register');
 const denied=await gateway.fetch(request,{CASHIER:{fetch:async()=>new Response('Sign in',{status:401})}});assert.equal(denied.status,401);
 const missing=await gateway.fetch(request,{});assert.equal(missing.status,503);assert.equal(missing.headers.get('Cache-Control'),'private, no-store');
});
