import {Rejected,requireValue,publicFeed,publicPlayer,playerView,applyOperation} from './model.mjs';
const encoder=new TextEncoder();
export const hash=async s=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(s)))).map(x=>x.toString(16).padStart(2,'0')).join('');
export const random=()=>Array.from(crypto.getRandomValues(new Uint8Array(32))).map(x=>x.toString(16).padStart(2,'0')).join('');
const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'self'; img-src 'self' https://tlpt.org; style-src 'self'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"};
function json(value,status=200,extra={}){return new Response(JSON.stringify(value),{status,headers:{...headers,'Content-Type':'application/json',...extra}});}
async function read(db){const row=await db.prepare('SELECT body FROM rsvp_state WHERE id=1').first();requireValue(row,'RSVP service awaiting setup.',503);return JSON.parse(row.body);}
async function update(db,actor,op){
 for(let i=0;i<10;i++){
  const state=await read(db),revision=state.revision;requireValue(actor.role==='admin'?actor.generation===state.adminGeneration:state.players.some(p=>p.slug===actor.slug&&p.generation===actor.generation),'Your private link was replaced. Ask The Commish for the new link.',401);
  applyOperation(state,actor,op);
  const result=await db.prepare('UPDATE rsvp_state SET revision=?,body=? WHERE id=1 AND revision=?').bind(state.revision,JSON.stringify(state),revision).run();if(result.meta.changes)return state;
 }
 throw new Rejected('Busy saving other responses. Please try again.',409);
}
async function identity(req,env,state){
 const token=(req.headers.get('Cookie')||'').match(/(?:^|;\s*)tlpt_rsvp=([a-f0-9]{64})(?:;|$)/)?.[1];requireValue(token,'Open your private link to sign in.',401);
 const session=await env.DB.prepare('SELECT * FROM sessions WHERE hash=? AND expires>?').bind(await hash(token),Date.now()).first();requireValue(session,'Your session expired. Reopen your private link.',401);
 const valid=session.role==='admin'?session.generation===state.adminGeneration:state.players.some(p=>p.slug===session.slug&&p.generation===session.generation&&p.linkHash);
 requireValue(valid,'This link has been revoked. Ask The Commish for a new link.',401);return session;
}
async function body(req){requireValue(req.headers.get('Content-Type')?.split(';')[0]==='application/json','JSON required.',415);requireValue(Number(req.headers.get('Content-Length')||0)<=12000,'Request too large.',413);const t=await req.text();requireValue(t.length<=12000,'Request too large.',413);try{return JSON.parse(t);}catch{throw new Rejected('Invalid request.');}}
async function limited(req,env){
 const key=await hash((req.headers.get('CF-Connecting-IP')||'local')+':'+Math.floor(Date.now()/60000));
 const row=await env.DB.prepare('INSERT INTO rate_limits(key,count,expires) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count').bind(key,Date.now()+120000).first();requireValue(row.count<=60,'Too many attempts. Try again in a minute.',429);
}
export default {async fetch(req,env,ctx){
 const url=new URL(req.url),path=url.pathname;
 try{
  if(path==='/api/version')return json({app:'tlpt-rsvp',revision:env.REVISION});
  if(path==='/api/public/events'&&req.method==='GET'){
   const response=json(publicFeed(await read(env.DB)),200,{'Access-Control-Allow-Origin':'*','Cache-Control':'public, max-age=0, must-revalidate'});return response;
  }
  if(path==='/api/public/posters'&&req.method==='GET'){
   try{const r=await fetch('https://tlpt.org/images/fw/gallery-manifest.json',{signal:AbortSignal.timeout(5000)});requireValue(r.ok,'Gallery unavailable.',503);const gallery=await r.json();requireValue(gallery.folder==='images/fw'&&Array.isArray(gallery.files),'Gallery unavailable.',503);return json({posters:gallery.files.filter(f=>typeof f==='string'&&/^fw\d{2}-\d{2}-\d{2}\.jpg$/.test(f)).slice(0,500).map(file=>({file,date:`20${file.slice(2,10)}`,url:`https://tlpt.org/images/fw/${file}`,thumbnailUrl:`https://tlpt.org/images/fw/thumbs/${file}`}))},200,{'Cache-Control':'public, max-age=300'});}catch{return json({posters:[],unavailable:true});}
  }
  if(!path.startsWith('/api/')){const res=await env.ASSETS.fetch(req);return new Response(res.body,{status:res.status,headers:{...Object.fromEntries(res.headers),...headers}});}
  requireValue(['GET','POST'].includes(req.method),'Method not allowed.',405);
  if(req.method==='POST'){requireValue(req.headers.get('Origin')===url.origin,'Open this page directly to save.',403);await limited(req,env);}
  const state=await read(env.DB);
  if(path==='/api/exchange'&&req.method==='POST'){
   const b=await body(req);requireValue(typeof b.key==='string'&&/^[a-f0-9]{64}$/.test(b.key),'Invalid private link.',401);
   const h=await hash(b.key),admin=state.adminHash===h,p=state.players.find(p=>p.linkHash===h);requireValue(admin||p,'This private link is invalid or was replaced.',401);
   const token=random();await env.DB.batch([env.DB.prepare('DELETE FROM sessions WHERE expires<?').bind(Date.now()),env.DB.prepare('DELETE FROM rate_limits WHERE expires<?').bind(Date.now()),env.DB.prepare('INSERT INTO sessions(hash,role,slug,generation,expires) VALUES(?,?,?,?,?)').bind(await hash(token),admin?'admin':'player',p?.slug||null,admin?state.adminGeneration:p.generation,Date.now()+7*86400000)]);
   return json({role:admin?'admin':'player'},200,{'Set-Cookie':`tlpt_rsvp=${token}; Secure; HttpOnly; SameSite=Strict; Path=/; Max-Age=604800`});
  }
  const actor=await identity(req,env,state);
  if(path==='/api/me'&&req.method==='GET')return json(actor.role==='admin'?{role:'admin',players:state.players.map(publicPlayer),events:publicFeed(state).events,allEvents:state.events.map(e=>({id:e.id,archived:e.archived,cancelled:!!e.cancelled,deletedAt:e.deletedAt||null,metadata:e.metadata,capacity:e.capacity,open:e.open})),revision:state.revision}:{role:'player',...playerView(state,actor.slug)});
  if(path==='/api/logout'&&req.method==='POST'){
   await env.DB.prepare('DELETE FROM sessions WHERE hash=?').bind(actor.hash).run();return json({ok:true},200,{'Set-Cookie':'tlpt_rsvp=; Secure; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'});
  }
  if(path==='/api/backup'&&req.method==='GET'){requireValue(actor.role==='admin','Commish only.',403);return json({...state,adminHash:undefined,players:state.players.map(publicPlayer)},200,{'Content-Disposition':'attachment; filename="tlpt-rsvp-backup.json"'});}
  if(path==='/api/action'&&req.method==='POST'){
   const b=await body(req);requireValue(b.type!=='link'||actor.role==='admin','Commish only.',403);
   const key=b.type==='link'&&!b.revoke?random():null;
   // These values can only be generated server-side, never from caller input.
   const op={...b,newId:crypto.randomUUID(),hash:key?await hash(key):null};
   const saved=await update(env.DB,actor,op);return json({ok:true,revision:saved.revision,...(key?{privateLink:`${url.origin}/#key=${key}`}:{})});
  }
  throw new Rejected('Not found.',404);
 }catch(e){return json({error:e instanceof Rejected?e.message:'RSVP service unavailable. Your answer was not saved. Please try again later.'},e instanceof Rejected?e.status:503);}
}};
