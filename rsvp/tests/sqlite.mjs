import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
export function database(){
 const sql=new DatabaseSync(':memory:');for(const file of readdirSync(new URL('../migrations/',import.meta.url)).filter(f=>f.endsWith('.sql')).sort())sql.exec(readFileSync(new URL('../migrations/'+file,import.meta.url),'utf8'));
 return {sql,prepare(q){let values=[];return {bind(...v){values=v;return this;},first(){return sql.prepare(q).get(...values)||null;},all(){return {results:sql.prepare(q).all(...values)};},run(){return {meta:{changes:Number(sql.prepare(q).run(...values).changes)}};}};},batch(stmts){sql.exec('BEGIN');try{const result=stmts.map(s=>s.run());sql.exec('COMMIT');return result;}catch(e){sql.exec('ROLLBACK');throw e;}}};
}
