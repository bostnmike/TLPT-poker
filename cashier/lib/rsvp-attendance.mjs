export function eventAttendance(event){
 const rsvps=Object.entries(event.rsvps||{}).filter(([player,answer])=>typeof player==='string'&&player.trim()&&!['tbd','open','empty'].includes(player.toLowerCase())&&['yes','maybe','no','tbd'].includes(answer)).map(([player,answer])=>({player,answer}));
 return {rsvps,roster:rsvps.filter(r=>r.answer==='yes').map(r=>r.player)};
}
