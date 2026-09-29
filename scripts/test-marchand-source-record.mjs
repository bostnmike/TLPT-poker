import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const script = fs.readFileSync(new URL('../marchand.js', import.meta.url), 'utf8');
const render = script.slice(script.indexOf('  function renderSourceRecord(record) {'), script.indexOf('  function showPuckPlaceholder(record) {'));
const element = () => ({children: [], append(...items) { this.children.push(...items); }, replaceChildren(...items) { this.children = items; }});
const context = {
  document: {createDocumentFragment: element, createElement: element},
  elements: {provenance: element(), sourceGrid: element()},
  state: {players: {}},
  collectionWing: value => value,
  displayDate: value => value,
  categoryLabel: value => value,
  puckTypeLabel: value => value,
  goalTypeLabel: value => value,
  goalieLabel: record => record.goalieScoredAgainst,
  puckLabel: record => record.puckType,
  sourceVideoUrl: record => record.videoUrl,
};
vm.createContext(context);
vm.runInContext(render, context);
const record = {sourceSheet:'Test', inventoryId:1, sourceRow:2, sourceData:[
  ...[undefined, null, '', '  ', '—', '–', '-'].map(value=>({label:'Empty',value})),
  {label:'Zero',value:0}, {label:'False',value:false},
  {label:'Text',value:'Verified'}, {label:'URL only',value:'',url:'https://example.com'},
]};
context.renderSourceRecord(record);
let fields = context.elements.sourceGrid.children[0].children;
assert.deepEqual(fields.map(f=>f.children[0].textContent), ['Zero','False','Text','URL only']);
assert.equal(fields[0].children[1].textContent, 0);
assert.equal(fields[1].children[1].textContent, false);
assert.equal(fields[3].children[1].target, '_blank');
const {records} = JSON.parse(fs.readFileSync(new URL('../data/marchand-pucks.json', import.meta.url)));
for (const record of records) {
  context.renderSourceRecord(record);
  fields = context.elements.sourceGrid.children[0].children;
  const populated = record.sourceData.filter(f=> String(f.url??'').trim() || (String(f.value??'').trim() && !/^[-–—]+$/.test(String(f.value).trim())));
  assert.equal(fields.length, populated.length, record.key);
}
console.log(`PASS: populated-only source record rendering for ${records.length} artifacts; blank placeholders omitted, zeros and URLs retained.`);
