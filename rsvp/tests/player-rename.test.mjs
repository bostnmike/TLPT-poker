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
