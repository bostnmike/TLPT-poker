// RSVP seed dates are owned here, not by the Cashier deployment.
const months=['January','February','March','April','May','June','July','August','September','October','November','December'];
export function dateKey(value){
 const s=String(value||'');let y,m,d;
 let match=s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
 if(match){[,y,m,d]=match.map(Number);}
 else{
  match=s.match(/^(?:\w+,\s*)?(\w+)\s+(\d{1,2}),\s*(\d{4})$/);
  if(!match)throw Error('Invalid event date');
  m=months.indexOf(match[1])+1;d=+match[2];y=+match[3];
 }
 const dt=new Date(Date.UTC(y,m-1,d));
 if(!m||dt.getUTCFullYear()!==y||dt.getUTCMonth()!==m-1||dt.getUTCDate()!==d)throw Error('Invalid event date');
 return `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
}
