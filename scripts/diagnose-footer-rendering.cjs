// Read-only experiment against public fixtures in the pinned browser image.
const {chromium}=require('playwright');
const {spawn}=require('node:child_process');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const pw=path.dirname(require.resolve('playwright/package.json'));
const core=path.dirname(require.resolve('playwright-core/package.json',{paths:[pw]}));
const {PNG}=require(path.join(core,'lib/utilsBundle.js'));
const root=path.resolve(__dirname,'..'),out=path.join(root,'browser-results/footer-diagnostics');
const source=fs.readFileSync(path.join(root,'.site-release/rules.html'),'utf8');
const fixtures=path.join(root,'tests/visual/fixtures');
const {rsvpFeedFixture}=require('./browser-rsvp-fixture.cjs');
const variants=['original','single-space','normal-kerning','trim-link','wrapped-prefix','isolated-space'];
function htmlFor(variant){
 return source.replace(/(<footer class="site-footer">[\s\S]*?<p>)([\s\S]*?)(<a\b[\s\S]*?<\/a>)/,(_,start,prefix,link)=>{
  if(variant==='single-space')prefix=prefix.replace(/\s+/g,' ');
  if(variant==='normal-kerning')start=start.replace('<p>','<p style="font-kerning:normal">');
  if(variant==='trim-link')link=link.replace(/>\s*(The Tournament Director)\s*<\/a>/,'>$1</a>');
  if(variant==='wrapped-prefix')prefix='<span>'+prefix.trim()+'</span> ';
  if(variant==='isolated-space')prefix=prefix.trimEnd()+'<span style="font-kerning:none"> </span>';
  return start+prefix+link;
 });
}
function pixelDiff(actual,expected){
 const a=PNG.sync.read(actual),e=PNG.sync.read(expected);
 if(a.width!==e.width||a.height!==e.height)return {dimensions:[a.width,a.height,e.width,e.height],differentPixels:'dimensions'};
 let differentPixels=0;
 for(let n=0;n<a.data.length;n+=4)if(a.data[n]!==e.data[n]||a.data[n+1]!==e.data[n+1]||a.data[n+2]!==e.data[n+2]||a.data[n+3]!==e.data[n+3])differentPixels++;
 return {dimensions:[a.width,a.height],differentPixels};
}
(async()=>{
 fs.mkdirSync(out,{recursive:true});
 const server=spawn(process.execPath,['scripts/serve-visual.cjs'],{cwd:root,stdio:'ignore'});
 try{
  let ready=false;for(let n=0;n<50;n++){try{if((await fetch('http://127.0.0.1:8775/')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,100));}if(!ready)throw Error('Preview did not start');
  const widths=(process.env.FOOTER_WIDTHS||'1440,820,390,320').split(',').map(Number);
  const iterations=Number(process.env.FOOTER_ITERATIONS||6),results=[];
  for(let repeat=0;repeat<iterations;repeat++)for(const width of widths){
   const browser=await chromium.launch({headless:true,...(process.env.CI?{}:{channel:'chrome'})});
   try{for(const variant of variants){
    const page=await browser.newPage({viewport:{width,height:1000},locale:'en-US',timezoneId:'America/New_York',colorScheme:'dark',reducedMotion:'reduce',deviceScaleFactor:1,serviceWorkers:'block'});
    await page.clock.setFixedTime(new Date('2026-10-26T16:00:00-04:00'));
    await page.route('**/*',async route=>{
     const url=new URL(route.request().url());
     if(url.hostname!=='127.0.0.1')return url.href.includes('/api/public/events')?route.fulfill({json:rsvpFeedFixture()}):route.abort();
     if(url.pathname.endsWith('.json'))return route.fulfill({path:path.join(fixtures,url.pathname),contentType:'application/json'});
     if(url.pathname==='/rules.html')return route.fulfill({body:htmlFor(variant),contentType:'text/html'});
     return route.continue();
    });
    await page.goto('http://127.0.0.1:8775/rules.html');await page.waitForLoadState('networkidle');await page.evaluate(()=>document.fonts.ready);
    const footer=page.locator('.site-footer');await footer.scrollIntoViewIfNeeded();await page.mouse.move(1,1);await page.waitForTimeout(250);await footer.scrollIntoViewIfNeeded();
    await page.evaluate(async()=>Promise.all([...document.images].filter(i=>{const b=i.getBoundingClientRect();return b.width&&b.height&&b.top<innerHeight&&b.bottom>0;}).map(i=>i.decode().catch(()=>{}))));
    const state=await page.locator('.site-footer a').evaluate(a=>{
     const p=a.parentElement,b=a.getBoundingClientRect(),range=document.createRange();range.setStart(p,0);range.setEndBefore(a);
     return {x:b.x,y:b.y,width:b.width,height:b.height,prefixWidth:range.getBoundingClientRect().width,font:getComputedStyle(a).font,fontKerning:getComputedStyle(a).fontKerning};
    });
    const bytes=await footer.screenshot({animations:'disabled',caret:'hide',scale:'css'});
    const sha=crypto.createHash('sha256').update(bytes).digest('hex'),diff=pixelDiff(bytes,fs.readFileSync(path.join(root,`tests/visual/baselines/linux/${width}/footer.png`)));
    const record={repeat,width,variant,...state,...diff,sha};results.push(record);
    if(!results.slice(0,-1).some(r=>r.width===width&&r.variant===variant&&r.sha===sha))fs.writeFileSync(path.join(out,`${width}-${variant}-${sha.slice(0,8)}.png`),bytes);
    await page.close();
   }}finally{await browser.close();}
   fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(results,null,2));
  }
  for(const width of widths)for(const variant of variants){const rows=results.filter(r=>r.width===width&&r.variant===variant);console.log(JSON.stringify({width,variant,samples:rows.length,positions:[...new Set(rows.map(r=>r.x))],pixelDifferences:[...new Set(rows.map(r=>r.differentPixels))]}));}
 }finally{server.kill('SIGTERM');}
})().catch(e=>{console.error(e);process.exitCode=1});
