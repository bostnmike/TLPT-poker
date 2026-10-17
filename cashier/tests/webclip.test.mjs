import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const read=path=>readFileSync(new URL('../public/'+path,import.meta.url));
test('the iPad installer contains exactly one removable full-screen Web Clip and the exact chip; no other settings or credentials',()=>{
 const parsed=spawnSync('python3',['-c',"import sys,plistlib,json,base64; p=plistlib.loads(sys.stdin.buffer.read()); p['PayloadContent'][0]['Icon']=base64.b64encode(p['PayloadContent'][0]['Icon']).decode(); print(json.dumps(p))"],{input:read('TLPT-Cashier.mobileconfig'),encoding:'utf8'});
 assert.equal(parsed.status,0,parsed.stderr);const profile=JSON.parse(parsed.stdout);
 assert.deepEqual(Object.keys(profile).sort(),['PayloadContent','PayloadDescription','PayloadDisplayName','PayloadIdentifier','PayloadOrganization','PayloadRemovalDisallowed','PayloadType','PayloadUUID','PayloadVersion'].sort());
 assert.equal(profile.PayloadType,'Configuration');assert.equal(profile.PayloadVersion,1);assert.equal(profile.PayloadDisplayName,'TLPT Cashier');assert.equal(profile.PayloadRemovalDisallowed,false);
 assert.equal(profile.PayloadContent.length,1);const clip=profile.PayloadContent[0];
 assert.deepEqual(Object.keys(clip).sort(),['PayloadType','PayloadVersion','PayloadIdentifier','PayloadUUID','PayloadDisplayName','PayloadDescription','Label','URL','FullScreen','IsRemovable','Precomposed','IgnoreManifestScope','Icon'].sort());
 assert.equal(clip.PayloadType,'com.apple.webClip.managed');assert.equal(clip.Label,'TLPT Cashier');assert.equal(clip.URL,'https://cashier.tlpt.org/');
 assert.equal(clip.FullScreen,true);assert.equal(clip.IsRemovable,true);assert.equal(clip.Precomposed,true);assert.equal(clip.IgnoreManifestScope,false);
 const uuid=/^[0-9A-F]{8}(?:-[0-9A-F]{4}){3}-[0-9A-F]{12}$/;assert.match(profile.PayloadUUID,uuid);assert.match(clip.PayloadUUID,uuid);assert.notEqual(profile.PayloadUUID,clip.PayloadUUID);
 const icon=Buffer.from(clip.Icon,'base64');assert.deepEqual(icon,read('cashier-home-chip-180.png'));assert.equal(icon.readUInt32BE(16),180);assert.equal(icon.readUInt32BE(20),180);
 const page=read('webclip.html').toString();assert.match(page,/href="\/TLPT-Cashier.mobileconfig"/);assert.match(page,/unsigned/);assert.match(page,/Remove Profile/);
});
