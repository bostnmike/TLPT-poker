import {spawn,spawnSync} from 'node:child_process';
import {existsSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
process.chdir(fileURLToPath(new URL('..',import.meta.url)));
const tool=(file,args)=>{const result=spawnSync(process.execPath,[file,...args],{stdio:'inherit',env:{...process.env,CI:'true',WRANGLER_SEND_METRICS:'false',WRANGLER_WRITE_LOGS:'false'}});if(result.status!==0)process.exit(result.status||1);};
if(!existsSync('dist/index.html'))tool('node_modules/vite/bin/vite.js',['build']);
const stateDir=process.env.CASHIER_LOCAL_STATE||'.wrangler/local';if(!/^\.wrangler\/[a-zA-Z0-9-]+$/.test(stateDir))throw Error('Local state must use an isolated .wrangler subdirectory.');
const config={name:'tlpt-cashier-local',main:'worker.ts',compatibility_date:'2026-05-15',compatibility_flags:['nodejs_compat'],assets:{directory:'./dist',binding:'ASSETS'},vars:{CASHIER_ENV:'local',OWNER_EMAIL:'blanchettemr@gmail.com',LOCAL_OWNER_EMAIL:'blanchettemr@gmail.com',IMPORT_TOKEN:'local-test-import-token-not-for-deployment'},d1_databases:[{binding:'DB',database_name:'tlpt-cashier-local',database_id:'00000000-0000-4000-8000-000000000000',migrations_dir:'drizzle'}]};
writeFileSync('wrangler.local.json',JSON.stringify(config,null,2)+'\n');
tool('node_modules/wrangler/bin/wrangler.js',['d1','migrations','apply','DB','--local','--config','wrangler.local.json','--persist-to',stateDir]);
const children=[];
const launch=(file,args)=>children.push(spawn(process.execPath,[file,...args],{stdio:'inherit',env:{...process.env,WRANGLER_SEND_METRICS:'false',WRANGLER_WRITE_LOGS:'false'}}));
launch('node_modules/wrangler/bin/wrangler.js',['dev','--local','--ip','127.0.0.1','--port','8788','--config','wrangler.local.json','--persist-to',stateDir,'--inspector-port','0']);
if(!process.argv.includes('--api-only'))launch('node_modules/vite/bin/vite.js',['build','--watch']);
function stop(){for(const child of children)child.kill('SIGTERM');}
process.on('SIGINT',()=>{stop();process.exit(0);});process.on('SIGTERM',()=>{stop();process.exit(0);});
for(const child of children)child.on('exit',code=>{stop();process.exit(code||0);});
