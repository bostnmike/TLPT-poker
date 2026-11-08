import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
test('Commish opens lineups by default, preserves valid activities, and routes notification deep links to their task',()=>{
 const context={URLSearchParams};vm.createContext(context);
 vm.runInContext(source.match(/^const activities=.*$/m)[0]+source.match(/^function initialActivity\(search\).*$/m)[0]+';this.initial=initialActivity;',context);
 for(const query of ['','?commish=1','?commish=1&activity=unknown'])assert.equal(context.initial(query),'lineups');
 for(const activity of ['lineups','responses','event','message','poll','results','player','coffee','settings'])assert.equal(context.initial('?commish=1&activity='+activity),activity);
 assert.equal(context.initial('?commish=1&event=e1'),'responses');assert.equal(context.initial('?commish=1&poll=p1'),'results');assert.equal(context.initial('?commish=1&poll=p1&activity=message'),'message');
});
test('lineup actions are Commish-only; dated closed games can open while undated games stay disabled',()=>{
 const context={HOST:'bostnmike',esc:s=>String(s).replaceAll('<','&lt;'),dateLabel:s=>s,person:s=>s,waitlistMarkup:()=>'',lineup:()=>'',posterMarkup:()=>'',playerName:s=>s,playerPreview:false,busy:false,viewer:{role:'admin'},viewingPlayer:()=>context.viewer};vm.createContext(context);
 vm.runInContext(source.match(/^function eventCard\(e\)\{[^]*?^}/m)[0]+';this.card=eventCard;',context);
 const event={id:'game',slot:'sunday',day:'Sunday',title:'Sunday',date:'2030-01-06',time:'7 PM',endTime:'11 PM',format:'50K',location:'Room',capacity:9,rsvpOpen:false,rsvps:{bostnmike:'yes'},waitlist:[]};
 assert.match(context.card(event),/data-open-event="game"[^>]*>Open RSVPs/);assert.match(context.card({...event,rsvpOpen:true}),/>Close RSVPs<\/button>/);
 assert.match(context.card({...event,date:'Date TBD'}),/data-open-event="game" disabled/);
 assert.match(context.card(event),/data-closeout-event="game" disabled/);assert.match(context.card({...event,date:'Date TBD'}),/data-closeout-event="game" disabled/);const available=context.card({...event,closeoutAvailable:true});assert.match(available,/data-closeout-event="game"[^>]*>Close out event/);assert.ok(!available.includes('data-closeout-event="game" disabled'));
 const pending=context.card({...event,closeoutAvailable:true,closeoutPending:true});assert.match(pending,/Resume close-out/);assert.ok(!pending.includes('data-open-event'));assert.ok(!pending.includes('data-edit-event'));assert.ok(!pending.includes('data-manage-event'));
 context.viewer=null;assert.ok(!context.card(event).includes('data-open-event'));assert.ok(!context.card(event).includes('data-edit-event'));assert.ok(!context.card(event).includes('data-manage-event'));assert.ok(!context.card({...event,closeoutAvailable:true}).includes('data-closeout-event'));
});

test('player coffee controls require a selected player and remain disabled in Commish preview',()=>{
 const context={HOST:'bostnmike',esc:s=>s,dateLabel:s=>s,person:s=>s,waitlistMarkup:()=>'',lineup:()=>'',posterMarkup:()=>'',playerName:s=>s,playerPreview:false,busy:false,viewer:null,viewingPlayer:()=>context.viewer};vm.createContext(context);
 vm.runInContext(source.match(/^function eventCard\(e\)\{[^]*?^}/m)[0]+';this.card=eventCard;',context);
 const event={id:'game',slot:'friday',day:'Friday',title:'Coffee game',date:'2030-01-04',time:'7 PM',endTime:'11 PM',format:'40K',location:'Room',capacity:9,rsvpOpen:true,rsvps:{bostnmike:'yes'},waitlist:[]};
 assert.match(context.card(event),/data-coffee-event="game" disabled/);
 context.viewer={role:'player',player:{slug:'red'},responses:{}};assert.match(context.card(event),/data-coffee-event="game" >Coffee pre-order/);
 context.playerPreview=true;assert.match(context.card(event),/data-coffee-event="game" disabled/);
 context.viewer={role:'admin'};assert.ok(!context.card(event).includes('data-coffee-event'));
});
