/* Optional Crew Map: existing card ratings, never a new ranking model. */
(() => {
  const colors = { s: '#c084fc', a: '#60a5fa', b: '#4ade80', c: '#facc15', d: '#fb7185' };
  let cleanup = () => {};
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function median(values) {
    const sorted = [...values].sort((a,b) => a-b), n = sorted.length;
    return n ? (sorted[Math.floor(n/2)] + sorted[Math.floor((n-1)/2)]) / 2 : 70;
  }
  function layout(points, width, height) {
    const pad = 30;
    const clamp = (x, max) => Math.max(pad, Math.min(max-pad, x));
    const nodes = points.map(p => {
      const ax = pad + (p.career-40)/57*(width-pad*2);
      const ay = height-pad - (p.form-40)/57*(height-pad*2);
      const size = Math.sqrt(24*24 + (52*52-24*24)*Math.min(p.appearances,60)/60);
      return { ...p, ax, ay, x: ax, y: ay, size, hit: Math.max(44,size) };
    });
    // Deterministic collision separation; leader lines retain the actual score coordinates.
    for (let pass=0; pass<180; pass++) {
      let overlap = false;
      for (let i=0; i<nodes.length; i++) for (let j=i+1; j<nodes.length; j++) {
        const a=nodes[i], b=nodes[j];
        let dx=b.x-a.x, dy=b.y-a.y, distance=Math.hypot(dx,dy);
        const gap=(a.hit+b.hit)/2+5;
        if (distance >= gap) continue;
        overlap=true;
        if (distance < .01) { dx=Math.cos(j*2.4); dy=Math.sin(j*2.4); distance=1; }
        const push=(gap-distance)/2+.2;
        a.x=clamp(a.x-dx/distance*push,width); a.y=clamp(a.y-dy/distance*push,height);
        b.x=clamp(b.x+dx/distance*push,width); b.y=clamp(b.y+dy/distance*push,height);
      }
      if (!overlap) break;
    }
    return nodes;
  }
  function render(host, points, benchmark, developingCount, showCards) {
    cleanup();
    const xMedian=median(benchmark.map(p=>p.career)), yMedian=median(benchmark.map(p=>p.form));
    host.innerHTML = `<section class="crew-map" aria-labelledby="crew-map-title">
      <div class="crew-map-heading"><div><h2 id="crew-map-title">The Crew Map</h2><p>Career reputation meets the last five appearances. Receipts, not a new pecking order.</p></div><button class="btn" type="button" data-map-cards>Back to Cards</button></div>
      ${points.length ? `<p class="crew-map-guide" id="crew-map-guide">Higher = stronger recent form. Right = higher career rating. Select a bubble or choose a player below.</p>
      <div class="crew-map-y-label">Recent form · Last Five rating ↑</div>
      <div class="crew-map-plot" role="group" aria-label="Career rating versus Last Five rating" aria-describedby="crew-map-guide">
        <div class="crew-map-quadrant q-tl">Making Noise</div><div class="crew-map-quadrant q-tr">Running the Table</div>
        <div class="crew-map-quadrant q-bl">Building the Résumé</div><div class="crew-map-quadrant q-br">Due for a Reboot</div>
        <div class="crew-map-cross-x"></div><div class="crew-map-cross-y"></div>
        <svg class="crew-map-connectors" aria-hidden="true"></svg><div class="crew-map-bubbles"></div>
      </div><div class="crew-map-x-label"><span>40</span><strong>Career rating →</strong><span>97</span></div>
      <div class="crew-map-key">${Object.entries(colors).map(([key,color])=>`<span style="--map-color:${color}">${({s:'Apex',a:'Crusher',b:'Shot Maker',c:'Gambler',d:'Sponsor'})[key]}</span>`).join('')}</div>
      <p class="crew-map-guide">Dashed lines: league medians (${xMedian} career / ${yMedian} form), fixed across filters. Bubble size: appearances, capped at 60. Leader lines show exact ratings when bubbles overlap.</p>
      <label class="crew-map-player-label" for="crew-map-player"><span>Explore a player</span><select id="crew-map-player">${window.TLPTRoster.options(points, p=>`<option value="${esc(p.slug)}">${esc(p.name)}</option>`)}</select></label>
      <div class="crew-map-detail" aria-live="polite"></div>` : '<p class="crew-search-empty">No established players match this view. Five appearances are needed for the map; developing players are available in Cards.</p>'}
      ${developingCount ? `<p class="crew-map-guide">${developingCount} developing player${developingCount===1?'':'s'} in this selection ${developingCount===1?'needs':'need'} more history for the map. <button type="button" class="btn" data-map-developing>Show in Cards</button></p>` : ''}
      </section>`;
    host.querySelector('[data-map-cards]').addEventListener('click',showCards);
    host.querySelector('[data-map-developing]')?.addEventListener('click',showCards);
    if (!points.length) return;
    const plot=host.querySelector('.crew-map-plot'), bubbles=host.querySelector('.crew-map-bubbles');
    const select=host.querySelector('#crew-map-player');
    let selected=points.find(p=>p.slug==='bostnmike')?.slug || points[0].slug;
    function show(slug) {
      selected=slug;
      const p=points.find(p=>p.slug===slug);
      if (!p) return;
      select.value=slug;
      bubbles.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.slug===slug)));
      host.querySelector('.crew-map-detail').innerHTML = `<div><strong>${esc(p.name)}</strong><span>${esc(p.tier)}${p.rosterStatus==='alumni'?' · Alumni':''}</span></div><dl><div><dt>Career</dt><dd>${p.career}</dd></div><div><dt>Last Five</dt><dd>${p.form}</dd></div><div><dt>Appearances</dt><dd>${p.appearances}</dd></div></dl><a class="btn" href="${esc(p.url)}">Open Player Profile →</a>`;
    }
    select.value=selected;
    select.addEventListener('change',()=>show(select.value));
    let lastWidth=0;
    function draw() {
      const width=plot.clientWidth,height=plot.clientHeight;
      if (!width || width===lastWidth) return;
      lastWidth=width;
      const nodes=layout(points,width,height);
      plot.style.setProperty('--cut-x',`${30+(xMedian-40)/57*(width-60)}px`);
      plot.style.setProperty('--cut-y',`${height-30-(yMedian-40)/57*(height-60)}px`);
      const svg=host.querySelector('.crew-map-connectors');
      svg.setAttribute('viewBox',`0 0 ${width} ${height}`);
      svg.innerHTML=nodes.map(p=>`<line x1="${p.ax}" y1="${p.ay}" x2="${p.x}" y2="${p.y}"/><circle cx="${p.ax}" cy="${p.ay}" r="2"/>`).join('');
      bubbles.innerHTML=nodes.map(p=>`<button type="button" class="crew-map-bubble" data-slug="${esc(p.slug)}" aria-label="${esc(p.name)}: career ${p.career}, Last Five ${p.form}, ${p.appearances} appearances${p.rosterStatus==='alumni'?', Alumni':''}" aria-pressed="false" style="left:${p.x}px;top:${p.y}px;--bubble-size:${p.size}px;--hit-size:${p.hit}px;--map-color:${colors[p.colorKey]}"><span>${esc(p.name.split(/\s+/).map(w=>w[0]).join('').slice(0,2))}</span></button>`).join('');
      bubbles.querySelectorAll('button').forEach(button=> {
        button.title=points.find(p=>p.slug===button.dataset.slug).name;
        button.addEventListener('click',()=> { select.value=button.dataset.slug; select.dispatchEvent(new Event('change',{bubbles:true})); });
        button.addEventListener('focus',()=> { select.value=button.dataset.slug; select.dispatchEvent(new Event('change',{bubbles:true})); });
      });
      show(selected);
    }
    const observer=new ResizeObserver(draw);
    observer.observe(plot);
    cleanup=()=>observer.disconnect();
    draw();
  }
  window.TLPTCrewMap={render, layout, median, destroy:()=>cleanup()};
})();
