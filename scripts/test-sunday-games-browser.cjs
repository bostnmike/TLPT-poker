// Disposable public-feed fixtures only: never create or open a production game.
const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const base = process.argv[2] || 'http://127.0.0.1:8772';
const snapshot = JSON.parse(fs.readFileSync(path.join(__dirname, '../tests/visual/fixtures/data/events.json')));
const regular = ['friday','saturday','mtt'].map((slot, index) => ({
  ...snapshot.events.find(event => event.slot === (slot === 'friday' ? 'saturday' : slot)),
  id:'fixture-'+slot, slot, day:['Friday','Saturday','Next MTT'][index], rsvpOpen:true,
  date:['2099-01-02','2099-01-03','Date TBD'][index], rsvps:{bostnmike:'yes'}, waitlist:[]}));
const sunday = {id:'fixture-sunday', slot:'sunday', day:'Sunday', date:'2099-01-04',
  title:'Sunday Test Game', format:'50K Format', structure:'50/100 opening blinds · 20-minute levels',
  tables:1, capacity:9, startingStack:50000, blindStructure:'40k', time:'6:30 PM', endTime:'11:30 PM',
  location:'Test table', address:'', rsvp_url:'https://tlpt-rsvp.tlpt-bostnmike.workers.dev/',
  rsvps:{bostnmike:'yes',red:'yes',ahmed:'maybe'}, waitlist:[], rsvpOpen:false};

(async () => {
  const browser = await chromium.launch({...(process.env.CI ? {} : {channel:'chrome'}), headless:true});
  try {
    for (const width of [1440,820,390,320]) {
      for (const name of ['index','schedule','structures']) {
        const page = await browser.newPage({viewport:{width,height:1000}, reducedMotion:'reduce', timezoneId:'America/New_York'});
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        let mode = 'absent', revision = 1, requests = 0;
        await page.clock.install({time:new Date('2026-10-31T12:00:00-04:00')});
        await page.route('https://**/*', route => {
          if (!route.request().url().includes('/api/public/events')) return route.abort();
          requests++;
          if (mode === 'offline') return route.abort();
          return route.fulfill({json:{schemaVersion:1, revision,
            events:[...regular, ...(mode === 'absent' ? [] : [{...sunday, capacity:mode === 'small' ? 5 : 9,
              rsvpOpen:mode === 'open' || mode === 'small'}])],
            noGameDays:[{date:'2099-01-04',day:'Sunday',label:'NO GAME THIS SUNDAY'}]}});
        });
        await page.goto(base+'/'+name+'.html');
        const ready = name === 'structures' ? '#format-content table' : name === 'index' ? '#home-events-list .event-card' : '#schedule-list .event-card';
        await page.locator(ready).first().waitFor();
        const sundayButton = page.locator('#format-btn-sunday');
        const sundayCards = page.locator('[data-event-slot="sunday"]');
        async function refresh(next) {
          mode = next; revision++;
          const before = requests;
          await page.clock.runFor(60050);
          await page.waitForFunction(revision => window.siteData?.rsvpRevision === revision, revision);
          assert.ok(requests > before, name+': refresh uses the existing live feed');
          if (next === 'offline') await page.waitForFunction(() => window.siteData?.rsvpUnavailable === true);
        }
        async function checkHidden() {
          assert.equal(await sundayCards.count(), 0, name+': no public Sunday card when off');
          assert.equal(await page.locator('[data-home-event-slot="sunday"]').count(), 0);
          if (name === 'structures') assert.equal(await sundayButton.isVisible(), false);
          assert.equal(await page.getByText('NO GAME THIS SUNDAY', {exact:true}).count(), 0);
        }
        await checkHidden();
        await refresh('closed'); await checkHidden();
        await refresh('open');
        if (name === 'structures') {
          await sundayButton.waitFor({state:'visible'});
          await sundayButton.click();
          assert.equal(await sundayButton.getAttribute('aria-pressed'), 'true');
          const title = page.locator('.format-title-sunday');
          assert.match(await title.textContent(), /Sunday 50K/);
          assert.equal(await title.evaluate(el=>getComputedStyle(el).color), 'rgb(252, 165, 165)');
          const rows = page.locator('.blind-table tbody tr:not(.blind-break)');
          assert.equal(await rows.count(), 17);
          assert.deepEqual(await rows.first().locator('td').allTextContents(), ['1','20 min','50','100','','500 BB']);
          assert.equal(await page.locator('.rules-money-callout,.rules-bounty-callout').count(), 0, 'No invented Sunday finances or MTT policy');
          assert.deepEqual(await page.locator('.rules-chip-count').allTextContents(), [16,16,16,15,5,0,0].map(count=>'Set per player = '+count), 'Share the MTT 50K starting chip set');
          for (const image of await page.locator('.rules-chip-image').all()) {
            await image.scrollIntoViewIfNeeded();
            await image.evaluate(image=>image.decode());
          }
          assert.match(await page.locator('.blind-break td').first().evaluate(el=>getComputedStyle(el).backgroundImage), /255, 207, 90/, 'Break rows retain readable gold backgrounds on every screen');
          await page.locator('.structures-controls').scrollIntoViewIfNeeded();
          await page.mouse.move(1,1);
          await page.screenshot({path:'/tmp/sunday-structures-'+width+'.png', animations:'disabled'});
          await page.locator('#format-content').scrollIntoViewIfNeeded();
          await page.screenshot({path:'/tmp/sunday-blinds-'+width+'.png', animations:'disabled'});
          await refresh('closed'); await checkHidden();
          assert.equal(await page.locator('#format-btn-40k').getAttribute('aria-pressed'), 'true');
          assert.equal(await page.locator('.format-title-sunday').count(), 0, 'Closing Sunday replaces its selected sheet');
          // Closing Sunday while its PDF sibling is open must not restore a hidden choice.
          await refresh('open'); await sundayButton.click();
          await page.locator('[data-mtt-guide-toggle]').click();
          await refresh('closed');
          assert.equal(await page.locator('#mtt-guide-panel').isVisible(), true, 'Do not interrupt an open PDF');
          await page.locator('[data-mtt-guide-toggle]').click();
          assert.equal(await page.locator('#format-btn-40k').getAttribute('aria-pressed'), 'true');
          assert.equal(await sundayButton.getAttribute('aria-pressed'), 'false');
        } else {
          assert.equal(await sundayCards.count(), 1);
          if (name === 'index') await page.locator('.home-event-rotator-panel.is-active [data-home-event-slot="sunday"]').click();
          const card = sundayCards.first();
          assert.equal(await card.locator('.schedule-day-pill').textContent(), 'Sunday');
          assert.match(await card.getAttribute('class'), /schedule-event-card-sunday/);
          assert.equal(await card.locator('.event-rsvp-table').count(), 1);
          assert.equal(await card.locator('.event-rsvp-tables-two,.event-admin-status').count(), 0);
          assert.equal(await card.locator('.event-rsvp-seat-player,.event-empty-seat').count(), 9);
          assert.equal(await card.locator('.event-rsvp-seat-player').count(), 2, 'Alumni and active RSVPs retained');
          assert.match(await card.locator('.btn-rsvp').getAttribute('href'), /\?event=fixture-sunday$/);
          assert.equal(await card.evaluate(el=>getComputedStyle(el).borderTopColor), 'rgba(248, 113, 113, 0.42)');
          assert.deepEqual(await page.locator(name === 'index' ? '#home-events-list .event-card' : '#schedule-list .event-card').evaluateAll(cards=>cards.map(el=>el.dataset.eventSlot)), ['friday','saturday','sunday','mtt']);
          await card.scrollIntoViewIfNeeded();
          await page.clock.runFor(1000);
          await card.locator('img').evaluateAll(images=>Promise.all(images.map(image=>image.decode())));
          assert.equal(await card.locator('.event-rsvp-seat-player img').count(), 2, 'Both player avatars load');
          await page.mouse.move(1,1);
          await page.screenshot({path:'/tmp/sunday-'+name+'-'+width+'.png', animations:'disabled'});
          await refresh('small');
          assert.equal(await sundayCards.locator('.event-rsvp-seat-player,.event-empty-seat').count(), 5, 'Capacity-limited Sunday does not advertise extra chairs');
          await refresh('closed'); await checkHidden();
        }
        await refresh('open');
        // A failed live feed must never revive a closed/static Sunday.
        mode='offline'; revision++;
        await page.clock.runFor(60050);
        await page.waitForFunction(() => window.siteData?.rsvpUnavailable === true);
        await checkHidden();
        await refresh('open');
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth > innerWidth + 1), false, name+': no horizontal overflow');
        assert.deepEqual(errors, [], name+': no runtime errors');
        await page.close();
        console.log('PASS optional Sunday '+name+' '+width+': absent/off/open/off, live refresh, red one-table 50K, outage recovery');
      }
    }
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
