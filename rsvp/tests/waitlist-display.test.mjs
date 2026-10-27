import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const render=source.match(/^function waitlistMarkup\(e\)\{[^]*?^}/m)[0];
const ctx={esc:s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),person:slug=>slug};
vm.createContext(ctx);vm.runInContext(render+';this.markup=waitlistMarkup;',ctx);
test('a full table shows an empty waitlist and joining guidance before anyone is waiting',()=>{
 const event={title:'Friday',capacity:2,rsvpOpen:true,rsvps:{host:'yes',first:'yes',other:'maybe'},waitlist:[]};
 const html=ctx.markup(event);assert.match(html,/<h3>Waitlist<\/h3>/);assert.match(html,/0 waiting/);assert.match(html,/No one is waiting yet/);assert.match(html,/New In responses join/);
 event.capacity=3;assert.equal(ctx.markup(event),'');assert.equal(ctx.markup(null),'');
});
test('the visible waitlist preserves queue order and disappears once seats reopen',()=>{
 const event={title:'Saturday',capacity:2,rsvpOpen:true,rsvps:{host:'yes',first:'yes',z:'maybe',a:'maybe'},waitlist:[{slug:'z',position:1},{slug:'a',position:2}]};
 const html=ctx.markup(event);assert.match(html,/2 waiting/);assert.ok(html.indexOf('<li>z</li>')<html.indexOf('<li>a</li>'));assert.match(html,/next available seat/);
 event.capacity=3;event.rsvps.z='yes';event.waitlist=[{slug:'a',position:1}];assert.match(ctx.markup(event),/1 waiting/);
 event.capacity=5;event.rsvps.a='yes';event.waitlist=[];assert.equal(ctx.markup(event),'');
});
test('closed full tables do not invite new responses and event names remain escaped',()=>{
 const html=ctx.markup({title:'<unsafe>',capacity:1,rsvpOpen:false,rsvps:{host:'yes'},waitlist:[]});assert.match(html,/RSVPs are closed/);assert.ok(!html.includes('New In responses'));assert.match(html,/&lt;unsafe&gt;/);assert.ok(!html.includes('<unsafe>'));
});
