import {requireValue,HOST,publicPlayer} from './model.mjs';
import {commishRecipient} from './notifications.mjs';
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
function recipients(state){return {generation:commishRecipient(state),slugs:JSON.stringify(state.players.filter(p=>p.slug!==HOST).map(p=>p.slug))};}
// A browser enrolled in both roles receives one copy, addressed to Commish.
const audience=`WITH recipients AS (
 SELECT id,binding,1 AS commish,slug FROM commish_push_subscriptions WHERE slug=?
 UNION ALL SELECT id,binding,0 AS commish,slug FROM push_subscriptions
 WHERE slug IN (SELECT value FROM json_each(?)) AND endpoint NOT IN
 (SELECT endpoint FROM commish_push_subscriptions WHERE slug=?)
) `;
function audienceStatement(db,state,sql){const {generation,slugs}=recipients(state);return db.prepare(audience+sql).bind(generation,slugs,generation);}
export async function broadcastOverview(db,state){
 const counts=await audienceStatement(db,state,'SELECT COUNT(*) AS devices,COUNT(DISTINCT CASE WHEN commish=0 THEN slug END) AS players,SUM(commish) AS commishDevices FROM recipients').first();
 const {results}=await db.prepare('SELECT * FROM broadcasts ORDER BY created_at DESC,id DESC LIMIT 10').all();
 return {audience:{...counts,commishDevices:counts.commishDevices||0},recent:await Promise.all(results.map(row=>present(db,state,row,true)))};
}
async function present(db,state,row,admin=false){
 const options=JSON.parse(row.options),{results:votes}=await db.prepare('SELECT slug,choice FROM poll_votes WHERE poll_id=?').bind(row.id).all(),current=votes.filter(v=>state.players.some(p=>p.slug===v.slug));
 return {id:row.id,kind:row.kind,title:row.title,body:row.body,options,createdAt:row.created_at,closed:!!row.closed,devices:admin?row.devices:undefined,
 counts:options.map((_,i)=>current.filter(v=>v.choice===i).length),votes:current.map(v=>({slug:v.slug,choice:v.choice,...(admin?{name:publicPlayer(state.players.find(p=>p.slug===v.slug)).name}:{})}))};
}
export async function publicPolls(db,state){const {results}=await db.prepare("SELECT * FROM broadcasts WHERE kind='poll' ORDER BY closed,created_at DESC LIMIT 10").all();return {polls:await Promise.all(results.map(row=>present(db,state,row)))};}
export async function sendBroadcast(db,state,b,now=Date.now()){
 requireValue(uuid.test(b?.id||''),'Reload the announcement form and try again.');
 requireValue(['announcement','poll'].includes(b.kind),'Choose announcement or poll.');
 const title=typeof b.title==='string'?b.title.trim():'',body=typeof b.body==='string'?b.body.trim():'';
 requireValue(title.length>0&&title.length<=80,'Enter a title or question, up to 80 characters.');
 requireValue(body.length<=300&&(b.kind==='poll'||body.length>0),'Enter a message, up to 300 characters.');
 const options=b.kind==='poll'&&Array.isArray(b.options)?b.options.map(o=>typeof o==='string'?o.trim():''):[];
 requireValue(b.kind!=='poll'||options.length>=2&&options.length<=4&&options.every(o=>o.length>0&&o.length<=60)&&new Set(options.map(o=>o.toLowerCase())).size===options.length,'Enter two to four different choices, up to 60 characters each.');
 const serialized=JSON.stringify(options),existing=await db.prepare('SELECT * FROM broadcasts WHERE id=?').bind(b.id).first();
 if(existing){requireValue(existing.kind===b.kind&&existing.title===title&&existing.body===body&&existing.options===serialized,'This send was already used for a different message. Start a new one.',409);return {ok:true,id:b.id,devices:existing.devices,duplicate:true};}
 const {generation,slugs}=recipients(state),payload={kind:'announcement',announcementId:b.id,title,body:body||(b.kind==='poll'?'The Commish wants your vote. Tap to weigh in.':''),poll:b.kind==='poll'};
 await db.batch([
  db.prepare(audience+`INSERT OR IGNORE INTO broadcasts(id,kind,title,body,options,created_at,devices) SELECT ?,?,?,?,?,?,COUNT(*) FROM recipients`).bind(generation,slugs,generation,b.id,b.kind,title,body,serialized,now),
  db.prepare(audience+`INSERT OR IGNORE INTO push_jobs(id,subscription_id,binding,payload,created_at,next_attempt)
   SELECT 'broadcast:' || ? || ':' || id,id,binding,json_set(?, '$.commish',json(CASE WHEN commish=1 THEN 'true' ELSE 'false' END),'$.recipient',CASE WHEN commish=1 THEN ? ELSE slug END,'$.url',CASE WHEN commish=1 THEN '/?commish=1' ELSE '/' END || CASE WHEN ?=1 THEN CASE WHEN commish=1 THEN '&poll=' ELSE '?poll=' END || ? ELSE '' END),?,? FROM recipients WHERE changes()>0`).bind(generation,slugs,generation,b.id,JSON.stringify(payload),generation,b.kind==='poll'?1:0,b.id,now,now)
 ]);
 const saved=await db.prepare('SELECT * FROM broadcasts WHERE id=?').bind(b.id).first();
 requireValue(saved.kind===b.kind&&saved.title===title&&saved.body===body&&saved.options===serialized,'This send was already used for a different message. Start a new one.',409);
 return {ok:true,id:b.id,devices:saved.devices};
}
export async function vote(db,state,b,now=Date.now()){
 requireValue(state.players.some(p=>p.slug===b?.slug),'Choose your player name first.');
 requireValue(Number.isInteger(b.choice)&&b.choice>=0&&b.choice<4,'Choose a poll option.');
 const result=await db.prepare(`INSERT INTO poll_votes(poll_id,slug,choice,updated_at)
 SELECT id,?,?,? FROM broadcasts WHERE id=? AND kind='poll' AND closed=0 AND json_array_length(options)>?
 ON CONFLICT(poll_id,slug) DO UPDATE SET choice=excluded.choice,updated_at=excluded.updated_at`).bind(b.slug,b.choice,now,b.pollId,b.choice).run();
 requireValue(result.meta.changes,'This poll is closed or unavailable.',409);return {ok:true};
}
export async function closePoll(db,id){const r=await db.prepare("UPDATE broadcasts SET closed=1 WHERE id=? AND kind='poll'").bind(id).run();requireValue(r.meta.changes,'Poll not found.',404);return {ok:true};}
