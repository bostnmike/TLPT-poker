import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {applyOperation,publicFeed} from '../model.mjs';
const visibility=readFileSync(new URL('../public/app.js',import.meta.url),'utf8').match(/^function eventsForView\(\)\{[^\n]+\}/m)[0];
test('Open RSVPs controls player and preview visibility while Commish retains closed games and saved replies',()=>{
 const metadata={title:'Saved game',format:'40K Format',structure:'20 minute levels',time:'7:00 PM',endTime:'11:30 PM',location:'Room',address:'Cary',date:'2026-11-06',slot:'friday',day:'Friday'};
 const responses={red:{answer:'yes',order:1}},state={revision:1,sequence:1,players:[{slug:'red',name:'Red'}],audit:[],events:[{id:'game',metadata,capacity:9,open:true,archived:false,responses}]};
 const ctx={feed:publicFeed(state),admin:false,playerPreview:false,commishMode:()=>ctx.admin};vm.createContext(ctx);vm.runInContext(visibility+';this.visible=eventsForView;',ctx);
 assert.equal(ctx.visible().length,1);
 const setOpen=open=>{applyOperation(state,{role:'admin'},{type:'event',eventId:'game',metadata,capacity:9,open});ctx.feed=publicFeed(state);};
 setOpen(false);assert.equal(ctx.visible().length,0);assert.equal(state.events[0].responses.red.answer,'yes');
 ctx.admin=true;assert.equal(ctx.visible().length,1,'Commish can edit and reopen the game');
 ctx.playerPreview=true;assert.equal(ctx.visible().length,0,'Player preview follows public visibility');
 ctx.playerPreview=false;ctx.admin=false;setOpen(true);assert.equal(ctx.visible()[0].id,'game');assert.equal(ctx.visible()[0].rsvps.red,'yes');
});
