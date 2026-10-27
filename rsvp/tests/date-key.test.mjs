import {test} from 'node:test';
import assert from 'node:assert/strict';
import {dateKey} from '../lib/date-key.mjs';
test('RSVP dates do not depend on the Cashier installation',()=>{
 for(const value of ['2026-12-05','Saturday, December 5, 2026','December 5, 2026'])
  assert.equal(dateKey(value),'2026-12-05');
 for(const value of ['2026-02-30','2026-13-01','Friday, 2026','Date TBD',''])
  assert.throws(()=>dateKey(value),/Invalid event date/);
 assert.equal(dateKey('2028-02-29'),'2028-02-29');
});
