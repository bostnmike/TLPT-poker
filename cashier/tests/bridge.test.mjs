import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import vm from 'node:vm';
const source=readFileSync(new URL('../bridge/Code.gs',import.meta.url),'utf8');
function setup(){const props=new Map([['IMPORT_TOKEN','test'],['SITES_ACCESS_TOKEN','test']]),sent=[],triggers=[];const context={console:{log(){}},PropertiesService:{getScriptProperties:()=>({getProperty:k=>props.get(k),setProperty:(k,v)=>props.set(k,v),setProperties:values=>{for(const [k,v] of Object.entries(values))props.set(k,v);},deleteProperty:k=>props.delete(k)})},LockService:{getScriptLock:()=>({tryLock:()=>true,releaseLock(){}})},ScriptApp:{getProjectTriggers:()=>triggers,deleteTrigger:t=>triggers.splice(triggers.indexOf(t),1),newTrigger:name=>({timeBased(){return this;},everyMinutes(n){assert.equal(n,1);return this;},create(){triggers.push({getHandlerFunction:()=>name});}})},Gmail:{Users:{Messages:{list:()=>({messages:[]}),get(){throw Error('Unexpected read');}}}},UrlFetchApp:{fetch:(url,args)=>{const input=JSON.parse(args.payload);sent.push(input);return {getResponseCode:()=>200,getContentText:()=>JSON.stringify({ok:true,acceptedIds:[],events:[{id:'friday:2026-11-06'}],generation:'friday:2026-11-06',queryAfter:1793500000})};}}};vm.createContext(context);vm.runInContext(source,context);return {context,sent,triggers,props};}
test('default reader keeps one timer and polls the server’s current configuration',()=>{const s=setup();s.context.startReceiptImport();assert.equal(s.triggers.length,1);assert.deepEqual(s.sent.map(x=>x.mode),['connection-test','armed','config','live']);assert.ok(s.sent.every(x=>x.readerMode==='rolling'));s.context.startReceiptImport();assert.equal(s.triggers.length,1);});
test('replacement configuration clears old client IDs and polling remains active after October 24',()=>{const s=setup();s.props.set('SCHEDULE_GENERATION','mtt:2026-10-24');s.props.set('ROLLING_PROCESSED_IDS','["old-receipt"]');s.context.pollVenmoReceipts();assert.equal(s.props.get('ROLLING_PROCESSED_IDS'),'[]');assert.equal(s.props.get('SCHEDULE_GENERATION'),'friday:2026-11-06');assert.equal(s.sent.at(-1).mode,'live');});
test('Cloudflare reader uses only its new import secret and never forwards a Sites credential',()=>{
 const s=setup(),requests=[];s.props.set('REGISTER_ORIGIN','https://tlpt-cashier.owner.workers.dev');s.props.set('IMPORT_TOKEN','new-cloudflare-import-secret-at-least-32-characters');
 s.context.UrlFetchApp.fetch=(url,args)=>{requests.push({url,args});return {getResponseCode:()=>200,getContentText:()=>JSON.stringify({ok:true})};};
 s.context.checkConnection();assert.equal(requests[0].url,'https://tlpt-cashier.owner.workers.dev/api/import');assert.equal(requests[0].args.headers['OAI-Sites-Authorization'],undefined);assert.equal(requests[0].args.headers['X-Register-Token'],s.props.get('IMPORT_TOKEN'));
});
test('optional secondary failures cannot interrupt the primary reader or mark unacknowledged receipts seen',()=>{
 const s=setup();s.props.set('SHADOW_REGISTER_ORIGIN','https://tlpt-cashier-staging.owner.workers.dev');s.props.set('SHADOW_IMPORT_TOKEN','separate-shadow-import-secret-at-least-32-characters');
 let primary=0,secondary=0;s.context.UrlFetchApp.fetch=(url,args)=>{if(url.includes('staging')){secondary++;throw Error('Secondary offline');}primary++;return {getResponseCode:()=>200,getContentText:()=>JSON.stringify({ok:true,acceptedIds:[],ignoredIds:[],events:[{id:'friday:2026-11-06'}],generation:'friday:2026-11-06',queryAfter:1793500000})};};
 s.context.pollVenmoReceipts();assert.equal(primary,2);assert.equal(secondary,2);assert.equal(s.props.get('ROLLING_PROCESSED_IDS'),'[]');assert.equal(s.props.get('REGISTER_ORIGIN'),undefined);
});

test('approved reader promotion checks Cloudflare first, preserves rollback credentials and keeps its one timer and processed IDs',()=>{
 const s=setup();s.context.startReceiptImport();
 const timer=s.triggers[0],requests=[],target='https://tlpt-cashier-staging.tlpt-bostnmike.workers.dev',token='existing-cloudflare-import-secret-at-least-32-characters';
 s.props.set('SHADOW_REGISTER_ORIGIN',target);s.props.set('SHADOW_IMPORT_TOKEN',token);s.props.set('ROLLING_PROCESSED_IDS','["retained-id"]');
 s.context.UrlFetchApp.fetch=(url,args)=>{requests.push({url,args});return {getResponseCode:()=>200,getContentText:()=>JSON.stringify({ok:true})};};
 s.context.promoteCloudflareReader();
 assert.equal(s.props.get('REGISTER_ORIGIN'),target);assert.equal(s.props.get('IMPORT_TOKEN'),token);
 assert.equal(s.props.get('PREVIOUS_REGISTER_ORIGIN'),'https://tlpt-cash-register-oct24.blanchettemr.chatgpt.site');assert.equal(s.props.get('PREVIOUS_IMPORT_TOKEN'),'test');assert.equal(s.props.get('SITES_ACCESS_TOKEN'),'test');
 assert.equal(s.props.has('SHADOW_REGISTER_ORIGIN'),false);assert.equal(s.props.has('SHADOW_IMPORT_TOKEN'),false);
 assert.equal(s.props.get('ROLLING_PROCESSED_IDS'),'["retained-id"]');assert.equal(s.triggers.length,1);assert.equal(s.triggers[0],timer);
 s.context.checkConnection();assert.ok(requests.every(r=>r.url===target+'/api/import'&&r.args.headers['X-Register-Token']===token&&!r.args.headers['OAI-Sites-Authorization']));
 s.context.promoteCloudflareReader();assert.equal(s.props.get('PREVIOUS_IMPORT_TOKEN'),'test');assert.equal(s.triggers[0],timer);
});
test('reader promotion cannot change properties when the Cloudflare connection fails',()=>{
 const s=setup();s.props.set('SHADOW_REGISTER_ORIGIN','https://tlpt-cashier-staging.tlpt-bostnmike.workers.dev');s.props.set('SHADOW_IMPORT_TOKEN','existing-cloudflare-import-secret-at-least-32-characters');
 const before=[...s.props];s.context.UrlFetchApp.fetch=()=>({getResponseCode:()=>503});
 assert.throws(()=>s.context.promoteCloudflareReader(),/503/);assert.deepEqual([...s.props],before);
});
test('reader promotion refuses an unexpected target without sending credentials or changing properties',()=>{
 const s=setup();s.props.set('SHADOW_REGISTER_ORIGIN','https://unexpected.owner.workers.dev');s.props.set('SHADOW_IMPORT_TOKEN','existing-cloudflare-import-secret-at-least-32-characters');
 const before=[...s.props];assert.throws(()=>s.context.promoteCloudflareReader(),/Expected/);assert.deepEqual([...s.props],before);assert.equal(s.sent.length,0);
});

test('the reader searches both incoming subject formats, paginates by message and acknowledges only accepted IDs',()=>{
 const s=setup(),queries=[],mails=[{id:'receipt-one',payload:{headers:[{name:'Subject',value:'Test One paid you $30.00'}]}},{id:'receipt-two',payload:{headers:[{name:'Subject',value:'Test Two paid $30.00 to your Venmo account. Leave it in Venmo or transfer it to your bank account.'}]}}];
 s.context.Gmail.Users.Messages.list=(_user,options)=>{queries.push(options);return options.pageToken?{messages:[{id:'receipt-two'}]}:{messages:[{id:'receipt-one'}],nextPageToken:'next-page'};};
 s.context.Gmail.Users.Messages.get=(_user,id)=>mails.find(m=>m.id===id);
 s.context.UrlFetchApp.fetch=(_url,args)=>{const input=JSON.parse(args.payload);s.sent.push(input);return {getResponseCode:()=>200,getContentText:()=>JSON.stringify(input.mode==='config'?{ok:true,events:[{id:'saturday:2026-10-17'}],generation:'saturday:2026-10-17',queryAfter:1791000000}:{ok:true,acceptedIds:input.messages.map(m=>m.id),ignoredIds:[]})};};
 s.context.pollVenmoReceipts();assert.equal(queries.length,2);assert.equal(queries[0].q,'from:venmo.com {subject:"paid you" subject:"to your Venmo account"} after:1791000000');assert.equal(queries[1].pageToken,'next-page');assert.deepEqual(JSON.parse(s.props.get('ROLLING_PROCESSED_IDS')),['receipt-one','receipt-two']);
 assert.equal(s.sent.at(-1).messages.length,2);s.context.pollVenmoReceipts();assert.equal(s.sent.at(-1).messages.length,0,'A second poll must not resend acknowledged receipts');
});
test('an empty plain-text MIME part falls back to HTML while a real plain-text part wins',()=>{
 const s=setup();s.context.Utilities={base64DecodeWebSafe:value=>Buffer.from(value,'base64url'),newBlob:bytes=>({getDataAsString:()=>bytes.toString('utf8')})};
 const html='<html><head><style>fake {content:"wrong note"}</style></head><body><script>doNotRun()</script><p>Payment received</p><p>TLPT&#32;saturday&#32;entry</p><p>&#x1f355;</p><p>See transaction</p></body></html>';
 const mime={mimeType:'multipart/alternative',parts:[{mimeType:'text/plain',body:{size:0,data:''}},{mimeType:'text/html',body:{data:Buffer.from(html).toString('base64url')}}]};
 const text=s.context.plainText_(mime);assert.match(text,/\nTLPT saturday entry\n/);assert.match(text,/🍕/);assert.doesNotMatch(text,/fake|doNotRun|<p>/);
 mime.parts[0].body.data=Buffer.from('TLPT friday rebuy').toString('base64url');assert.equal(s.context.plainText_(mime),'TLPT friday rebuy');
 assert.equal(s.context.plainText_({mimeType:'text/html',body:{data:'%%%'}}),'');
});
