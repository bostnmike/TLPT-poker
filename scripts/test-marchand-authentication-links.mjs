import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const script=fs.readFileSync(new URL('../marchand.js',import.meta.url),'utf8');
const {records}=JSON.parse(fs.readFileSync(new URL('../data/marchand-pucks.json',import.meta.url)));
const report=JSON.parse(fs.readFileSync(new URL('../docs/marchand-authentication-links-20261005.json',import.meta.url)));
const element=()=>({children:[],listeners:{},append(...items){this.children.push(...items)},replaceChildren(...items){this.children=items},addEventListener(type,fn){this.listeners[type]=fn}});
const panels=Object.fromEntries(['artifact-authentication','artifact-authentication-links','artifact-authentication-instructions'].map(id=>[id,element()]));
let copied='';
const context={document:{getElementById:id=>panels[id],createElement:element},navigator:{clipboard:{async writeText(value){copied=value}}}};
vm.createContext(context);
vm.runInContext(script.slice(script.indexOf('  function renderAuthentication(record) {'),script.indexOf('  function renderSourceRecord(record) {')),context);
let links=0;
for(const record of records){
 context.renderAuthentication(record);
 const expected=report.records.find(row=>row.inventoryId===record.inventoryId);
 assert.equal(panels['artifact-authentication'].hidden,!expected,record.key);
 if(!expected) continue;
 const rows=panels['artifact-authentication-links'].children;
 assert.equal(rows.length,expected.entries.filter(entry=>entry.url).length,record.key);
 for(const [i,row] of rows.entries()){
  const link=row.children[1];
  assert.equal(link.textContent,'Look Up Authentication Record');
  assert.equal(link.href,expected.entries[i].url);assert.equal(link.target,'_blank');
  assert.equal(link.rel,'noopener noreferrer');links++;
  if(expected.entries[i].serial){await row.children[2].listeners.click();assert.equal(copied,expected.entries[i].serial)}else assert.equal(row.children.length,2);
 }
 for(const [label,key] of Object.entries(report.schema)){
  const field=record.sourceData.find(field=>field.label===label);
  assert.equal(field.value,record[key],`${record.key} ${label} drift`);
  assert.equal(field.value,expected.fields[label]);
  if(label.endsWith('Record URL')&&field.value) assert.equal(field.url,field.value);
 }
}
context.renderAuthentication(records.find(row=>row.inventoryId===70));
context.renderAuthentication({authenticationRecordUrl:'javascript:alert(1)'});
assert.equal(panels['artifact-authentication'].hidden,true);
assert.equal(panels['artifact-authentication-links'].children.length,0);
assert.equal(panels['artifact-authentication-instructions'].textContent,'');
context.navigator.clipboard.writeText=async()=>{throw Error('Unavailable')};
context.renderAuthentication(records.find(row=>row.inventoryId===70));
const button=panels['artifact-authentication-links'].children[0].children[2];await button.listeners.click();assert.match(button.textContent,/AA0016994/);
assert.equal(records.find(row=>row.inventoryId===41).authenticationSerial,'673758E');
assert.equal(records.find(row=>row.inventoryId===502).authenticationSerial,'555680W');
for(const id of [334,335,341]){const row=records.find(row=>row.inventoryId===id);assert.equal(row.authenticationIssuer,'Fanatics');assert.match(row.authenticationAlternateIssuer,/NHL licensing/);assert.equal(row.authenticationAlternateRecordUrl,'')}
assert.match(records.find(row=>row.inventoryId===712).authenticationLookupInstructions,/photograph.*not yet been identified/);
const montreal=records.find(row=>row.inventoryId===77);
assert.equal(montreal.authenticationRecordUrl,'https://www.tricoloresports.com/us/service/authentique/');
assert.equal(montreal.authenticationSerial,'G009264');
assert.match(montreal.authenticationLookupInstructions,/rather than a public serial-number lookup/);
const coverage=JSON.parse(fs.readFileSync(new URL('../docs/marchand-authentication-coverage-20261005.json',import.meta.url)));
assert.equal(coverage.reviewedPreviouslyUnlinkedIds.length,90);
for(const evidence of coverage.newRoutes){
 const row=records.find(row=>row.inventoryId===evidence.inventoryId);
 assert.equal(row.authenticationSerial,evidence.serial);
 assert.ok(row.authenticationRecordUrl,`Missing photographed hologram route: ${evidence.inventoryId}`);
 context.renderAuthentication(row);assert.equal(panels['artifact-authentication'].hidden,false);
 if(evidence.issuer==='MeiGray' && evidence.serial)assert.equal(new URL(row.authenticationRecordUrl).searchParams.get('searchTerm'),evidence.serial);
}
assert.equal(records.find(row=>row.inventoryId===72).authenticationType,'COA / Supporting Document');
assert.equal(records.find(row=>row.inventoryId===72).authenticationSerial,'PHI101638');
assert.equal(records.find(row=>row.inventoryId===50).authenticationSerial,'PHI000599');
assert.equal(records.find(row=>row.inventoryId===11).authenticationSerial,'01724');
assert.match(records.find(row=>row.inventoryId===711).authenticationLookupInstructions,/discrepancy remains unresolved/);
console.log(`PASS: ${report.records.length} hologram records / ${links} links match reviewed evidence; direct routes, complete serials, dual issuers, clipboard fallback, unsafe URL rejection and artifact transitions verified.`);
