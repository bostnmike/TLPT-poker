import {test} from 'node:test';
import assert from 'node:assert/strict';
import {publicPlayer,comparePlayers,publicFeed} from '../model.mjs';
test('ButtonMan is display-only; saved RSVP identity, image and responses are preserved',()=>{
 const player={slug:'li-fo',name:'Li-Fo',image:'images/players/li-fo.jpg',rosterStatus:'active',linkHash:'private',generation:2};
 const state={revision:9,updatedAt:'2026-10-26',players:[player],events:[]};
 const before=JSON.stringify(state),view=publicPlayer(player);
 assert.equal(view.name,'ButtonMan');
 assert.equal(view.slug,'li-fo');assert.equal(view.image,player.image);
 assert.equal(view.linkHash,undefined);
 assert.equal(publicFeed(state).players[0].name,view.name);
 assert.ok(comparePlayers(player,{slug:'cougar',name:'Cougar'})<0);
 assert.equal(JSON.stringify(state),before);
});

test('Piercen retains his saved identity, avatar and RSVP response',()=>{
 const player={slug:'p',name:'P',image:'images/players/piercen-craig-v2.webp',rosterStatus:'active'};
 const event={id:'game',metadata:{slot:'saturday',date:'2026-11-21'},capacity:9,open:true,responses:{p:{answer:'yes',order:1}}};
 const state={players:[player],events:[event]};
 const before=structuredClone(state);
 const feed=publicFeed(state);
 assert.deepEqual(feed.players,[{...player,name:'Piercen'}]);
 assert.equal(feed.events[0].rsvps.p,'yes');
 assert.deepEqual(feed.events[0].requestedIn,['p']);
 assert.deepEqual(state,before);
});
