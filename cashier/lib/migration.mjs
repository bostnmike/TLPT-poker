import {totals} from './receipt.mjs';
export const TABLE_COLUMNS={
 payments:['id','source_id','payer','player','cents','kind','status','method','note','received_at','created_at','updated_at','linked_to','event_id','candidate_event_ids','prize_cents','bounty_cents','food_cents','item_cents'],
 audit:['id','payment_id','action','actor','details','at'],
 sync_state:['id','last_check','matched','rejected','configured_at','armed_at','format_verified','active_event_id','reader_mode'],
 schedule_state:['id','events_json','source_hash','fetched_at','attempted_at','error'],
 event_payment_formats:['event_id','mode','bounty_cents','updated_at','actor'],
 deleted_payment_sources:['source_id','event_id','candidate_event_ids'],
 venmo_player_aliases:['payer_key','payer_name','player_slug','player_name','updated_at','actor']
};
const quote=value=>value===null?'NULL':typeof value==='number'?String(value):"'"+value.replaceAll("'","''")+"'";
export function validateSnapshot(snapshot){
 if(snapshot?.schemaVersion!==1||!snapshot.tables||Object.keys(snapshot.tables).sort().join('|')!==Object.keys(TABLE_COLUMNS).sort().join('|'))throw Error('Snapshot must contain exactly the seven original cashier tables.');
 for(const [table,columns]of Object.entries(TABLE_COLUMNS)){
  const rows=snapshot.tables[table];if(!Array.isArray(rows)||rows.length>100000)throw Error('Invalid table: '+table);
  const primary=new Set();
  for(const row of rows){
   if(!row||Object.keys(row).sort().join('|')!==[...columns].sort().join('|'))throw Error('Unexpected columns in '+table);
   for(const value of Object.values(row))if(value!==null&&!(typeof value==='string'&&value.length<=500000)&&!(typeof value==='number'&&Number.isSafeInteger(value)))throw Error('Unsupported value in '+table);
   const id=row[columns[0]];if(typeof id!=='string'||!id||primary.has(id))throw Error('Duplicate or missing key in '+table);primary.add(id);
  }
 }
 const sources=new Set(),links=new Set();
 for(const p of snapshot.tables.payments){
  if(!Number.isSafeInteger(p.cents)||p.cents<=0||sources.has(p.source_id)||typeof p.source_id!=='string'||!p.source_id)throw Error('Invalid or duplicate payment source');sources.add(p.source_id);
  if(p.linked_to!==null){if(links.has(p.linked_to))throw Error('Duplicate linked payment');links.add(p.linked_to);}
  if(!['review','confirmed','void','ignored','linked'].includes(p.status)||!['cash','venmo'].includes(p.method))throw Error('Unknown payment status or method');
 }
 return snapshot;
}
export function snapshotSummary(snapshot){validateSnapshot(snapshot);const byEvent={};for(const p of snapshot.tables.payments)if(p.event_id)(byEvent[p.event_id]??=[]).push(p);return {counts:Object.fromEntries(Object.entries(snapshot.tables).map(([table,rows])=>[table,rows.length])),events:Object.fromEntries(Object.entries(byEvent).map(([id,rows])=>[id,totals(rows)]))};}
export function snapshotSql(snapshot){
 validateSnapshot(snapshot);
 const protectedTables=['payments','audit','event_payment_formats','deleted_payment_sources','venmo_player_aliases'];
 const occupied=protectedTables.map(table=>`EXISTS(SELECT 1 FROM ${table})`).join(' OR ')+" OR EXISTS(SELECT 1 FROM sync_state WHERE armed_at IS NOT NULL)";
 const lines=['-- Private ledger restore: only into a new, unarmed cashier database.','CREATE TABLE _cashier_restore_guard (ok INTEGER NOT NULL CHECK(ok=1));',`INSERT INTO _cashier_restore_guard SELECT CASE WHEN ${occupied} THEN 0 ELSE 1 END;`,'DELETE FROM sync_state;','DELETE FROM schedule_state;'];
 for(const [table,columns]of Object.entries(TABLE_COLUMNS))for(const row of snapshot.tables[table])lines.push(`INSERT INTO ${table} (${columns.join(',')}) VALUES (${columns.map(column=>quote(row[column])).join(',')});`);
 lines.push('DROP TABLE _cashier_restore_guard;');return lines.join('\n')+'\n';
}
