import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {signInPage} from '../lib/password-auth.mjs';
import {launchInstalledCashier} from '../public/cashier-install.mjs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url));
test('signed-in, signed-out and dedicated install pages offer the same fresh iPad icons and standalone app identity',async()=>{
 const pages=[read('index.html').toString(),await signInPage().text(),read('public/install.html').toString()];
 for(const html of pages){
  assert.match(html,/name="apple-mobile-web-app-capable" content="yes"/);
  assert.match(html,/name="apple-mobile-web-app-title" content="TLPT Cashier"/);
  assert.match(html,/rel="manifest" href="\/cashier-home.webmanifest"/);
  for(const size of [152,167,180])assert.ok(html.includes(`sizes="${size}x${size}" href="/cashier-home-chip-${size}.png"`));
 }
 const manifest=JSON.parse(read('public/cashier-home.webmanifest'));
 assert.equal(manifest.id,'/');assert.equal(manifest.start_url,'/');assert.equal(manifest.scope,'/');assert.equal(manifest.display,'standalone');assert.equal(manifest.name,'TLPT Cashier');
 assert.deepEqual(JSON.parse(read('public/manifest.webmanifest')),manifest);
 for(const size of [152,167,180,192,512]){
  const png=read(`public/cashier-home-chip-${size}.png`);
  assert.equal(png.subarray(1,4).toString(),'PNG');assert.equal(png.readUInt32BE(16),size);assert.equal(png.readUInt32BE(20),size);
  assert.deepEqual(png,read(`public/tlpt-cashier-yellow-${size}.png`),'Keep the exact existing poker-chip artwork');
 }
 for(const icon of manifest.icons)assert.ok(read('public'+icon.src).length>0);
});
test('an installed setup page opens the protected register in the same app window; a browser stays on setup',()=>{
 for(const [legacy,standalone,expected] of [[false,false,false],[true,false,true],[false,true,true]]){
  const calls=[],win={navigator:{standalone:legacy},matchMedia:()=>({matches:standalone}),location:{replace:path=>calls.push(path)}};
  assert.equal(launchInstalledCashier(win),expected);assert.deepEqual(calls,expected?['/']:[]);
 }
});
