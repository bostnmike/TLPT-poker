export function initBroadcasts(win,doc){
 const $=s=>doc.querySelector(s),form=$('#broadcast-form');if(!form)return;
 let audience=null,available=false,commish=false,preview=false,player='',draft=null,sending=false,polls=[],loading=false,focusedPoll=false,focusedCommishPoll=false;
 const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 async function api(path,data){const r=await win.fetch('/api/'+path,{cache:'no-store',...(data?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)}:{})});const b=await r.json();if(!r.ok){const error=Error(b.error||'Couldn’t connect. Try again.');error.status=r.status;throw error;}return b;}
 const audienceText=()=>audience?`${audience.players} player${audience.players===1?'':'s'} with notifications on · ${audience.devices} device${audience.devices===1?'':'s'} total, including ${audience.commishDevices} Commish device${audience.commishDevices===1?'':'s'}.`:'Checking who can receive notifications…';
 function results(p){return p.options.map((o,i)=>`<li>${escape(o)} <strong>· ${p.counts[i]} vote${p.counts[i]===1?'':'s'}</strong></li>`).join('');}
 async function overview(){
  try{const data=await api('broadcasts');audience=data.audience;available=data.available;$('#broadcast-audience').textContent=audienceText();
   $('#broadcast-history').innerHTML=data.recent.length?data.recent.map(p=>`<article class="broadcast-history-item" id="broadcast-${escape(p.id)}"><span class="tag">${p.kind==='poll'?(p.closed?'Poll · closed':'Poll · open'):'Announcement'}</span><h3>${escape(p.title)}</h3><p>${escape(p.body)}</p><p>${escape(new Date(p.createdAt).toLocaleString())} · queued for ${p.devices} device${p.devices===1?'':'s'}</p>${p.kind==='poll'?`<ul>${results(p)}</ul>${p.votes.length?`<details><summary>Who voted</summary><ul>${p.votes.map(v=>`<li>${escape(v.name)} · ${escape(p.options[v.choice])}</li>`).join('')}</ul></details>`:'<p>No votes yet.</p>'}${!p.closed?`<button type="button" data-close-poll="${escape(p.id)}">Close voting</button>`:''}`:''}</article>`).join(''):'<p>Nothing sent yet.</p>';
   const id=new URLSearchParams(win.location.search).get('poll'),target=id&&doc.getElementById('broadcast-'+id);if(target&&!focusedCommishPoll){focusedCommishPoll=true;target.closest('details').open=true;target.scrollIntoView({block:'center'});}
  }catch(e){available=false;$('#broadcast-audience').textContent=e.message;}
 }
 function mode(){const poll=$('#broadcast-kind').value==='poll';$('#broadcast-choices').hidden=!poll;$('#broadcast-optional').hidden=!poll;$('#broadcast-body').required=!poll;doc.querySelectorAll('[data-poll-option]').forEach((input,i)=>input.required=poll&&i<2);}
 $('#broadcast-kind').addEventListener('change',mode);mode();
 form.addEventListener('submit',async e=>{
  e.preventDefault();if(sending||!commish||preview)return;
  await overview();if(!available){$('#broadcast-status').textContent='Notifications are unavailable. Try again later.';return;}
  draft={id:win.crypto.randomUUID(),kind:$('#broadcast-kind').value,title:$('#broadcast-subject').value.trim(),body:$('#broadcast-body').value.trim(),options:Array.from(doc.querySelectorAll('[data-poll-option]'),i=>i.value.trim()).filter(Boolean)};
  if(!draft.title||(draft.kind==='announcement'&&!draft.body)){$('#broadcast-status').textContent='Enter a title and message, or a poll question.';return;}
  if(draft.kind==='poll'&&(draft.options.length<2||new Set(draft.options.map(o=>o.toLowerCase())).size!==draft.options.length)){$('#broadcast-status').textContent='Enter at least two different choices.';return;}
  $('#broadcast-preview-title').textContent=draft.title;$('#broadcast-preview-body').textContent=draft.body||(draft.kind==='poll'?'The Commish wants your vote. Tap to weigh in.':'');$('#broadcast-preview-choices').innerHTML=draft.kind==='poll'?draft.options.map(o=>'<li>'+escape(o)+'</li>').join(''):'';
  $('#broadcast-preview-audience').textContent=audienceText()+(audience.devices?'':' No devices are subscribed yet.');$('#broadcast-preview').hidden=false;form.hidden=true;$('#broadcast-status').textContent='Review your message, then tap Send now.';$('#broadcast-send').disabled=false;$('#broadcast-edit').disabled=false;$('#broadcast-send').focus();
 });
 $('#broadcast-edit').addEventListener('click',()=>{if(sending)return;draft=null;$('#broadcast-preview').hidden=true;form.hidden=false;$('#broadcast-status').textContent='';});
 $('#broadcast-send').addEventListener('click',async()=>{
  if(sending||!draft||!commish||preview)return;sending=true;$('#broadcast-send').disabled=true;$('#broadcast-edit').disabled=true;$('#broadcast-status').textContent='Sending…';
  try{const sent=await api('broadcasts',draft);$('#broadcast-status').textContent=`${draft.kind==='poll'?'Poll':'Announcement'} queued for ${sent.devices} device${sent.devices===1?'':'s'}. Notifications may take a moment to arrive.${sent.devices?'':' No one has notifications enabled yet.'}`;draft=null;form.reset();mode();form.hidden=false;$('#broadcast-preview').hidden=true;await overview();await loadPolls();}
  catch(e){$('#broadcast-status').textContent=e.message+' Send not confirmed. Tap Send now to retry this same message safely.';if(e.status&&e.status<500)$('#broadcast-edit').disabled=false;/* Keep this exact ID and message for an idempotent retry. */}
  finally{sending=false;$('#broadcast-send').disabled=false;}
 });
 $('#broadcast-history').addEventListener('click',async e=>{const b=e.target.closest('[data-close-poll]');if(!b||!commish||preview||b.disabled)return;b.disabled=true;try{await api('broadcasts',{action:'close',id:b.dataset.closePoll});$('#broadcast-status').textContent='Voting closed. Results are saved.';await overview();await loadPolls();}catch(e){$('#broadcast-status').textContent=e.message;b.disabled=false;}});
 function renderPolls(){
  $('#polls').hidden=commish||!polls.length;if(commish)return;
  $('#polls').innerHTML=polls.map(p=>{const own=p.votes.find(v=>v.slug===player);return `<article class="admin-panel poll-card" id="poll-${escape(p.id)}"><span class="tag">The Commish wants your vote · ${p.closed?'closed':'open'}</span><h2>${escape(p.title)}</h2><p>${escape(p.body)}</p>${!player&&!p.closed?'<p>Pick your name above to vote. One vote per player; you can change it while voting is open.</p>':''}<div class="poll-options">${p.options.map((o,i)=>`<button type="button" data-vote-poll="${escape(p.id)}" data-choice="${i}" aria-pressed="${own?.choice===i}" ${!player||p.closed||preview?'disabled':''}>${escape(o)}${own?.choice===i?' · Your vote':''}</button>`).join('')}</div><ul>${results(p)}</ul><p class="poll-status" role="status"></p></article>`;}).join('');
 }
 async function loadPolls(){if(loading)return;loading=true;try{polls=(await api('public/polls')).polls;renderPolls();const id=new URLSearchParams(win.location.search).get('poll'),target=id&&doc.getElementById('poll-'+id);if(target&&!commish&&!focusedPoll){target.scrollIntoView({block:'center'});focusedPoll=true;}}catch{if(polls.length)$('#polls').querySelectorAll('button').forEach(b=>b.disabled=true);}finally{loading=false;}}
 $('#polls').addEventListener('click',async e=>{const b=e.target.closest('[data-vote-poll]');if(!b||b.disabled||!player||commish||preview)return;const card=b.closest('article'),slug=player;card.querySelectorAll('button').forEach(b=>b.disabled=true);try{await api('poll-vote',{pollId:b.dataset.votePoll,choice:Number(b.dataset.choice),slug});await loadPolls();const status=$('#poll-'+b.dataset.votePoll+' .poll-status');if(status)status.textContent='Vote saved. You can change it while voting is open.';}catch(e){card.querySelector('.poll-status').textContent=e.message;card.querySelectorAll('button').forEach(b=>b.disabled=false);}});
 doc.addEventListener('tlpt-player-change',e=>{const was=commish;commish=e.detail.commish&&!e.detail.preview;preview=!!e.detail.preview;player=e.detail.slug||'';if(commish&&!was)overview();renderPolls();});
 // Handles either module/app initialization order without fetching private data in player view.
 commish=doc.body.classList.contains('is-commish');if(commish)overview();player=$('#shared-player')?.value||'';loadPolls();
 doc.addEventListener('visibilitychange',()=>{if(!doc.hidden){loadPolls();if(commish)overview();}});
 win.setInterval(()=>{if(!doc.hidden){loadPolls();if(commish&&!sending&&!doc.activeElement?.closest('#broadcasts'))overview();}},60000);
}
if(typeof window!=='undefined')initBroadcasts(window,document);
