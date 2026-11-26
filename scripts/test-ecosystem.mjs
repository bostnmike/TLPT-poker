import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const read=f=>fs.readFileSync(root+f,'utf8');
const html=read('ecosystem.html'), js=read('ecosystem.js');
const blocks=[...html.matchAll(/<script id="ecosystem-data" type="application\/json">([\s\S]*?)<\/script>/g)];
assert.equal(blocks.length,1);
const data=JSON.parse(blocks[0][1]);
assert.equal(data.nodes.length,9);assert.equal(data.edges.length,13);assert.equal(data.journeys.length,7);
assert.equal(data.journeys.reduce((n,j)=>n+j.steps.length,0),33);
const nodes=new Set(data.nodes.map(n=>n.id)), edges=new Map(data.edges.map(e=>[e.id,e]));
assert.equal(nodes.size,9);assert.equal(edges.size,13);
for(const edge of edges.values()){assert.ok(nodes.has(edge.from));assert.ok(nodes.has(edge.to));}
for(const journey of data.journeys){
 assert.ok(journey.steps.length);for(const step of journey.steps)assert.ok(step.nodeId?nodes.has(step.nodeId):edges.has(step.edgeId));
 for(const id of journey.nodeIds)assert.ok(nodes.has(id));for(const id of journey.edgeIds)assert.ok(edges.has(id));
}
assert.ok(edges.has('registration-avatars'));assert.ok(edges.has('registration-directory'));assert.ok(edges.has('avatars-directory'));
assert.doesNotMatch(js,/\b(?:fetch|XMLHttpRequest|WebSocket|sendBeacon)\s*\(/,'Explanatory page makes no operational reads or writes');
assert.doesNotMatch(html,/<script\b[^>]*\bsrc=["']app[.]js/);
assert.doesNotMatch(read('templates/site/navigation.json'),/ecosystem[.]html/);
assert.match(read('templates/site/footer.html'),/<a href="\{\{ROOT\}\}ecosystem[.]html">BostnMike Production<\/a>[.]{3}/);
const feltHash=createHash('sha256').update(fs.readFileSync(root+'images/site/winter-classic.png')).digest('hex').slice(0,16);
assert.ok(html.includes('images/site/winter-classic.png?v='+feltHash));
assert.match(html,/<symbol id="art-website" viewBox="110 75 700 350">/);
assert.match(html,/preserveAspectRatio="xMidYMid meet"/);
console.log('PASS: Behind the Cards inventory, 33 journey steps, registration branches, canonical felt and footer-only entry.');
