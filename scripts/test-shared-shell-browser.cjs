// The same native HTML navigation must work before and after enhancement.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const base=process.argv[2]||'http://127.0.0.1:8767';
const mode=process.argv[3], snapshots=process.argv[4];
const visualPages=process.argv[5]?.split(',');
const menu=JSON.parse(fs.readFileSync(path.join(__dirname,'../templates/site/navigation.json'),'utf8'));
const pages=['index','dashboard','form-lab','gallery','knockouts','media','news','player-movement',
 'player','players','rebuy-hard','register','rsvp-app','rules','schedule','standings','streaks','structures',
 'trophy-room','voice-of-god','champions','404'];
const expected=menu.flatMap(item=>[item,...item.children||[]]);
(async()=>{
 const browser=await chromium.launch({...(process.env.CI?{}:{channel:'chrome'}),headless:true});
 const differences=[];
 try{
  // No JavaScript dependency: links and page indicators arrive in the HTML.
  const native=await browser.newPage({javaScriptEnabled:false});
  for(const page of pages){
   await native.goto(`${base}/${page}.html`);
   assert.deepEqual(await native.locator('.nav a').allTextContents(),expected.map(x=>x.label));
   const current=await native.locator('.nav a[aria-current="page"]').allTextContents();
   const match=expected.filter(x=>x.href.split('?')[0]===page+'.html').at(-1);
   assert.deepEqual(current,match?[match.label]:[]);
   assert.equal(await native.locator('.site-footer').count(),1);
  }
  await native.close();
  for(const width of [1440,820,390,320]){
   const page=await browser.newPage({viewport:{width,height:1000},reducedMotion:'reduce'});
   // Visual comparisons isolate local markup/styles from changing external RSVP
   // responses and embeds. The normal release tests still exercise live loading.
   if(mode)await page.route('https://**/*',r=>r.abort());
   for(const name of (mode?(visualPages||pages):['index','dashboard','schedule','rules','register','404'])){
    await page.goto(`${base}/${name}.html`+(name==='player'?'?name=BostnMike':''));
    await page.evaluate(()=>document.fonts.ready);
    if(mode)await page.waitForLoadState('networkidle');
    const header=page.locator('.site-header');
    const menuButton=header.locator('.site-nav-toggle');
    await menuButton.waitFor({state:'attached'});
    if(mode)await page.mouse.move(1,1);
    assert.equal(await header.evaluate(e=>e.scrollWidth>e.clientWidth+1),false,`${name} header ${width}`);
    if(mode){
     fs.mkdirSync(snapshots,{recursive:true});
     for(const [label,element] of [['header',header],['footer',page.locator('.site-footer')]]){
      const file=path.join(snapshots,`${name}-${width}-${label}.png`);
      await element.scrollIntoViewIfNeeded();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(250);
      await element.scrollIntoViewIfNeeded();
      const shot=await element.screenshot({animations:'disabled'});
      if(mode==='capture')fs.writeFileSync(file,shot);
      else if(!fs.readFileSync(file).equals(shot)){
       fs.writeFileSync(file.replace('.png','-after.png'),shot);differences.push(`${name} ${width} ${label}`);
      }
     }
    }
    if(await menuButton.isVisible()){
     await menuButton.click();
     assert.equal(await menuButton.getAttribute('aria-expanded'),'true');
     const schedule=header.locator('.nav-dropdown').filter({has:page.locator('a.nav-dropdown-parent[href$="schedule.html"]')});
     const toggle=schedule.getByRole('button');
     await toggle.click();
     await schedule.getByRole('link',{name:'RSVP App',exact:true}).waitFor({state:'visible'});
     assert.equal(await toggle.getAttribute('aria-expanded'),'true');
     await toggle.focus();await page.keyboard.press('Enter');
     assert.equal(await toggle.getAttribute('aria-expanded'),'false');
    }
   }
   await page.close();console.log('PASS shared shell '+width+': navigation, active page, mobile disclosure and footer');
  }
  if(differences.length){console.log('Screenshot differences requiring review:',differences.join('; '));process.exitCode=1;}
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
