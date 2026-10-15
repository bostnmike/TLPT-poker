// Temporary owner-authenticated page for the EXISTING Sites app.
// Copy to app/migration-backup/page.tsx there; remove after migration acceptance.
import {requireChatGPTUser} from '@/app/chatgpt-auth';
import {db} from '@/lib/api';
export const dynamic='force-dynamic';
export const metadata={title:'TLPT · Private migration backup',robots:{index:false,follow:false}};
const tables=['payments','audit','sync_state','schedule_state','event_payment_formats','deleted_payment_sources','venmo_player_aliases'];
export default async function Page(){
 const user=await requireChatGPTUser('/migration-backup');
 if(user.email.toLowerCase()!=='blanchettemr@gmail.com')return <main>Owner access required.</main>;
 const database=db();
 const results=await database.batch(tables.map(table=>database.prepare('SELECT * FROM '+table)));
 const snapshot={schemaVersion:1,exportedAt:new Date().toISOString(),tables:Object.fromEntries(tables.map((table,i)=>[table,results[i].results]))};
 return <main><h1>Private ledger backup</h1><p>Read-only snapshot for the Cloudflare migration.</p><pre id="ledger-snapshot">{JSON.stringify(snapshot)}</pre></main>;
}
