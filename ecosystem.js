
(()=>{'use strict';
const data=JSON.parse(document.getElementById('ecosystem-data').textContent);
const $=id=>document.getElementById(id), NS='http://www.w3.org/2000/svg';
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icon=id=>`<svg aria-hidden="true"><use href="#${id}"/></svg>`;
const nodes=new Map(data.nodes.map(n=>[n.id,n]));const edges=new Map(data.edges.map(e=>[e.id,e]));
const position={registration:[155,145],avatars:[560,145],directory:[155,405],rsvp:[965,145],cashier:[965,405],results:[560,700],content:[155,700],publishing:[965,700],website:[560,405]};
const mapNames={registration:'Member registration',avatars:'Avatar studio',directory:'Player directory',rsvp:'RSVP app',cashier:'Cashier',results:'Official results',content:'Stories & media',publishing:'Site publishing',website:'TLPT'};
const mapKinds={registration:'Member intake',avatars:'Approved artwork',directory:'Shared identity',rsvp:'Live seats + alerts',cashier:'Private payments',results:'Audited history',content:'Reviewed creative',publishing:'Quality + release',website:'THE LEAGUE EXPERIENCE'};
const geometry={
'registration-avatars':'M 251 105 C 320 40 390 35 462 83',
'registration-directory':'M 155 189 L 155 330',
'avatars-directory':'M 467 124 C 347 142 280 240 205 335',
'directory-publishing':'M 155 478 L 155 549 Q 155 565 173 565 L 945 565 Q 965 565 965 587 L 965 638',
'directory-rsvp':'M 252 381 L 325 381 Q 348 381 348 359 L 348 228 Q 348 208 369 208 L 944 208 Q 965 208 965 187',
'directory-cashier':'M 252 429 L 319 429 Q 339 429 339 449 L 339 513 Q 339 533 360 533 L 1068 533 Q 1087 533 1087 513 L 1087 423 Q 1087 405 1071 405 L 1060 405',
'directory-content':'M 125 478 L 125 638',
'rsvp-cashier':'M 965 188 L 965 330',
'rsvp-website':'M 870 140 C 769 167 751 274 666 350',
'results-publishing':'M 656 711 L 866 711',
'results-content':'M 463 711 L 253 711',
'content-publishing':'M 155 783 L 155 795 Q 155 813 176 813 L 944 813 Q 965 813 965 792 L 965 783',
'publishing-website':'M 870 681 C 772 657 753 533 670 467'
};
let journey=null,index=-1,selected=null,timer=null,anim=null,playing=false,pickerSync=false;
function setPicker(value){pickerSync=true;$('journey-picker').value=value;$('journey-picker').dispatchEvent(new Event('change',{bubbles:true}));pickerSync=false;}
const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
for(const e of data.edges){const p=document.createElementNS(NS,'path');p.setAttribute('d',geometry[e.id]||'');p.setAttribute('id','edge-'+e.id);p.setAttribute('class','edge');p.setAttribute('data-mode',e.mode);p.setAttribute('marker-end','url(#arrow-normal)');p.style.setProperty('--edge-color',`var(--${nodes.get(e.from).color||'gold'})`);$('edge-paths').append(p)}
for(const n of data.nodes){
  const b=document.createElement('button');
  const [x,y]=position[n.id];
  const hub=n.id==='website';
  b.type='button';
  b.className='map-node'+(hub?' hub':'');
  b.dataset.id=n.id;
  b.style.cssText=`--x:${x/1120*100}%;--y:${y/860*100}%;--node-color:var(--${n.color});`;
  b.setAttribute('aria-pressed','false');
  b.setAttribute('aria-label',n.title+': '+n.subtitle);
  b.innerHTML='<span class="node-badges" aria-hidden="true"></span>'
    +`<svg class="node-art" viewBox="${hub?'0 0 700 350':'0 0 100 100'}" aria-hidden="true"><use href="#art-${n.id}"/></svg>`
    +(hub?'':`<span class="name">${escape(mapNames[n.id])}</span>`)
    +`<span class="kind">${escape(mapKinds[n.id])}</span>`;
  b.addEventListener('click',()=>showNode(n.id,true));
  $('nodes').append(b);
}
for(const j of data.journeys){const o=document.createElement('option');o.value=j.id;o.textContent=j.title;$('journey-picker').append(o)}
function controls(){$('full-map').hidden=!journey&&!selected;const list=journey?.steps||[];$('play').disabled=!list.length;$('previous').disabled=!list.length||index<=0;$('next').disabled=!list.length||index>=list.length-1;$('step-count').textContent=journey?`${index<0?0:index+1} / ${list.length}`:'—';$('play').querySelector('span').textContent=playing?'Pause':'Play journey';$('play').querySelector('svg').innerHTML=playing?'<path d="M7 5h4v14H7zm7 0h4v14h-4z" fill="currentColor"/>':'<path d="m8 5 11 7-11 7Z" fill="currentColor"/>'}
function stop(){playing=false;clearTimeout(timer);cancelAnimationFrame(anim);$('packet').classList.remove('visible');controls()}
function updateJourneyMarkers(){
  const grouped=new Map();
  if(journey){
    journey.steps.forEach((step,i)=>{
      const id=step.nodeId||edges.get(step.edgeId)?.to;
      if(!id)return;
      if(!grouped.has(id))grouped.set(id,[]);
      grouped.get(id).push({number:i+1,stepIndex:i});
    });
  }
  document.querySelectorAll('.map-node').forEach(button=>{
    const id=button.dataset.id;
    const slot=button.querySelector('.node-badges');
    const marks=grouped.get(id)||[];
    slot.innerHTML=marks.map(mark=>`<span class="journey-marker${mark.stepIndex===index?' is-current':''}" data-step-index="${mark.stepIndex}">${mark.number}</span>`).join('');
    const n=nodes.get(id);
    const steps=marks.length?`; journey step${marks.length>1?'s':''} ${marks.map(m=>m.number).join(', ')}`:'';
    button.setAttribute('aria-label',n.title+': '+n.subtitle+steps);
  });
}

function paint(){updateJourneyMarkers();const jEdges=new Set(journey?.edgeIds||journey?.steps?.map(s=>s.edgeId).filter(Boolean)||[]);const jNodes=new Set(journey?.nodeIds||[]);let touching=new Set();if(selected&&!journey){for(const e of data.edges)if(e.from===selected||e.to===selected){touching.add(e.id);jNodes.add(e.from);jNodes.add(e.to)}}
 const activeStep=journey?.steps?.[index];
 for(const e of data.edges){const el=$('edge-'+e.id);const active=journey?jEdges.has(e.id):selected?touching.has(e.id):false;el.classList.toggle('active',active);el.classList.toggle('dim',journey?!jEdges.has(e.id):selected?!touching.has(e.id):false);el.classList.toggle('current',activeStep?.edgeId===e.id)}
 document.querySelectorAll('.map-node').forEach(b=>{const on=selected===b.dataset.id;b.classList.toggle('selected',on);b.classList.toggle('active',jNodes.has(b.dataset.id));b.classList.toggle('dim',(journey||selected)?!jNodes.has(b.dataset.id)&&!on:false);b.setAttribute('aria-pressed',String(on))});
 controls();}
const modeLabel={automatic:'Automatic',review:'Human review',input:'Member / Commish input',reference:'Factual reference'};
function setCaption(title,detail){$('flow-caption').innerHTML=`<strong>${escape(title)}</strong> ${escape(detail||'')}`}
function showNode(id,user=false){if(user){stop();journey=null;index=-1;setPicker('overview');}selected=id;const n=nodes.get(id);$('inspector').style.setProperty('--detail-color',`var(--${n.color})`);$('inspector').innerHTML=`<div class="detail-top"><svg class="detail-art" aria-hidden="true"><use href="#art-${id}"/></svg><div><p class="detail-label">${escape(n.subtitle)}</p><h2>${escape(n.title)}</h2></div></div><p class="description">${escape(n.description)}</p><div class="detail-block"><h3 class="detail-heading">How it works</h3><ol class="detail-steps">${n.steps.map(s=>`<li data-mode="${escape(s.mode)}"><span class="mode">${modeLabel[s.mode]||s.mode}</span><b>${escape(s.title)}</b><p>${escape(s.detail)}</p></li>`).join('')}</ol></div><div class="detail-block"><h3 class="detail-heading">Where it appears</h3><div class="outputs">${n.outputs.map(o=>`<span class="output-tag">${escape(o)}</span>`).join('')}</div><h3 class="detail-heading">Behind the scenes</h3><p class="tech">${n.tech.map(escape).join(' · ')}</p></div><p class="note">${escape(n.note)}</p>`;if(user)setCaption(n.title,n.description);paint()}
function overview(){selected=null;journey=null;index=-1;stop();$('inspector').style.setProperty('--detail-color','var(--gold)');$('inspector').innerHTML=`<div class="detail-top"><svg class="detail-art" aria-hidden="true"><use href="#art-website"/></svg><div><p class="detail-label">One connected league</p><h2>Follow the data.<br>See the story.</h2></div></div><p class="description">From a new member's first photos to the final result, each station has a specific job. Explore the connections that keep the league running.</p><ul class="world-list"><li>${icon('icon-identity')}People and approved player identity</li><li>${icon('art-rsvp')}Live games, seats and communication</li><li>${icon('art-cashier')}Private payment reconciliation</li><li>${icon('art-results')}Audited results and league history</li><li>${icon('art-content')}Stories, artwork and narration</li><li>${icon('icon-shield')}Checked website publishing</li></ul><div class="overview-hint"><b>Choose a journey above, then step through it.</b><p>Or click any illustrated station to see its inputs, review steps and outputs. Solid lines are automatic, dashed lines involve human review, and dotted lines supply reference information.</p></div><p class="note">The live RSVP feed reaches Home, Schedule and Cashier directly. Official statistics follow the separate Tournament Director results path.</p>`;setCaption('Explore the full ecosystem.','Choose a journey to trace the flow, or click any station for the details.');paint()}
function showJourney(){selected=null;const j=journey;if(!j)return;const active=j.steps[index];$('inspector').style.setProperty('--detail-color','var(--gold)');$('inspector').innerHTML=`<div class="detail-top"><svg class="detail-art" aria-hidden="true"><use href="#art-${j.icon||j.nodeIds[0]}"/></svg><div><p class="detail-label">Follow a journey</p><h2>${escape(j.title)}</h2></div></div><p class="description">${escape(j.summary)}</p><p class="marker-hint">Numbered circles mark where each step happens. The filled circle is the current step.</p><ol class="journey-steps">${j.steps.map((s,i)=>`<li><button type="button" class="journey-step${i===index?' current':''}" data-step="${i}" aria-current="${i===index?'step':'false'}"><span class="ordinal">${i+1}</span><span><b>${escape(s.title||edges.get(s.edgeId)?.label||'')}</b><small>${escape(s.detail||'')}</small></span></button></li>`).join('')}</ol>${j.note?`<p class="note">${escape(j.note)}</p>`:''}`;$('inspector').querySelectorAll('[data-step]').forEach(b=>b.addEventListener('click',()=>{const i=Number(b.dataset.step);stop();setStep(i);$('inspector').querySelector('[data-step="'+i+'"]').focus()}));if(active)setCaption(active.title,active.detail);else setCaption(j.title,j.summary);paint()}
function animateEdge(id){cancelAnimationFrame(anim);const p=$('edge-'+id),dot=$('packet');dot.classList.remove('visible');if(!p||reduced.matches||window.innerWidth<=820||$('map').classList.contains('is-stacked'))return;const length=p.getTotalLength();const start=performance.now(),duration=1500;dot.classList.add('visible');function frame(now){const t=Math.min(1,(now-start)/duration);const pt=p.getPointAtLength(t*length);dot.setAttribute('cx',pt.x);dot.setAttribute('cy',pt.y);if(t<1)anim=requestAnimationFrame(frame);else dot.classList.remove('visible')}anim=requestAnimationFrame(frame)}
function setStep(i){if(!journey)return;index=Math.max(0,Math.min(i,journey.steps.length-1));selected=null;showJourney();const s=journey.steps[index];if(s.edgeId)animateEdge(s.edgeId);else{cancelAnimationFrame(anim);$('packet').classList.remove('visible');if(s.nodeId){selected=s.nodeId;paint()}}}
$('full-map').addEventListener('click',()=>{setPicker('overview');overview()});
$('journey-picker').addEventListener('change',e=>{if(pickerSync)return;stop();index=-1;journey=data.journeys.find(j=>j.id===e.target.value)||null;if(journey)showJourney();else overview()});
$('next').addEventListener('click',()=>{stop();setStep(index+1)});$('previous').addEventListener('click',()=>{stop();setStep(index-1)});
$('play').addEventListener('click',()=>{if(playing){stop();return}if(!journey)return;playing=true;if(index>=journey.steps.length-1)index=-1;function tick(){if(!playing)return;setStep(index+1);if(index>=journey.steps.length-1){timer=setTimeout(stop,1900);return}timer=setTimeout(tick,2700)}tick();controls()});
document.addEventListener('visibilitychange',()=>{if(document.hidden)stop()});document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!e.target.closest?.('.site-header,.site-select-menu')){stop();setPicker('overview');overview()}});
function installLayout(){
  const map=$('map');
  if(typeof map.getBoundingClientRect!=='function')return;
  let frame=0,testedKey='';
  const button=id=>map.querySelector(`.map-node[data-id="${id}"]`);
  function layout(){
    frame=0;
    if(window.innerWidth<=820){
      map.classList.remove('is-stacked');
      map.dataset.layout='cards';
      $('packet').classList.remove('visible');
      return;
    }
    const rootSize=window.getComputedStyle(document.documentElement).fontSize;
    const key=`${window.innerWidth}/${map.getBoundingClientRect().width.toFixed(2)}/${rootSize}`;
    if(map.classList.contains('is-stacked')&&testedKey===key)return;
    map.classList.remove('is-stacked');
    const r=map.getBoundingClientRect();
    if(!r.width||!r.height)return;
    const measured=data.nodes.map(n=>({id:n.id,r:button(n.id).getBoundingClientRect()}));
    const unsafe=measured.some(({r:b})=>b.left<r.left+8||b.right>r.right-8||b.top<r.top+8||b.bottom>r.bottom-8);
    let collision=false;
    for(let i=0;i<measured.length;i++)for(let j=i+1;j<measured.length;j++){
      const a=measured[i].r,b=measured[j].r,gap=10;
      if(a.left<b.right+gap&&a.right+gap>b.left&&a.top<b.bottom+gap&&a.bottom+gap>b.top)collision=true;
    }
    testedKey=key;
    if(unsafe||collision){
      map.classList.add('is-stacked');
      map.dataset.layout='cards';
      $('packet').classList.remove('visible');
      return;
    }
    map.dataset.layout='graph';
    const boxes=Object.fromEntries(measured.map(({id,r:b})=>[id,{
      l:(b.left-r.left)/r.width*1120,
      t:(b.top-r.top)/r.height*860,
      r:(b.right-r.left)/r.width*1120,
      b:(b.bottom-r.top)/r.height*860
    }]));
    const gx=6/r.width*1120,gy=6/r.height*860;
    const port=(id,side,u=.5)=>{
      const b=boxes[id];
      if(side==='N')return[b.l+(b.r-b.l)*u,b.t-gy];
      if(side==='S')return[b.l+(b.r-b.l)*u,b.b+gy];
      if(side==='W')return[b.l-gx,b.t+(b.b-b.t)*u];
      return[b.r+gx,b.t+(b.b-b.t)*u];
    };
    const pt=p=>p.map(v=>Number(v.toFixed(2))).join(' ');
    const poly=points=>'M '+points.map(pt).join(' L ');
    const curve=(a,c1,c2,b)=>`M ${pt(a)} C ${pt(c1)} ${pt(c2)} ${pt(b)}`;
    const topBottom=Math.max(...['registration','avatars','rsvp'].map(id=>boxes[id].b));
    const middleTop=Math.min(...['directory','website','cashier'].map(id=>boxes[id].t));
    const middleBottom=Math.max(...['directory','website','cashier'].map(id=>boxes[id].b));
    const bottomTop=Math.min(...['content','results','publishing'].map(id=>boxes[id].t));
    const laneTop=(topBottom+middleTop)/2;
    const laneBottom=(middleBottom+bottomTop)/2;
    const leftLane=(boxes.directory.r+boxes.website.l)/2;
    const outerRight=Math.min(1090,boxes.cashier.r+gx+20);
    const outerBottom=Math.min(840,Math.max(boxes.content.b,boxes.publishing.b)+30);
    const paths={};
    let a=port('registration','E'),b=port('avatars','W');
    const overhead=Math.max(28,Math.min(boxes.registration.t,boxes.avatars.t)-20);
    paths['registration-avatars']=curve(a,[a[0]+55,overhead],[b[0]-55,overhead],b);
    paths['registration-directory']=poly([port('registration','S'),port('directory','N')]);
    a=port('avatars','W',.65);b=port('directory','N');
    paths['avatars-directory']=poly([a,[leftLane,a[1]],[leftLane,laneTop],[b[0],laneTop],b]);
    a=port('directory','S');b=port('publishing','N');
    paths['directory-publishing']=poly([a,[a[0],laneBottom+12],[b[0],laneBottom+12],b]);
    a=port('directory','E',.35);b=port('rsvp','S');
    paths['directory-rsvp']=poly([a,[leftLane,a[1]],[leftLane,laneTop],[b[0],laneTop],b]);
    a=port('directory','E',.7);b=port('cashier','E');
    paths['directory-cashier']=poly([a,[leftLane,a[1]],[leftLane,laneBottom-12],[outerRight,laneBottom-12],[outerRight,b[1]],b]);
    paths['directory-content']=poly([port('directory','S',.35),port('content','N',.35)]);
    paths['rsvp-cashier']=poly([port('rsvp','S'),port('cashier','N')]);
    a=port('rsvp','W');b=port('website','E',.36);
    paths['rsvp-website']=curve(a,[a[0]-70,a[1]+30],[b[0]+60,b[1]-70],b);
    paths['results-publishing']=poly([port('results','E'),port('publishing','W')]);
    paths['results-content']=poly([port('results','W'),port('content','E')]);
    a=port('content','S');b=port('publishing','S');
    paths['content-publishing']=poly([a,[a[0],outerBottom],[b[0],outerBottom],b]);
    a=port('publishing','W');b=port('website','E',.68);
    paths['publishing-website']=curve(a,[a[0]-75,a[1]-20],[b[0]+75,b[1]+80],b);
    for(const [id,d] of Object.entries(paths))$('edge-'+id).setAttribute('d',d);
  }
  function queue(){if(!frame)frame=window.requestAnimationFrame(layout)}
  window.addEventListener('resize',queue,{passive:true});
  if(typeof ResizeObserver==='function'){
    const observer=new ResizeObserver(queue);
    observer.observe(map);
    for(const n of data.nodes)observer.observe(button(n.id));
  }
  document.fonts?.ready.then(()=>{testedKey='';queue()});
  queue();
}

window.addEventListener('pagehide',stop);overview();installLayout();
})();
