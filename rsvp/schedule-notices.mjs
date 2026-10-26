// Use the league's Eastern calendar, not the viewer's timezone.
export function noGameDays(events, now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
  const part = name => parts.find(p => p.type === name).value;
  const today = `${part('year')}-${part('month')}-${part('day')}`;
  const anchor = new Date(today + 'T12:00:00Z');
  // Sunday starts the upcoming week; elapsed Friday/Saturday notices disappear.
  const weekday = anchor.getUTCDay();
  return [[5,'Friday'],[6,'Saturday']].flatMap(([target, day]) => {
    const date = new Date(anchor);
    date.setUTCDate(date.getUTCDate() + target - weekday);
    const key = date.toISOString().slice(0,10);
    if (key < today || events.some(e => !e.archived && !e.cancelled && !e.deletedAt && (e.metadata || e).date === key)) return [];
    return [{date:key,day,label:`NO GAME THIS ${day.toUpperCase()}`}];
  });
}
