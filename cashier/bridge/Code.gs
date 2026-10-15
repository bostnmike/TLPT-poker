/* TLPT payment reader: legacy default stays active until an explicit, tested cutover. */
const LEGACY_REGISTER_ORIGIN='https://tlpt-cash-register-oct24.blanchettemr.chatgpt.site';
function header_(m,name){return ((m.payload.headers||[]).find(x=>x.name.toLowerCase()===name.toLowerCase())||{}).value||'';}
function plainText_(part){if(part.mimeType==='text/plain'&&part.body&&part.body.data){try{const raw=String(part.body.data).replace(/\s/g,'');return Utilities.newBlob(Utilities.base64DecodeWebSafe(raw+'='.repeat((4-raw.length%4)%4))).getDataAsString('UTF-8');}catch{return '';}}return (part.parts||[]).map(plainText_).join('\n');}
function receipt_(m){const auth=(m.payload.headers||[]).find(x=>x.name.toLowerCase()==='authentication-results'&&/^mx\.google\.com;/i.test(x.value.trim()));return {id:m.id,internalDate:m.internalDate,from:header_(m,'From'),subject:header_(m,'Subject'),authenticationResults:auth?auth.value:'',body:plainText_(m.payload).slice(0,30000)};}
function registerOrigin_(value){const origin=String(value||'').replace(/\/$/,'');if(!/^https:\/\/(?:[a-z0-9-]+(?:\.[a-z0-9-]+)*\.workers\.dev|cashier(?:-staging)?\.tlpt\.org|tlpt-cash-register-oct24\.blanchettemr\.chatgpt\.site)$/.test(origin))throw new Error('Use the exact HTTPS cashier origin, without a path or query.');return origin;}
function requestRegister_(origin,token,sitesToken,messages,mode){
 origin=registerOrigin_(origin);if(!token)throw new Error('Reader import key has not been configured.');
 const headers={'X-Register-Token':token};
 if(origin===LEGACY_REGISTER_ORIGIN){if(!sitesToken)throw new Error('Existing Sites connection key is missing.');headers['OAI-Sites-Authorization']='Bearer '+sitesToken;}
 else if(token.length<32)throw new Error('Use a separate Cloudflare import key of at least 32 characters.');
 const response=UrlFetchApp.fetch(origin+'/api/import',{method:'post',contentType:'application/json',followRedirects:false,muteHttpExceptions:true,headers,payload:JSON.stringify({messages,mode:mode||'live',readerMode:'rolling'})});
 if(response.getResponseCode()!==200)throw new Error('Register request failed ('+response.getResponseCode()+'). No receipts marked processed.');
 const result=JSON.parse(response.getContentText());if(!result.ok)throw new Error('Register did not confirm the request.');return result;
}
function sendBatch_(messages,mode){
 const p=PropertiesService.getScriptProperties(),origin=p.getProperty('REGISTER_ORIGIN')||LEGACY_REGISTER_ORIGIN;
 const result=requestRegister_(origin,p.getProperty('IMPORT_TOKEN'),p.getProperty('SITES_ACCESS_TOKEN'),messages,mode);
 // Secondary intake is independent: failure never changes primary acknowledgments.
 const shadow=p.getProperty('SHADOW_REGISTER_ORIGIN');
 if(shadow&&shadow!==origin){try{requestRegister_(shadow,p.getProperty('SHADOW_IMPORT_TOKEN'),null,messages,mode);}catch{console.log('Secondary cashier check failed; the current register remains active.');}}
 return result;
}
function checkShadowConnection(){const p=PropertiesService.getScriptProperties();requestRegister_(p.getProperty('SHADOW_REGISTER_ORIGIN'),p.getProperty('SHADOW_IMPORT_TOKEN'),null,[],'connection-test');console.log('Secondary cashier connection verified. Current reader target unchanged.');}
function verifyShadowReceiptFormat(){
 const p=PropertiesService.getScriptProperties(),list=Gmail.Users.Messages.list('me',{q:'in:anywhere from:venmo.com subject:("paid you")',maxResults:5});
 if(!(list.messages||[]).length){console.log('No genuine received-payment emails found. Format remains unverified.');return;}
 const samples=list.messages.map(x=>receipt_(Gmail.Users.Messages.get('me',x.id,{format:'full'})));
 console.log(JSON.stringify(requestRegister_(p.getProperty('SHADOW_REGISTER_ORIGIN'),p.getProperty('SHADOW_IMPORT_TOKEN'),null,samples,'receipt-test').diagnostics,null,2));console.log('Dry run only. Neither register’s payment records were changed.');
}
function diagnoseVenmoEmails(){const list=Gmail.Users.Messages.list('me',{q:'in:anywhere from:venmo.com',maxResults:30});const samples=(list.messages||[]).map(x=>receipt_(Gmail.Users.Messages.get('me',x.id,{format:'metadata'})));console.log(JSON.stringify(samples.map(x=>({subject:x.subject,from:x.from,date:new Date(Number(x.internalDate)).toISOString(),gmailAuthenticated:/dkim=pass/.test(x.authenticationResults)})),null,2));console.log('Venmo emails: '+samples.length+'; payment subjects: '+samples.filter(x=>/paid you/i.test(x.subject)).length+'.');}
function checkConnection(){sendBatch_([],'connection-test');console.log('Default register connection verified. No payment records were created.');}
function verifyReceiptFormat(){const list=Gmail.Users.Messages.list('me',{q:'in:anywhere from:venmo.com subject:("paid you")',maxResults:5});if(!(list.messages||[]).length){console.log('No genuine received-payment emails found. Format remains unverified.');return;}const samples=list.messages.map(x=>receipt_(Gmail.Users.Messages.get('me',x.id,{format:'full'})));console.log(JSON.stringify(sendBatch_(samples,'receipt-test').diagnostics,null,2));console.log('Dry run only. No payment records or totals were changed.');}
function pollVenmoReceipts(){
 const lock=LockService.getScriptLock();if(!lock.tryLock(1000))return;
 try{
  // Config refresh also clears replaced events, even while no display is open.
  const config=sendBatch_([],'config'),p=PropertiesService.getScriptProperties();
  let seen=JSON.parse(p.getProperty('ROLLING_PROCESSED_IDS')||'[]');
  if(p.getProperty('SCHEDULE_GENERATION')!==config.generation){seen=[];p.setProperty('ROLLING_PROCESSED_IDS','[]');p.setProperty('SCHEDULE_GENERATION',config.generation);}
  if(!config.events.length){sendBatch_([]);return;}
  const query='from:venmo.com subject:("paid you") after:'+config.queryAfter;
  let page='',batch=[];
  function flush(){const result=sendBatch_(batch);seen.push(...(result.acceptedIds||[]),...(result.ignoredIds||[]));seen=Array.from(new Set(seen)).slice(-2000);p.setProperty('ROLLING_PROCESSED_IDS',JSON.stringify(seen));batch=[];}
  for(let pages=0;pages<10;pages++){
   const options={q:query,maxResults:100};if(page)options.pageToken=page;
   const list=Gmail.Users.Messages.list('me',options);
   for(const item of list.messages||[]){if(seen.includes(item.id))continue;batch.push(receipt_(Gmail.Users.Messages.get('me',item.id,{format:'full'})));if(batch.length===30)flush();}
   page=list.nextPageToken||'';if(!page)break;
  }
  flush();
 }finally{lock.releaseLock();}
}
function startReceiptImport(){checkConnection();stopReceiptImport();ScriptApp.newTrigger('pollVenmoReceipts').timeBased().everyMinutes(1).create();sendBatch_([],'armed');pollVenmoReceipts();console.log('Default reader active. Friday, Saturday, and MTT follow the live event JSON. Replaced event records clear after a successful schedule refresh.');}
function stopReceiptImport(){ScriptApp.getProjectTriggers().filter(x=>x.getHandlerFunction()==='pollVenmoReceipts').forEach(x=>ScriptApp.deleteTrigger(x));}
