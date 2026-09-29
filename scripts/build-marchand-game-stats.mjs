import fs from 'node:fs';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import assert from 'node:assert/strict';
const run=promisify(execFile);
const root=path.resolve(import.meta.dirname,'..');
const cache=path.join(root,'tmp/game-stats-cache');
fs.mkdirSync(cache,{recursive:true});
const stories=JSON.parse(fs.readFileSync(path.join(root,'data/marchand-stories.json'),'utf8')).artifacts;
const games={};
const ids=[...new Set(Object.values(stories).map(s=>s.gameId).filter(Boolean))];
async function get(url,file){
  const target=path.join(cache,file);
  if(fs.existsSync(target))return fs.readFileSync(target,'utf8');
  const {stdout}=await run('curl',['-sL','--fail','--retry','2','--max-time','45',url],{maxBuffer:8e6});
  fs.writeFileSync(target,stdout);return stdout;
}
const seconds=t=>t.split(':').reduce((a,b)=>a*60+Number(b),0);
async function build(id){
  const boxUrl=`https://api-web.nhle.com/v1/gamecenter/${id}/boxscore`;
  const box=JSON.parse(await get(boxUrl,`${id}.json`));
  assert.equal(box.id,id);
  const year=Number(String(id).slice(0,4));
  const reportUrl=`https://www.nhl.com/scores/htmlreports/${year}${year+1}/ES${String(id).slice(4)}.HTM`;
  const player=Object.values(box.playerByGameStats).flatMap(t=>[...t.forwards,...t.defense]).find(p=>p.playerId===8473419);
  const game={date:box.gameDate,status:player?'Played':'Did Not Play',sources:[{label:'NHL box score',url:boxUrl}],stats:{}};
  const keys={goals:'goals',assists:'assists',points:'points',shots:'sog',totalToi:'toi',shifts:'shifts',plusMinus:'plusMinus',hits:'hits',blockedShots:'blockedShots',penaltyMinutes:'pim'};
  for(const [out,key] of Object.entries(keys))game.stats[out]=player?.[key]??null;
  for(const key of ['evenStrengthToi','powerPlayToi','shortHandedToi'])game.stats[key]=null;
  if(player){
    try{
      const html=await get(reportUrl,`${id}.html`);
      const cells=[...html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map(m=>[...m[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(m=>m[1].replace(/<[^>]+>/g,'').replace(/&nbsp;/g,'').trim())).find(c=>c[2]==='MARCHAND, BRAD');
      assert.ok(cells,`Marchand row missing ${id}`);
      assert.equal(seconds(cells[9]),seconds(player.toi),`TOI differs ${id}`);
      for(const [idx,k] of [[3,'goals'],[4,'assists'],[5,'points'],[6,'plusMinus'],[8,'pim'],[10,'shifts'],[15,'sog'],[18,'hits'],[21,'blockedShots']])assert.equal(Number(cells[idx]||0),player[k],`${id}: ${k} differs`);
      [game.stats.powerPlayToi,game.stats.shortHandedToi,game.stats.evenStrengthToi]=[cells[12],cells[13],cells[14]];
      assert.equal(seconds(cells[12])+seconds(cells[13])+seconds(cells[14]),seconds(player.toi),`TOI sum ${id}`);
      game.sources.push({label:'NHL official event report',url:reportUrl});
    }catch(error){game.reportNote=error.message;console.warn(`Report unavailable: ${id}: ${error.message}`);}
  }
  for(const s of Object.values(stories).filter(s=>s.gameId===id)){
    assert.equal(s.date,game.date);
    if(player)for(const k of ['goals','assists','points','shots'])assert.equal(s.verification.marchand[k],game.stats[k],`${id} existing story ${k}`);
  }
  games[id]=game;console.log(`${id}: ${game.status}${game.reportNote?' (partial)':''}`);
}
let index=0;
await Promise.all(Array.from({length:6},async()=>{while(index<ids.length)await build(ids[index++]);}));
const result={meta:{reviewedAt:new Date().toISOString().slice(0,10),playerId:8473419,games:ids.length,method:'Official NHL box scores cross-checked with event reports. Missing data is null, never an inferred zero.'},games:Object.fromEntries(Object.entries(games).sort())};
fs.writeFileSync(path.join(root,'data/marchand-game-stats.json'),JSON.stringify(result,null,2)+'\n');
console.log(`Saved ${ids.length} games; ${Object.values(games).filter(g=>g.reportNote).length} partial reports.`);
