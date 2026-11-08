// Synthetic canonical responses for disposable tests only. No production hooks.
export function closeoutEvidence({date='2020-01-01',title='Close-out test',revision='a'.repeat(40),feed={schemaVersion:1,revision:1,events:[]},publishedMismatch=false,rawMissing=false,invalidReport=false,finish='23:00:00'}={}){
 const parsed={eventId:date,date,title,sourceFile:`Event Report ${date}.html`,summary:{endTimeIso:date+'T'+finish},winners:[{slug:'test',name:'Test',rank:1,payout:30}],actions:[{type:'buyin',slug:'test'}]};
 const root='https://raw.githubusercontent.com/bostnmike/TLPT-poker/'+revision+'/';
 const responses=new Map([
  ['https://api.github.com/repos/bostnmike/TLPT-poker/commits/main',JSON.stringify({sha:revision})],
  [root+'data/parsed/events/'+date+'.json',JSON.stringify(parsed)],
  [root+'data/generated/event-history.json',JSON.stringify({events:[parsed]})],
  [root+'data/generated/validation-report.json',JSON.stringify({status:invalidReport?'FAIL':'PASS',errorCount:invalidReport?1:0})],
  [root+'data/generated/integrity-report.json',JSON.stringify({status:'PASS',errorCount:0})],
  ['https://tlpt.org/data/parsed/events/'+date+'.json',JSON.stringify({...parsed,...publishedMismatch?{title:'Unpublished'}:{}})],
  [root+'data/raw/events/'+encodeURIComponent(parsed.sourceFile),'<!doctype html><html><title>'+title+'</title><body>'+('original report '.repeat(25))+'</body></html>'],
  ['https://tlpt-rsvp.tlpt-bostnmike.workers.dev/api/public/events',JSON.stringify(feed)]
 ]);
 if(rawMissing)responses.delete(root+'data/raw/events/'+encodeURIComponent(parsed.sourceFile));
 return {parsed,revision,responses,fetch:async url=>responses.has(String(url))?new Response(responses.get(String(url))):new Response('not found',{status:404})};
}
