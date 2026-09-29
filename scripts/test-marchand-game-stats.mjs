import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=name=>JSON.parse(fs.readFileSync(new URL(`../data/${name}`,import.meta.url),'utf8'));
const stories=read('marchand-stories.json').artifacts;
const {meta,games}=read('marchand-game-stats.json');
const sec=t=>t.split(':').reduce((a,b)=>a*60+Number(b),0);
assert.equal(meta.games,Object.keys(games).length);
for(const story of Object.values(stories)){
 if (!story.gameId) { assert.ok(["Postponed","Unresolved"].includes(story.verification.status)); continue; }
 const game=games[story.gameId];assert.ok(game);assert.equal(game.date,story.date);
 assert.equal(game.reportNote,undefined,`Missing official report ${story.gameId}`);
 assert.equal(Object.keys(game.stats).length,13);
 if(game.status!=='Played')continue;
 for(const [key,value] of Object.entries(game.stats)){
  if(key.endsWith('Toi'))assert.match(value,/^\d+:\d{2}$/);
  else {assert.ok(Number.isInteger(value));if(key!=='plusMinus')assert.ok(value>=0);}
 }
 assert.equal(game.stats.goals+game.stats.assists,game.stats.points);
 assert.equal(sec(game.stats.evenStrengthToi)+sec(game.stats.powerPlayToi)+sec(game.stats.shortHandedToi),sec(game.stats.totalToi));
 for(const key of ['goals','assists','points','shots'])assert.equal(game.stats[key],story.verification.marchand[key]);
 for(const source of game.sources)assert.match(source.url,/^https:\/\/(api-web\.nhle\.com|www\.nhl\.com)\//);
 assert.equal(game.sources.length,2);
}
assert.equal(games['2018020514'].stats.powerPlayToi,'03:32');
assert.equal(games['2018020514'].stats.shortHandedToi,'00:35');
console.log(`PASS: all 13 statistics verified for ${meta.games} games / ${Object.keys(stories).length} artifacts.`);
