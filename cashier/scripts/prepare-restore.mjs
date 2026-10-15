import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';import {fileURLToPath} from 'node:url';import {snapshotSql,snapshotSummary} from '../lib/migration.mjs';
process.chdir(fileURLToPath(new URL('..',import.meta.url)));
const path=process.argv[2]||'private/sites-snapshot.json',snapshot=JSON.parse(readFileSync(path,'utf8'));
const sql=snapshotSql(snapshot),summary=snapshotSummary(snapshot);mkdirSync('private',{recursive:true,mode:0o700});writeFileSync('private/restore.sql',sql,{mode:0o600});writeFileSync('private/expected-summary.json',JSON.stringify(summary,null,2)+'\n',{mode:0o600});console.log('Validated full snapshot and prepared private/restore.sql. Nothing was imported.');console.log(JSON.stringify(summary));
