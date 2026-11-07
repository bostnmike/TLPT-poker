const fs = require('node:fs');
const path = require('node:path');

function rsvpFeedFixture() {
  const data = JSON.parse(fs.readFileSync(path.join(__dirname, '../tests/visual/fixtures/data/events.json'), 'utf8'));
  // The reviewed snapshot predates the live switch. Mark its open games explicitly.
  return {
    schemaVersion: 1,
    revision: 'visual-fixture',
    events: data.events.map(event => ({...event, rsvpOpen: true})),
    noGameDays: []
  };
}

async function mockRsvpFeed(page) {
  await page.route('https://tlpt-rsvp.tlpt-bostnmike.workers.dev/api/public/events*', route =>
    route.fulfill({json: rsvpFeedFixture()}));
}

module.exports = {rsvpFeedFixture, mockRsvpFeed};
