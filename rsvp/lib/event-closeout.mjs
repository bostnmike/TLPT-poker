import {dateKey} from './date-key.mjs';

// Actual finish time and canonical evidence are independently checked by Cashier.
export function canCloseOutEvent(event, now = new Date()) {
  if (!event || event.archived || event.cancelled || event.deletedAt) return false;
  try {
    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone:'America/New_York', year:'numeric', month:'2-digit', day:'2-digit'
    }).format(new Date(now));
    return dateKey(event.metadata.date) <= today;
  } catch { return false; }
}
export const validCloseoutRequestId = value => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(value);
