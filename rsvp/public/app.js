'use strict';
const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let me=null,feed=null,busy=false,players=[];
const chosen=new URLSearchParams(location.search).get('event');
const msg=(s,error=false)=>{$('#notice').textContent=s;$('#notice').className=error?'error':'';};
async function api(path,data){const r=await fetch('/api/'+path,{cache:'no-store',...(data?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)}:{})});const b=await r.json();if(!r.ok){const e=new Error(b.error||'Service unavailable.');e.status=r.status;throw e;}return b;}
const playerName=slug=>players.find(p=>p.slug===slug)?.name||slug;
function person(slug){const p=players.find(p=>p.slug===slug);return `${p?.image?`<img src="https://tlpt.org/${esc(p.image)}" alt="" loading="lazy">`:''}${esc(playerName(slug))}`;}
function eventCard(e){
 const count=Object.values(e.rsvps).filter(x=>x==='yes').length,own=me?.responses?.[e.id],wait=e.waitlist.find(w=>w.slug===me?.player?.slug),confirmed=e.rsvps[me?.player?.slug]==='yes';
 let answer=me?.role==='player'?(own==='yes'?(confirmed?'You’re In · confirmed seat':`You’re In · waitlist #${wait?.position||'…'}`):own==='no'?'You’re Out':own==='maybe'?'You’re a Maybe':'Choose your response'):me?.role==='admin'?'Manage this lineup in the Commish controls below':'Open your personal link to respond';
 return `<article class="event" data-slot="${esc(e.slot)}" id="event-${esc(e.id)}"><div class="event-topline"><div class="date">${esc(e.date==='Date TBD'?'DATE TO BE CONFIRMED':new Date(e.date+'T12:00:00Z').toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric',year:'numeric'}))}</div><span class="event-kind">${esc(e.day||(e.slot==='mtt'?'MTT':e.slot==='saturday'?'Saturday':'Friday'))}</span></div><h2>${esc(e.title)}</h2><div class="details">${esc(e.time)} – ${esc(e.endTime)} · Eastern<br>${esc(e.format)}<br>${esc(e.location)}</div><progress class="meter" aria-label="Confirmed seat capacity" max="${e.capacity}" value="${count}"></progress><div class="counts"><span>${count} / ${e.capacity} confirmed</span><span>${e.waitlist.length} waiting · ${e.rsvpOpen?'RSVPs open':'RSVPs closed'}</span></div><div class="answer">${esc(answer)}</div>${me?.role==='player'&&e.rsvpOpen?`<div class="choices" role="group" aria-label="Your response for ${esc(e.title)}">${[['yes','I’m In'],['maybe','Maybe'],['no','I’m Out']].map(([a,l])=>`<button data-answer="${a}" data-event="${esc(e.id)}" aria-pressed="${own===a}">${l}</button>`).join('')}</div>`:''}<details class="people"><summary>See the lineup</summary><strong>Confirmed seats</strong><ul>${Object.entries(e.rsvps).filter(([,v])=>v==='yes').map(([s])=>`<li>${person(s)}</li>`).join('')||'<li>No confirmed seats yet</li>'}</ul>${e.waitlist.length?`<strong>Waitlist · in order</strong><ol>${e.waitlist.map(w=>`<li>${person(w.slug)}</li>`).join('')}</ol>`:''}${['maybe','no'].map(a=>`<strong>${a==='maybe'?'Maybe':'Out'}</strong><ul>${Object.entries(e.rsvps).filter(([s,v])=>v===a&&!e.waitlist.some(w=>w.slug===s)).map(([s])=>`<li>${person(s)}</li>`).join('')||'<li>Nobody yet</li>'}</ul>`).join('')}<small>Maybe: ${Object.values(e.rsvps).filter(v=>v==='maybe').length-e.waitlist.length}. RSVP isn’t payment.</small></details></article>`;
}
function render(){
 const events=feed?.events||[];$('#events').innerHTML=[...events].sort((a,b)=>a.id===chosen?-1:b.id===chosen?1:0).map(eventCard).join('')||'<p>No upcoming games are published.</p>';
 $('#identity').innerHTML=me?.role==='player'?`${person(me.player.slug)} <span class="tag">Your private RSVP</span>`:me?.role==='admin'?'<span class="tag">THE COMMISH · private controls</span>':'';
 $('#logout').hidden=!me;
 if(me?.role==='admin')renderAdmin();else{$('#admin').hidden=true;$('#admin').innerHTML='';}
}
async function refresh(quiet=false){
 try{
  feed=await api('public/events');
  try{me=await api('me');if(me.role==='admin'){players=me.players;}else{players=[me.player];}}catch(e){if(e.status!==401)throw e;me=null;}
  players=feed.players;
  render();if(!quiet)msg(me?'Live lineup checked '+new Date().toLocaleTimeString([], {hour:'numeric',minute:'2-digit'})+'.':new URLSearchParams(location.search).has('commish')?'Commish sign-in needs your separate private Commish link.':'Open the personal link The Commish shared with you. Need yours? Contact BostnMike.');return true;
 }catch(e){msg(e.message+' Displayed information may be out of date.',true);$('#events').querySelectorAll('button').forEach(b=>b.disabled=true);return false;}
}
function renderAdmin(){
 if(!$('#admin').hidden)return;$('#admin').hidden=false;
 $('#admin').innerHTML=`<section class="admin-panel"><h2>The Commish</h2><div class="toolbar"><a href="/api/backup" download>Download RSVP backup</a></div><h3>Player access</h3><label>Player<select id="link-player">${['active','alumni'].map(g=>`<optgroup label="${g==='alumni'?'Alumni':'Active'}">${players.filter(p=>(p.rosterStatus||'active')===g).map(p=>`<option value="${esc(p.slug)}">${esc(p.name)}</option>`).join('')}</optgroup>`).join('')}</select></label><div class="toolbar"><button id="issue-link">Create / replace private link</button><button id="revoke-link">Revoke link</button></div><p>Replacing immediately signs out that player’s devices. Copy the new link before closing its window. No invitation is sent automatically.</p></section>
 <section class="admin-panel"><h2>Manage a response</h2><label>Event<select id="response-event">${feed.events.map(e=>`<option value="${esc(e.id)}">${esc(e.title)} · ${esc(e.date)}</option>`).join('')}</select></label><label>Player<select id="response-player">${players.map(p=>`<option value="${esc(p.slug)}">${esc(p.name)}</option>`).join('')}</select></label><div class="toolbar">${[['yes','Set In'],['maybe','Set Maybe'],['no','Set Out']].map(([a,l])=>`<button data-admin-answer="${a}">${l}</button>`).join('')}<button id="promote">Move In to front</button></div><p>Moving a player to the front changes queue order. If full, the last confirmed player moves to the waitlist. Capacity reductions use the same queue. Closing stops player edits; Commish controls remain available.</p></section>
 <section class="admin-panel"><h2>Upcoming events</h2><label>Edit or create<select id="edit-event"><option value="">Create a new event</option>${me.allEvents.map(e=>`<option value="${esc(e.id)}">${esc(e.metadata.title)} · ${esc(e.metadata.date)}${e.archived?' (archived)':''}</option>`).join('')}</select></label><form id="event-form"><div class="form-grid">${[['title','Event title',''],['format','Format','40K Format'],['slot','Event type: friday / saturday / mtt','friday'],['day','Day label','Friday'],['date','Date: YYYY-MM-DD or Date TBD','Date TBD'],['time','Start time · Eastern','7:00 PM'],['endTime','End time · Eastern','11:30 PM'],['location','Location','The Caahhd Room'],['address','Area','OCW, in Cary'],['structure','Structure',''],['capacity','Seat capacity','9']].map(([k,l,v])=>`<label>${l}<input name="${k}" value="${esc(v)}" ${k==='capacity'?'type="number" min="1" max="90"':'maxlength="250"'} required></label>`).join('')}</div><label><input type="checkbox" name="open">Open RSVPs</label><div class="toolbar"><button class="primary">Save event</button><button type="button" id="archive-event">Archive / restore selected event</button></div></form><p>Use a new event for each date. Dated identities cannot be edited. Date TBD stays undated and starts closed. Archive hides a game without deleting responses; restoring leaves RSVPs closed. New payment dates still require the league’s audited financial setup before Cashier can collect against them. Manual seating previews stay under the existing site workflow.</p></section>`;
}
async function action(op){if(busy)return;busy=true;document.querySelectorAll('button').forEach(b=>b.disabled=true);try{const result=await api('action',op);if(['event','archive'].includes(op.type))$('#admin').hidden=true;const refreshed=await refresh(true);if(refreshed)msg('Saved. The lineup is up to date.');return result;}catch(e){msg(e.message+' No change was confirmed.',true);}finally{busy=false;document.querySelectorAll('button').forEach(b=>b.disabled=false);}}
document.addEventListener('click',async ev=>{
 const b=ev.target.closest('button');if(!b)return;
 if(b.dataset.answer)await action({type:'respond',eventId:b.dataset.event,answer:b.dataset.answer});
 if(b.dataset.adminAnswer)await action({type:'respond',eventId:$('#response-event').value,slug:$('#response-player').value,answer:b.dataset.adminAnswer});
 if(b.id==='promote'&&confirm('Move this player to the front? If full, the last confirmed player becomes waitlisted.'))await action({type:'promote',eventId:$('#response-event').value,slug:$('#response-player').value});
 if(b.id==='issue-link'&&confirm('Replace the private link for '+playerName($('#link-player').value)+'? Their old link and sessions will stop working.')){const r=await action({type:'link',slug:$('#link-player').value});if(r?.privateLink){$('#private-link').value=r.privateLink;$('#copy-status').textContent='';$('#link-dialog').showModal();}}
 if(b.id==='revoke-link'&&confirm('Revoke access for '+playerName($('#link-player').value)+'?'))await action({type:'link',slug:$('#link-player').value,revoke:true});
 if(b.id==='copy-link'){const input=$('#private-link');input.focus();input.select();try{await navigator.clipboard.writeText(input.value);$('#copy-status').textContent='Copied. Share privately with this player.';}catch{$('#copy-status').textContent='Press and hold the selected link, then choose Copy.';}}
 if(b.id==='logout'){await api('logout',{});location.reload();}
 if(b.id==='archive-event'&&$('#edit-event').value&&confirm('Archive or restore this game? Responses will be retained; RSVPs close.'))await action({type:'archive',eventId:$('#edit-event').value});
});
document.addEventListener('change',e=>{if(e.target.id==='edit-event'){const item=me.allEvents.find(x=>x.id===e.target.value),form=$('#event-form');form.reset();if(item){Object.entries({...item.metadata,capacity:item.capacity}).forEach(([k,v])=>{if(form.elements[k])form.elements[k].value=v;});form.elements.open.checked=item.open;}}});
document.addEventListener('submit',async e=>{if(e.target.id!=='event-form')return;e.preventDefault();const f=new FormData(e.target),metadata=Object.fromEntries([...f.entries()].filter(([k])=>!['capacity','open'].includes(k)));await action({type:'event',eventId:$('#edit-event').value||null,metadata,capacity:Number(f.get('capacity')),open:f.has('open')});});
$('#link-dialog').addEventListener('close',()=>{$('#private-link').value='';});
async function start(){
 const fragment=new URLSearchParams(location.hash.slice(1)),key=fragment.get('key');
 // Strip bearer material before any network request, external asset, or navigation.
 if(location.hash)history.replaceState(null,'',location.pathname+location.search);
 if(key){try{await api('exchange',{key});}catch(e){msg(e.message,true);return;}}
 await refresh();
}
setInterval(()=>{if(!busy&&!document.hidden&&!$('#link-dialog').open&&!document.activeElement?.closest('#admin'))refresh(true);},60000);
window.addEventListener('hashchange',()=>{if(location.hash)start();});
start();
