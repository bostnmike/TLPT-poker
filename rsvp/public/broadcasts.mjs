export function initBroadcasts(win,doc){
 const $=s=>doc.querySelector(s);if(!$('#message-panel'))return;
 let audience=null,available=false,commish=false,preview=false,player='',polls=[],loading=false,focusedPoll=false,focusedCommishPoll=false,sendsInFlight=0;
 const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 async function api(path,data){const r=await win.fetch('/api/'+path,{cache:'no-store',...(data?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)}:{})});const b=await r.json();if(!r.ok){const error=Error(b.error||'Couldn’t connect. Try again.');error.status=r.status;throw error;}return b;}
 const audienceText=()=>audience?`${audience.players} player${audience.players===1?'':'s'} with notifications on · ${audience.devices} device${audience.devices===1?'':'s'} total, including ${audience.commishDevices} Commish device${audience.commishDevices===1?'':'s'}.`:'Checking who can receive notifications…';
 function results(p){return p.options.map((o,i)=>`<li>${escape(o)} <strong>· ${p.counts[i]} vote${p.counts[i]===1?'':'s'}</strong></li>`).join('');}
 function focusPollResult(){const id=new URLSearchParams(win.location.search).get('poll'),target=id&&doc.getElementById('broadcast-'+id);if(target&&!focusedCommishPoll&&!$('#results-panel').hidden){focusedCommishPoll=true;target.scrollIntoView({block:'center'});}}
 async function overview(){
  try{const data=await api('broadcasts');audience=data.audience;available=data.available;doc.querySelectorAll('[data-field=audience]').forEach(el=>el.textContent=audienceText());
   $('#broadcast-history').innerHTML=data.recent.length?data.recent.map(p=>`<article class="broadcast-history-item" id="broadcast-${escape(p.id)}"><span class="tag">${p.kind==='poll'?(p.closed?'Poll · closed':'Poll · open'):'Announcement'}</span><h3>${escape(p.title)}</h3><p>${escape(p.body)}</p><p>${escape(new Date(p.createdAt).toLocaleString())} · queued for ${p.devices} device${p.devices===1?'':'s'}</p>${p.kind==='poll'?`<ul>${results(p)}</ul>${p.votes.length?`<details><summary>Who voted</summary><ul>${p.votes.map(v=>`<li>${escape(v.name)} · ${escape(p.options[v.choice])}</li>`).join('')}</ul></details>`:'<p>No votes yet.</p>'}${!p.closed?`<button type="button" data-close-poll="${escape(p.id)}">Close voting</button>`:''}`:''}</article>`).join(''):'<p>Nothing sent yet.</p>';focusPollResult();
  }catch(e){available=false;doc.querySelectorAll('[data-field=audience]').forEach(el=>el.textContent=e.message);}
 }
 function composer(panelId,kind){
  const panel=$('#'+panelId),field=name=>panel.querySelector('[data-field="'+name+'"]'),form=field('form');let draft=null,sending=false;
  form.addEventListener('submit',async e=>{
   e.preventDefault();if(sending||!commish||preview)return;
   await overview();if(!available){field('status').textContent='Notifications are unavailable. Try again later.';return;}
   draft={id:win.crypto.randomUUID(),kind,title:field('subject').value.trim(),body:field('body').value.trim(),options:Array.from(panel.querySelectorAll('[data-poll-option]'),i=>i.value.trim()).filter(Boolean)};
   if(!draft.title||(kind==='announcement'&&!draft.body)){field('status').textContent='Enter a title and message, or a poll question.';return;}
   if(kind==='poll'&&(draft.options.length<2||new Set(draft.options.map(o=>o.toLowerCase())).size!==draft.options.length)){field('status').textContent='Enter at least two different choices.';return;}
   field('preview-title').textContent=draft.title;field('preview-body').textContent=draft.body||(kind==='poll'?'The Commish wants your vote. Tap to weigh in.':'');field('preview-choices').innerHTML=kind==='poll'?draft.options.map(o=>'<li>'+escape(o)+'</li>').join(''):'';
   field('preview-audience').textContent=audienceText()+(audience.devices?'':' No devices are subscribed yet.');field('preview').hidden=false;form.hidden=true;field('status').textContent='Review your message, then tap Send now.';field('send').disabled=false;field('edit').disabled=false;field('send').focus();
  });
  field('edit').addEventListener('click',()=>{if(sending)return;draft=null;field('preview').hidden=true;form.hidden=false;field('status').textContent='';});
  field('send').addEventListener('click',async()=>{
   if(sending||!draft||!commish||preview)return;sending=true;sendsInFlight++;field('send').disabled=true;field('edit').disabled=true;field('status').textContent='Sending…';
   try{const sent=await api('broadcasts',draft);field('status').textContent=`${kind==='poll'?'Poll':'Announcement'} queued for ${sent.devices} device${sent.devices===1?'':'s'}. See Results & sent for history.${sent.devices?'':' No one has notifications enabled yet.'}`;draft=null;form.reset();form.hidden=false;field('preview').hidden=true;await overview();await loadPolls();}
   catch(e){field('status').textContent=e.message+' Send not confirmed. Tap Send now to retry this same message safely.';if(e.status&&e.status<500)field('edit').disabled=false;}
   finally{sending=false;sendsInFlight--;field('send').disabled=false;}
  });
 }
 composer('message-panel','announcement');composer('poll-panel','poll');
 $('#broadcast-history').addEventListener('click',async e=>{const b=e.target.closest('[data-close-poll]');if(!b||!commish||preview||b.disabled)return;b.disabled=true;try{await api('broadcasts',{action:'close',id:b.dataset.closePoll});$('#results-status').textContent='Voting closed. Results are saved.';await overview();await loadPolls();}catch(e){$('#results-status').textContent=e.message;b.disabled=false;}});
 function renderPolls(){
  $('#polls').hidden=commish||!polls.length;if(commish)return;
  $('#polls').innerHTML=polls.map(p=>{const own=p.votes.find(v=>v.slug===player);return `<article class="admin-panel poll-card" id="poll-${escape(p.id)}"><span class="tag">The Commish wants your vote · ${p.closed?'closed':'open'}</span><h2>${escape(p.title)}</h2><p>${escape(p.body)}</p>${!player&&!p.closed?'<p>Pick your name above to vote. One vote per player; you can change it while voting is open.</p>':''}<div class="poll-options">${p.options.map((o,i)=>`<button type="button" data-vote-poll="${escape(p.id)}" data-choice="${i}" aria-pressed="${own?.choice===i}" ${!player||p.closed||preview?'disabled':''}>${escape(o)}${own?.choice===i?' · Your vote':''}</button>`).join('')}</div><ul>${results(p)}</ul><p class="poll-status" role="status"></p></article>`;}).join('');
 }
 async function loadPolls(){if(loading)return;loading=true;try{polls=(await api('public/polls')).polls;renderPolls();const id=new URLSearchParams(win.location.search).get('poll'),target=id&&doc.getElementById('poll-'+id);if(target&&!commish&&!focusedPoll){target.scrollIntoView({block:'center'});focusedPoll=true;}}catch{if(polls.length)$('#polls').querySelectorAll('button').forEach(b=>b.disabled=true);}finally{loading=false;}}
 $('#polls').addEventListener('click',async e=>{const b=e.target.closest('[data-vote-poll]');if(!b||b.disabled||!player||commish||preview)return;const card=b.closest('article'),slug=player;card.querySelectorAll('button').forEach(b=>b.disabled=true);try{await api('poll-vote',{pollId:b.dataset.votePoll,choice:Number(b.dataset.choice),slug});await loadPolls();const status=$('#poll-'+b.dataset.votePoll+' .poll-status');if(status)status.textContent='Vote saved. You can change it while voting is open.';}catch(e){card.querySelector('.poll-status').textContent=e.message;card.querySelectorAll('button').forEach(b=>b.disabled=false);}});
 doc.addEventListener('tlpt-player-change',e=>{const was=commish;commish=e.detail.commish&&!e.detail.preview;preview=!!e.detail.preview;player=e.detail.slug||'';if(commish&&!was)overview();renderPolls();});
 doc.addEventListener('tlpt-activity-change',e=>{if(e.detail.commish&&!e.detail.preview&&e.detail.activity==='results'){overview();focusPollResult();}});
 commish=doc.body.classList.contains('is-commish');if(commish)overview();player=$('#shared-player')?.value||'';loadPolls();
 doc.addEventListener('visibilitychange',()=>{if(!doc.hidden){loadPolls();if(commish)overview();}});
 win.setInterval(()=>{if(!doc.hidden){loadPolls();if(commish&&!sendsInFlight&&!doc.activeElement?.closest('.broadcast-composer'))overview();}},60000);
}
if(typeof window!=='undefined')initBroadcasts(window,document);
