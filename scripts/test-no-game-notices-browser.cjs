const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const base=process.argv[2]||'http://127.0.0.1:8767';
const root=path.resolve('rsvp/public');
const server=http.createServer((req,res)=>{
 const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
 const file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
 if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 try{res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.png':'image/png','.webmanifest':'application/manifest+json'})[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));}catch{res.writeHead(404).end();}
});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const rsvp='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
 for(const width of [1440,820,390,320]){
  for(const pageName of ['index.html','schedule.html','rsvp']){
   const page=await browser.newPage({viewport:{width,height:900},reducedMotion:'reduce'}),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   let mode='notices';
   const feed={schemaVersion:1,revision:108,players:[],events:[],cancelledEvents:[],noGameDays:[{date:'2026-10-30',day:'Friday',label:'NO GAME THIS FRIDAY'},{date:'2026-10-31',day:'Saturday',label:'NO GAME THIS SATURDAY'}]};
   await page.route('**/api/public/events',route=>mode==='offline'?route.abort():route.fulfill({json:{...feed,noGameDays:mode==='empty'?[]:feed.noGameDays}}));
   await page.route('**/api/me',route=>route.fulfill({status:401,json:{error:'Sign in'}}));
   const url=pageName==='rsvp'?rsvp:base+'/'+pageName;
   await page.goto(url);
   const notice=page.locator('#no-game-notices');
   await notice.getByText('NO GAME THIS FRIDAY',{exact:true}).waitFor();
   assert.equal(await notice.locator('.no-game-notice').count(),2);
   for(const item of await notice.locator('.no-game-notice').all()){
    const box=await item.boundingBox();assert.ok(box.x>=0&&box.x+box.width<=width+1);
    assert.equal(await item.evaluate(e=>e.scrollWidth>e.clientWidth+1),false);
   }
   await notice.scrollIntoViewIfNeeded();
   if(width===390)await page.screenshot({path:'/tmp/tlpt-no-game-'+pageName.replace('.html','')+'.png'});
   mode='empty';await page.reload();await page.waitForFunction(()=>document.querySelector('#no-game-notices').innerHTML==='');
   mode='offline';await page.reload();assert.equal(await notice.locator('.no-game-notice').count(),0);
   assert.deepEqual(errors,[]);
   console.log(`PASS ${pageName} ${width}: two notices fit, scheduled games clear them, feed failure shows no false cancellation`);
   await page.close();
  }
 }
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
