import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const presetSource=source.match(/^function dayPreset\(slot\)\{[^\n]+/m)[0];
function preset(slot,allEvents=[]){const ctx={me:{allEvents}};vm.createContext(ctx);return vm.runInContext(presetSource+`;dayPreset(${JSON.stringify(slot)})`,ctx);}
test('Friday defaults start at 50/100, matching the canonical 40K first level',()=>{
 const config=readFileSync(new URL('../../site-src/app/03-blind-format-configuration.js',import.meta.url),'utf8');
 const levels=vm.runInNewContext(config+';RULES_FORMATS["40k"].levels');
 const first=levels.find(l=>l.type==='level');assert.equal(first.sb,'50');assert.equal(first.bb,'100');
 assert.match(preset('friday').structure,new RegExp(`Blinds start ${first.sb}/${first.bb} • 20 min levels`));
});
test('saved Friday descriptions cannot restore obsolete or abbreviated starting blinds',()=>{
 for(const structure of ['Blinds start 100/200 • 20 min levels • ~4.5 hour event','40K']){
  const result=preset('friday',[{metadata:{slot:'friday',structure,format:'40K Format',time:'7:00 PM'},capacity:9}]);
  assert.match(result.structure,/^Blinds start 50\/100 •/);assert.equal(result.format,'40K Format');assert.equal(result.time,'7:00 PM');assert.equal(result.capacity,9);
 }
});
test('Saturday and MTT keep their own presets',()=>{
 assert.match(preset('saturday').structure,/^Blinds start 500\/1000/);
 assert.match(preset('mtt').structure,/^50K starting stack/);
 const saved={slot:'saturday',structure:'Saved Saturday detail'};assert.equal(preset('saturday',[{metadata:saved,capacity:8}]).structure,saved.structure);
});

test('Sunday uses 50K with Friday blinds and nine seats even if a saved Sunday has custom details',()=>{
 for(const events of [[],[{metadata:{slot:'sunday',format:'Wrong stack',structure:'Wrong blinds'},capacity:18}]]){
  const sunday=preset('sunday',events);assert.equal(sunday.format,'50K Format');assert.match(sunday.structure,/50K starting stack/);assert.match(sunday.structure,/Friday blinds start 50\/100/);assert.match(sunday.structure,/20 min levels/);assert.equal(sunday.capacity,9);
 }
});
test('switching to Sunday resets its open switch without changing title, date or poster',()=>{
 const controls=Object.fromEntries(['format','structure','time','endTime','capacity','location','address','day'].map(k=>[k,{value:''}]));
 Object.assign(controls,{slot:{value:'sunday'},open:{checked:true},title:{value:'Keep my title'},date:{value:'2030-11-03'},poster:{value:'none'}});
 const form={elements:controls},ctx={me:{allEvents:[]},$:()=>form};vm.createContext(ctx);
 const apply=source.match(/^function applyDayPreset\(\)\{[^\n]+/m)[0];vm.runInContext(presetSource+';'+apply+';applyDayPreset()',ctx);
 assert.equal(controls.open.checked,false);assert.equal(controls.day.value,'Sunday');assert.equal(controls.capacity.value,9);assert.equal(controls.title.value,'Keep my title');assert.equal(controls.date.value,'2030-11-03');assert.equal(controls.poster.value,'none');
});
