import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const script = fs.readFileSync(new URL('../marchand.js', import.meta.url), 'utf8');
const render = script.slice(script.indexOf('  function renderSourceRecord(record) {'), script.indexOf('  function showPuckPlaceholder(record) {'));
const element = () => ({children: [], classList: {add() {}}, addEventListener() {}, append(...items) { this.children.push(...items); }, replaceChildren(...items) { this.children = items; }});
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
  SWEDEN_CREST: "images/site/team-sweden-three-crowns.png",
};
vm.createContext(context);
vm.runInContext(script.slice(script.indexOf('  const OPPONENT_CODES'), script.indexOf('  const ARENA_LOCATIONS')), context);
vm.runInContext(script.slice(script.indexOf('  function opponentLogo(record) {'), script.indexOf('  function opponentCell(record) {')), context);
vm.runInContext(script.slice(script.indexOf('  function opponentIdentity(record) {'), script.indexOf('  function addOpponentFact(record) {')), context);
vm.runInContext(render, context);
const record = {sourceSheet:'Test', inventoryId:1, sourceRow:2, sourceData:[
  ...[undefined, null, '', '  ', '—', '–', '-'].map(value=>({label:'Empty',value})),
  {label:'Zero',value:0}, {label:'False',value:false},
  {label:'Text',value:'Verified'}, {label:'URL only',value:'',url:'https://example.com'},
  {label:'Score',value:'BOS 6 @ NYI 3'}, {label:'Opponent',value:'New York Islanders'},
  {label:'Front Image Filename',value:'images/pucks/1/front.webp'},
  {label:'Original COA Filename',value:'IMG_1234.jpeg'},
  {label:'Authentication Evidence',value:'images/pucks/1/coa.webp'},
  {label:'Authentication Type',value:'COA / Supporting Document'},
  {label:'Authentication Notes',value:'Fanatics hologram visible in Back photograph.'},
]};
context.renderSourceRecord(record);
let fields = context.elements.sourceGrid.children[0].children;
assert.deepEqual(fields.map(f=>f.children[0].textContent), ['Zero','False','Text','URL only','Final Result','Opponent','Authentication Type','Authentication Notes']);
assert.equal(fields[0].children[1].textContent, 0);
assert.equal(fields[1].children[1].textContent, false);
assert.equal(fields[3].children[1].target, '_blank');
assert.equal(fields[4].children[1].textContent, 'BOS 6 @ NYI 3');
assert.equal(fields[5].children[1].children[0].children[0].src, 'https://assets.nhle.com/logos/nhl/svg/NYI_light.svg');
assert.equal(fields[5].children[1].children[1].textContent, 'New York Islanders');
assert.equal(context.opponentIdentity({opponent:'Sweden'}).children[0].children[0].src, context.SWEDEN_CREST);
const html = fs.readFileSync(new URL('../marchand.html', import.meta.url), 'utf8');
assert.match(html, /id="complete-record-title">Complete Database Record Detail<\/h4>/);
assert.match(script, /addFact\("Final Result", record\.score\)/);
const {records} = JSON.parse(fs.readFileSync(new URL('../data/marchand-pucks.json', import.meta.url)));
for (const record of records) {
  context.renderSourceRecord(record);
  fields = context.elements.sourceGrid.children[0].children;
  const populated = record.sourceData.filter(f=> !/image|filename|authentication evidence/i.test(f.label) && (String(f.url??'').trim() || (String(f.value??'').trim() && !/^[-–—]+$/.test(String(f.value).trim()))));
  assert.deepEqual(fields.map(f=>f.children[0].textContent), populated.map(f=>f.label === 'Score' ? 'Final Result' : f.label), record.key);
  const opponent = fields.find(f=>f.children[0].textContent === 'Opponent');
  if (opponent) {
    assert.equal(opponent.children[1].children[1].textContent, record.opponent, record.key);
    assert.ok(opponent.children[1].children[0].children[0].src, `${record.key} opponent logo missing`);
  }
}
console.log(`PASS: populated-only source record rendering for ${records.length} artifacts; image-reference fields and blank placeholders omitted; opponent logos, Final Result, authentication notes, zeros and source URLs retained.`);
