const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const base=process.argv[2]||'http://127.0.0.1:8776';
const fit=async(page,selector,width,height)=>{
  const box=await page.locator(selector).boundingBox();
  assert.ok(box&&box.x>=-1&&box.y>=-1&&box.x+box.width<=width+1&&box.y+box.height<=height+1,selector+' fits '+width+'x'+height);
};
async function checkPosterYear(browser, viewport){
  const page=await browser.newPage({viewport,timezoneId:'America/New_York'});
  try {
    const files=['fw27-01-08.jpg','fw26-12-11.jpg','fw26-10-24.jpg'];
    await page.route('**/images/fw/gallery-manifest.json',route=>route.fulfill({json:{folder:'images/fw',files}}));
    await page.clock.setFixedTime(new Date('2026-11-06T17:00:00Z'));
    await page.goto(base+'/gallery.html');
    const year=page.locator('#gallery-year-filter');
    const trigger=page.getByRole('button',{name:/^Poster Year:/});
    const menu=page.getByRole('listbox',{name:'Poster Year'});
    const choose=async(label)=>{
      await trigger.click();
      await menu.getByRole('option',{name:label,exact:true}).click();
    };
    const cards=page.locator('#gallery-grid .gallery-card');
    const upcoming=page.locator('.gallery-coming-group .gallery-card');
    const status=page.locator('#gallery-filter-status');
    const dates=()=>cards.locator('.gallery-card-subline').allTextContents();
    await year.locator('option[value="2027"]').waitFor({state:'attached'});
    assert.equal(await upcoming.count(),2,'All Years includes upcoming posters from both years');
    await trigger.click();
    assert.deepEqual(await menu.getByRole('option').allTextContents(),['All Years','2027','2026']);
    await menu.getByRole('option',{name:'2027',exact:true}).click();
    assert.deepEqual(await dates(),['January 8, 2027']);
    assert.equal(await upcoming.count(),1,'2027 can be selected before its first event');
    assert.equal(await status.textContent(),'1 upcoming poster');
    await cards.first().getByRole('button').click();
    assert.equal(await page.locator('#gallery-lightbox-prev').isDisabled(),true);
    assert.equal(await page.locator('#gallery-lightbox-next').isDisabled(),true,'Viewer cannot step outside the selected year');
    await page.keyboard.press('Escape');
    await choose('2026');
    assert.deepEqual(await dates(),['December 11, 2026','October 24, 2026']);
    assert.equal(await status.textContent(),'1 upcoming poster · 1 archived poster on display');
    await choose('All Years');
    assert.equal(await cards.count(),3);
    await page.clock.setFixedTime(new Date('2027-01-08T17:00:00Z'));
    await page.reload();
    await year.locator('option[value="2027"]').waitFor({state:'attached'});
    await choose('2027');
    assert.deepEqual(await dates(),['January 8, 2027']);
    assert.equal(await upcoming.count(),0,'The same filter finds the poster after it rolls into the archive');
    assert.equal(await status.textContent(),'1 archived poster on display');
    console.log('PASS Gallery poster-year selection and rollover '+viewport.width+'px');
  }finally{await page.close();}
}
async function checkFamilyPortraitRotation(browser, viewport){
  const page=await browser.newPage({viewport,reducedMotion:'no-preference'});
  try {
    const requests=[];
    page.on('request',request=>{if(request.url().includes('/images/family-portraits/'))requests.push(request.url());});
    await page.clock.install();
    await page.goto(base+'/gallery.html');
    const portraits=page.locator('#gallery-norm-wing #family-portraits');
    const stage=portraits.locator('.family-portraits-stage');
    const current=()=>portraits.locator('.family-portraits-position').textContent();
    const next=portraits.getByRole('button',{name:'Next portrait'});
    const previous=portraits.getByRole('button',{name:'Previous portrait'});
    const pause=portraits.getByRole('button',{name:'Pause rotation'});
    const play=portraits.getByRole('button',{name:'Play rotation'});
    const selectWing=wing=>page.locator(`[data-gallery-wing="${wing}"]`).click();
    const waitForIntersection=visible=>stage.evaluate((el,inView)=>new Promise(resolve=>{
      const observer=new IntersectionObserver(([entry])=>{
        if(entry.isIntersecting===inView){observer.disconnect();resolve();}
      });
      observer.observe(el);
    }),visible);
    const showStage=async()=>{
      await stage.scrollIntoViewIfNeeded();
      await page.mouse.move(0,0);
      await waitForIntersection(true);
    };
    const tick=ms=>page.clock.fastForward(ms);

    await page.locator('#gallery-grid .gallery-card').first().waitFor();
    assert.equal(await portraits.isVisible(),false);
    await tick(11000);
    assert.equal(await current(),'1 of 5');
    assert.deepEqual(requests,[],'Event Posters does not request hidden exhibit art');

    await selectWing('norm');
    await showStage();
    const image=stage.locator('figure:visible img');
    await image.evaluate(img=>img.decode());
    assert.deepEqual(await image.evaluate(img=>[img.naturalWidth,img.naturalHeight]),[1774,887]);
    const bounds=await image.boundingBox();
    assert.ok(bounds.x>=0&&bounds.x+bounds.width<=viewport.width+1,'Portrait fits the viewport');
    assert.ok(Math.abs(bounds.width/bounds.height-2)<.02,'Native 2:1 framing');
    await tick(7500);
    assert.equal(await current(),'1 of 5','Interval does not end early');
    await tick(2750);
    assert.equal(await current(),'2 of 5','Automatic rotation after ten seconds');

    await page.locator('.gallery-norm-card').first().waitFor();
    await page.evaluate(()=>window.scrollTo(0,document.documentElement.scrollHeight));
    await waitForIntersection(false);
    await tick(11000);
    assert.equal(await current(),'2 of 5','No rotation while the stage is offscreen');

    await showStage();
    await page.evaluate(()=>{
      Object.defineProperty(document,'hidden',{configurable:true,value:true});
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await tick(11000);
    assert.equal(await current(),'2 of 5','No rotation while the tab is hidden');
    await page.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});
    await tick(11000);
    assert.equal(await current(),'3 of 5','Rotation resumes in a visible tab');

    await selectWing('posters');
    assert.equal(await portraits.isVisible(),false);
    await tick(11000);
    assert.equal(await current(),'3 of 5','No rotation in the other gallery wing');
    await selectWing('norm');
    await pause.click();
    await showStage();
    await tick(11000);
    assert.equal(await current(),'3 of 5','Pause is respected when the stage is visible');
    await previous.click();
    assert.equal(await current(),'2 of 5');
    await next.click();
    assert.equal(await current(),'3 of 5');
    await play.click();
    await showStage();
    await tick(11000);
    assert.equal(await current(),'4 of 5','Play resumes rotation');

    await page.emulateMedia({reducedMotion:'reduce'});
    await page.reload();
    await showStage();
    await play.waitFor();
    await tick(11000);
    assert.equal(await current(),'1 of 5','Reduced motion starts paused');
    await previous.click();
    assert.equal(await current(),'5 of 5','Manual controls still work and wrap');
    console.log('PASS Family Portraits in the Norm wing '+viewport.width+'px: rotation, visibility and controls');
  }finally{await page.close();}
}
(async()=>{
  const browser=await chromium.launch({...(process.env.CI?{}:{channel:'chrome'}),headless:true});
  try{
    for(const viewport of [{width:1440,height:960},{width:390,height:844}]){
      await checkFamilyPortraitRotation(browser,viewport);
    }
    const film=await browser.newPage();
    try {
      await film.goto(base+'/media.html',{waitUntil:'domcontentloaded'});
      await film.locator('.media-library .media-card').first().waitFor();
      assert.equal(await film.locator('#family-portraits').count(),0,'Film Room keeps the library, not the exhibit');
    }finally{await film.close();}
    for(const viewport of [{width:1440,height:1000},{width:820,height:1000},{width:390,height:844}]){
      await checkPosterYear(browser,viewport);
    }
    for(const viewport of [{width:1440,height:1000},{width:820,height:1000},{width:390,height:844},{width:320,height:850},{width:320,height:568},{width:844,height:390},{width:568,height:320}]){
      const {width,height}=viewport;
      const page=await browser.newPage({viewport,reducedMotion:'reduce'});
      const errors=[],normRequests=[];
      page.on('pageerror',e=>errors.push(e.message));
      page.on('request',r=>{if(r.url().includes('/images/norm-gallery/'))normRequests.push(r.url());});
      await page.goto(base+'/gallery.html');
      await page.locator('#gallery-grid .gallery-poster-button').first().waitFor();
      assert.equal(normRequests.length,0,'Event archive does not fetch Norm images');
      const archiveCount=await page.locator('#gallery-grid .gallery-card').count();
      const normButton=page.locator('[data-gallery-wing="norm"]');
      await normButton.focus();await page.keyboard.press('Enter');
      await page.locator('.gallery-norm-card').last().waitFor();
      assert.equal(await page.locator('#gallery-poster-wing').isVisible(),false);
      assert.equal(await page.locator('#gallery-year-field').isVisible(),false);
      assert.equal(await normButton.getAttribute('aria-pressed'),'true');
      assert.equal(await page.locator('.gallery-norm-card').count(),33);
      assert.match(await page.locator('#gallery-filter-status').innerText(),/33 portrait covers/);
      assert.equal(await page.locator('.gallery-norm-banner').count(),0,'Original group picture is removed');
      assert.ok(!normRequests.some(url=>url.includes('/many-faces-of-norm.jpg')),'Original group picture is never requested');
      const portrait=page.locator('.gallery-norm-card').first();
      const image=portrait.locator('img');
      await image.evaluate(img=>img.decode());
      const ratio=await image.evaluate(img=>{
        const box=img.getBoundingClientRect(),style=getComputedStyle(img);
        const w=box.width-parseFloat(style.borderLeftWidth)-parseFloat(style.borderRightWidth);
        const h=box.height-parseFloat(style.borderTopWidth)-parseFloat(style.borderBottomWidth);
        return [w/h,img.naturalWidth/img.naturalHeight];
      });
      assert.ok(Math.abs(ratio[0]-ratio[1])<.01,'New portrait is uncropped and unstretched');
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,'No page overflow');
      await normButton.scrollIntoViewIfNeeded();
      await page.screenshot({path:'/tmp/norm-gallery-'+width+'x'+height+'.png'});
      const portraitButton=portrait.locator('button');
      await portraitButton.click();
      await page.locator('#gallery-lightbox-image').evaluate(img=>img.decode());
      assert.equal(await page.locator('#gallery-lightbox-prev').isDisabled(),true);
      assert.equal(await page.locator('#gallery-lightbox-title').innerText(),'Two Seats Remain');
      assert.equal(await page.locator('#gallery-lightbox-film').getAttribute('href'),'media.html#two-seats-remain');
      assert.match(await page.locator('#gallery-lightbox-image').getAttribute('src'),/images\/norm-gallery\/two-seats-remain[.]png[?]v=/);
      for(const selector of ['.gallery-lightbox-frame','.gallery-lightbox-meta','.gallery-lightbox-controls']) await fit(page,selector,width,height);
      await page.screenshot({path:'/tmp/norm-gallery-two-seats-viewer-'+width+'x'+height+'.png'});
      await page.keyboard.press('ArrowRight');
      await page.locator('#gallery-lightbox-image').evaluate(img=>img.decode());
      assert.equal(await page.locator('#gallery-lightbox-title').innerText(),'One Seat Available');
      assert.equal(await page.locator('#gallery-lightbox-film').getAttribute('href'),'media.html#one-seat-available');
      for(const selector of ['.gallery-lightbox-frame','.gallery-lightbox-meta','.gallery-lightbox-controls']) await fit(page,selector,width,height);
      await page.screenshot({path:'/tmp/norm-gallery-portrait-viewer-'+width+'x'+height+'.png'});
      // Every title must fit, including the longest cancellation captions.
      for(let posterIndex=2;posterIndex<=32;posterIndex++){
        await page.keyboard.press('ArrowRight');
        await page.locator('#gallery-lightbox-image').evaluate(img=>img.decode());
        for(const selector of ['.gallery-lightbox-frame','.gallery-lightbox-meta','.gallery-lightbox-controls']) await fit(page,selector,width,height);
      }
      assert.equal(await page.locator('#gallery-lightbox-next').isDisabled(),true);
      await page.keyboard.press('ArrowLeft');
      await page.locator('#gallery-lightbox-next').focus();await page.keyboard.press('Tab');
      assert.equal(await page.locator('#gallery-lightbox-close').evaluate(e=>e===document.activeElement),true,'Modal focus trap');
      await page.keyboard.press('Escape');
      assert.equal(await portraitButton.evaluate(e=>e===document.activeElement),true,'Return focus to artwork');
      const last=page.locator('.gallery-norm-card').last();
      await last.locator('button').click();await page.locator('#gallery-lightbox-image').evaluate(img=>img.decode());
      assert.equal(await page.locator('#gallery-lightbox-next').isDisabled(),true,'Do not step into Event Posters');
      await page.keyboard.press('Escape');
      await page.locator('[data-gallery-wing="posters"]').click();
      assert.equal(await page.locator('#gallery-norm-wing').isVisible(),false);
      assert.equal(await page.locator('#gallery-year-field').isVisible(),true);
      assert.equal(await page.locator('#gallery-grid .gallery-card').count(),archiveCount);
      await page.goto(base+'/gallery.html#norm');
      await page.locator('.gallery-norm-card').last().waitFor();
      assert.equal(await normButton.getAttribute('aria-pressed'),'true','Direct link opens Norm wing');
      assert.deepEqual(errors,[]);
      await page.close();
      console.log('PASS Norm Gallery '+width+'x'+height);
    }
    const page=await browser.newPage();let fail=true;
    await page.route('**/data/gallery-norm.json',route=>fail?route.fulfill({status:503,body:'unavailable'}):route.continue());
    await page.goto(base+'/gallery.html#norm');
    await page.locator('[data-norm-gallery-retry]').waitFor();
    fail=false;await page.locator('[data-norm-gallery-retry]').click();
    await page.locator('.gallery-norm-card').last().waitFor();
    assert.equal(await page.locator('.gallery-norm-card').count(),33,'Failed request can recover');
    console.log('PASS Norm Gallery retry recovery');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
