import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {noGameDays} from '../schedule-notices.mjs';
import {publicFeed} from '../model.mjs';
const monday = new Date('2026-10-26T16:00:00Z');
const event = (date,extra={}) => ({metadata:{date,slot:'saturday'},...extra});
test('cancelled Friday gets a dated notice; a real Saturday game does not',()=>{
 assert.deepEqual(noGameDays([event('2026-10-30',{cancelled:true}),event('2026-10-31',{open:true})],monday),[{date:'2026-10-30',day:'Friday',label:'NO GAME THIS FRIDAY'}]);
});
test('both missing days appear; future games and TBD do not mask this weekend',()=>{
 assert.equal(noGameDays([event('2026-11-06'),event('Date TBD')],monday).length,2);
});
test('closed RSVP game and MTT count as scheduled by date, not format',()=>{
 assert.equal(noGameDays([event('2026-10-30',{open:false}),{metadata:{date:'2026-10-31',slot:'mtt'},open:false}],monday).length,0);
});
test('removed games do not hide notices; a replacement on the same date does',()=>{
 for(const status of [{cancelled:true},{archived:true},{deletedAt:'2026-10-25'}])assert.equal(noGameDays([event('2026-10-30',status)],monday).length,2);
 assert.equal(noGameDays([event('2026-10-30',{cancelled:true}),event('2026-10-30')],monday)[0].day,'Saturday');
});
test('Eastern midnight removes elapsed Friday without labelling next Friday this Friday',()=>{
 assert.equal(noGameDays([],new Date('2026-10-31T03:59:59Z')).length,2);
 assert.deepEqual(noGameDays([],new Date('2026-10-31T04:00:00Z')).map(n=>n.date),['2026-10-31']);
});
test('Sunday rolls to next weekend, including DST and year boundaries',()=>{
 assert.deepEqual(noGameDays([],new Date('2026-11-01T17:00:00Z')).map(n=>n.date),['2026-11-06','2026-11-07']);
 assert.deepEqual(noGameDays([],new Date('2026-12-31T17:00:00Z')).map(n=>n.date),['2027-01-01','2027-01-02']);
});
test('public feed notices roll over even if no event was edited',()=>{
 const state={players:[],events:[],revision:9,updatedAt:'unchanged'};
 const friday=publicFeed(state,new Date('2026-10-30T16:00:00Z'));
 const saturday=publicFeed(state,new Date('2026-10-31T16:00:00Z'));
 assert.equal(friday.revision,saturday.revision);
 assert.equal(friday.noGameDays.length,2);assert.equal(saturday.noGameDays.length,1);
});
test('main site and RSVP app use identical notice styling',()=>{
 assert.equal(readFileSync(new URL('../../schedule-notices.css',import.meta.url),'utf8'),readFileSync(new URL('../public/schedule-notices.css',import.meta.url),'utf8'));
});
