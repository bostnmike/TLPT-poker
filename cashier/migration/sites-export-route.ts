// Temporary read-only route for the EXISTING Sites app, installed only at cutover.
// Copy to its app/api/migration-export/route.ts; this file is not a Cloudflare route.
import {db,json,browserAuth} from '@/lib/api';
export const dynamic='force-dynamic';
const tables=['payments','audit','sync_state','schedule_state','event_payment_formats','deleted_payment_sources','venmo_player_aliases'];
export async function GET(req:Request){
 const denied=browserAuth(req);if(denied)return denied;
 if(req.headers.get('oai-authenticated-user-email')?.toLowerCase()!=='blanchettemr@gmail.com')return json({error:'Owner only'},403);
 const results=await db().batch(tables.map(table=>db().prepare('SELECT * FROM '+table)));
 return json({schemaVersion:1,exportedAt:new Date().toISOString(),tables:Object.fromEntries(tables.map((table,i)=>[table,results[i].results]))});
}
