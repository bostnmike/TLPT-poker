import {test} from 'node:test';
import assert from 'node:assert/strict';
import {privateCommishKey,initCommishSignIn} from '../public/commish.mjs';
const origin='https://rsvp.test',key='a'.repeat(64),link=origin+'/?commish=1#key='+key;
function fixture(reply={role:'admin'},ok=true,offline=false){
 const input={value:link},status={textContent:''},button={disabled:false},calls=[];let submit,reloads=0;
 const form={querySelector:()=>button,addEventListener(type,fn){submit=fn;}};
 const doc={querySelector:s=>({'#commish-sign-in-form':form,'#commish-sign-in-link':input,'#commish-sign-in-status':status}[s])};
 const win={location:{origin,reload(){reloads++;}},async fetch(path,options){assert.equal(input.value,'','Clear the private link before transmitting it');calls.push({path,options});if(offline)throw Error('Network unavailable');return {ok,json:async()=>reply};}};
 initCommishSignIn(win,doc);return {input,status,button,calls,submit:()=>submit({preventDefault(){}}),reloads:()=>reloads};
}
test('Commish paste accepts only a complete private link for this origin and entry point',()=>{
 assert.equal(privateCommishKey(' '+link+' ',origin),key);
 for(const value of [key,origin+'/?commish=1',origin+'/#key='+key,link.replace(origin,'https://evil.test'),link.replace('#key=','#wrong='),link.replace('/?','/other?')])assert.throws(()=>privateCommishKey(value,origin),/full private Commish link/);
});
test('installed-app sign-in exchanges the pasted link without storing it or navigating to a key URL',async()=>{
 const f=fixture();await f.submit();assert.equal(f.reloads(),1);assert.equal(f.input.value,'');assert.equal(f.button.disabled,false);
 assert.equal(f.calls[0].path,'/api/exchange');assert.equal(f.calls[0].options.cache,'no-store');assert.equal(f.calls[0].options.credentials,'same-origin');assert.deepEqual(JSON.parse(f.calls[0].options.body),{key});
});
test('bad input, invalid credentials and player credentials cannot claim Commish sign-in',async()=>{
 const bad=fixture();bad.input.value='https://evil.test/#key='+key;await bad.submit();assert.equal(bad.calls.length,0);assert.equal(bad.input.value,'');
 for(const [reply,ok] of [[{error:'This private link is invalid or was replaced.'},false],[{role:'player'},true]]){
  const f=fixture(reply,ok);await f.submit();assert.equal(f.reloads(),0);assert.equal(f.input.value,'');assert.equal(f.button.disabled,false);assert.match(f.status.textContent,/private link|Commish link/);
 }
});
test('a failed network exchange leaves sign-in retryable without retaining the private link',async()=>{
 const f=fixture(undefined,true,true);
 await f.submit();assert.equal(f.reloads(),0);assert.equal(f.button.disabled,false);assert.equal(f.input.value,'');
});
